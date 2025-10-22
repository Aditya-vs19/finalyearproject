import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import {
  buildConversationSummary,
  ensureConversationMembership,
  formatMessageForResponse,
  persistEncryptedMessage,
  populateConversationMembers,
  getMemberIds,
} from '../services/directMessageService.js';

const conversationRoom = (conversationId) => `conv_${conversationId}`;
const userRoom = (userId) => `user_${userId}`;

const waitForReady = (client, timeoutMs = 2000) =>
  new Promise((resolve, reject) => {
    let settled = false;
    const handleReady = () => {
      if (!settled) {
        settled = true;
        cleanup();
        resolve();
      }
    };
    const handleError = (error) => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(error);
      }
    };
    const handleTimeout = () => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(new Error('Redis connection timeout'));
      }
    };
    const cleanup = () => {
      client.off('ready', handleReady);
      client.off('error', handleError);
      clearTimeout(timer);
    };
    const timer = setTimeout(handleTimeout, timeoutMs);
    client.once('ready', handleReady);
    client.once('error', handleError);
  });

const setupRedisAdapter = async (io) => {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.info('[socket] REDIS_URL not set. Using in-memory adapter.');
    return null;
  }

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const pubClient = new Redis(redisUrl, { maxRetriesPerRequest: null });
      const subClient = pubClient.duplicate();
      await Promise.all([waitForReady(pubClient), waitForReady(subClient)]);
      io.adapter(createAdapter(pubClient, subClient));
      console.log('[socket] Redis adapter connected.');
      const logError = (label) => (error) => {
        console.warn(`[socket] Redis ${label} error: ${error.message}`);
      };
      pubClient.on('error', logError('pub'));
      subClient.on('error', logError('sub'));
      return { pubClient, subClient };
    } catch (error) {
      console.warn(
        `[socket] Redis adapter attempt ${attempt} failed: ${error.message}.`);
      if (attempt === maxAttempts) {
        console.warn('[socket] Falling back to in-memory adapter.');
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 200));
    }
  }
  return null;
};

const socketsByUser = new Map();

const trackConnection = async (userId, socketId) => {
  const sockets = socketsByUser.get(userId) || new Set();
  sockets.add(socketId);
  socketsByUser.set(userId, sockets);
  if (sockets.size === 1) {
    const now = new Date();
    await User.findByIdAndUpdate(userId, {
      onlineStatus: true,
      lastSeen: now,
    }).exec();
    return { wentOnline: true, lastSeen: now };
  }
  return { wentOnline: false };
};

const trackDisconnection = async (userId, socketId) => {
  const sockets = socketsByUser.get(userId);
  if (!sockets) {
    return { wentOffline: false };
  }
  sockets.delete(socketId);
  if (sockets.size === 0) {
    socketsByUser.delete(userId);
    const lastSeen = new Date();
    await User.findByIdAndUpdate(userId, {
      onlineStatus: false,
      lastSeen,
    }).exec();
    return { wentOffline: true, lastSeen };
  }
  socketsByUser.set(userId, sockets);
  return { wentOffline: false };
};

export const configureChatSocket = async ({ io, app }) => {
  await setupRedisAdapter(io);

  const chatNamespace = io.of('/chat');

  chatNamespace.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      return next();
    } catch (error) {
      return next(new Error('Invalid authentication token'));
    }
  });

  const emitMessage = ({ conversationId, message, conversation, members }) => {
    const room = conversationRoom(conversationId);
    chatNamespace.to(room).emit('message', message);
    members.forEach((memberId) => {
      chatNamespace.to(userRoom(memberId)).emit('conversation:update', conversation);
    });
  };

  app.set('io', io);
  app.set('chatEmitter', { emitMessage });

  chatNamespace.on('connection', (socket) => {
    const userId = socket.userId?.toString();
    if (!userId) {
      socket.disconnect(true);
      return;
    }

    socket.join(userRoom(userId));

    trackConnection(userId, socket.id)
      .then(({ wentOnline, lastSeen }) => {
        if (wentOnline) {
          chatNamespace.emit('user:online', {
            userId,
            lastSeen,
          });
        }
      })
      .catch((error) => {
        console.warn(`[socket] presence update failed: ${error.message}`);
      });

    socket.on('joinConversation', async ({ conversationId }) => {
      if (!conversationId) {
        return;
      }
      try {
        await ensureConversationMembership(conversationId, userId);
        socket.join(conversationRoom(conversationId));
      } catch (error) {
        console.warn(`[socket] joinConversation failed: ${error.message}`);
      }
    });

    socket.on('leaveConversation', ({ conversationId }) => {
      if (!conversationId) {
        return;
      }
      socket.leave(conversationRoom(conversationId));
    });

    socket.on('typing', async ({ conversationId, isTyping = false }) => {
      if (!conversationId) {
        return;
      }
      try {
        const conversation = await ensureConversationMembership(conversationId, userId);
        const members = getMemberIds(conversation).filter((memberId) => memberId !== userId);
        const payload = {
          conversationId,
          userId,
          isTyping: Boolean(isTyping),
        };
        members.forEach((memberId) => {
          chatNamespace.to(userRoom(memberId)).emit('typing', payload);
        });
        socket.to(conversationRoom(conversationId)).emit('typing', payload);
      } catch (error) {
        console.warn(`[socket] typing event failed: ${error.message}`);
      }
    });

    socket.on('sendMessage', async (payload, ack) => {
      const safeAck = typeof ack === 'function' ? ack : () => {};
      try {
        const { conversationId, encryptedText } = payload || {};
        if (!conversationId || typeof encryptedText !== 'string') {
          throw new Error('conversationId and encryptedText are required');
        }

        const conversation = await ensureConversationMembership(conversationId, userId);
        await populateConversationMembers(conversation);
        const message = await persistEncryptedMessage({
          conversation,
          senderId: userId,
          encryptedText,
        });

        const formattedMessage = formatMessageForResponse(message);
        const summary = buildConversationSummary(conversation, userId);
        const members = summary.members.map((memberId) => memberId.toString());

        emitMessage({
          conversationId: conversation._id.toString(),
          message: formattedMessage,
          conversation: summary,
          members,
        });

        safeAck({ ok: true, message: formattedMessage });
      } catch (error) {
        console.warn(`[socket] sendMessage failed: ${error.message}`);
        safeAck({ ok: false, error: error.message });
      }
    });

    socket.on('disconnect', () => {
      trackDisconnection(userId, socket.id)
        .then(({ wentOffline, lastSeen }) => {
          if (wentOffline) {
            chatNamespace.emit('user:offline', {
              userId,
              lastSeen,
            });
          }
        })
        .catch((error) => {
          console.warn(`[socket] presence cleanup failed: ${error.message}`);
        });
    });
  });
};
