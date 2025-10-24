import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { chatAPI, profileAPI } from '../../services/api.js';
import { decryptMessage, encryptMessage } from '../../utils/chatEncryption.js';

const ChatContext = createContext(null);

const SOCKET_DEFAULT_API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const deriveSocketUrl = () => {
  const explicit = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_WS_BASE_URL;
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }
  return SOCKET_DEFAULT_API.replace(/\/?api$/, '');
};

const formatMessage = (message, currentUserId) => {
  const senderId = message?.sender?._id || message?.sender;
  return {
    ...message,
    sender: message.sender?._id
      ? message.sender
      : {
          _id: senderId,
          fullName: message.sender?.fullName || null,
          profilePic: message.sender?.profilePic || null,
        },
    plaintext: decryptMessage(message.encryptedText),
    isMine: senderId?.toString() === currentUserId,
  };
};

const sortConversations = (items) =>
  [...items].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));

export const ChatProvider = ({
  currentUser,
  initialParticipantId = null,
  onConversationOpened,
  children,
}) => {
  const currentUserId = currentUser?._id?.toString() || null;
  const [conversations, setConversations] = useState([]);
  const [messagesByConversation, setMessagesByConversation] = useState({});
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [followingUsers, setFollowingUsers] = useState([]);
  const [presenceMap, setPresenceMap] = useState({});
  const [typingMap, setTypingMap] = useState({});
  const [initializationError, setInitializationError] = useState(null);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);

  const socketRef = useRef(null);
  const loadedConversationsRef = useRef(new Set());
  const previousConversationRef = useRef(null);
  const typingTimeoutsRef = useRef(new Map());
  const initialParticipantHandledRef = useRef(false);
  const destroyedRef = useRef(false);

  const token = useMemo(() => localStorage.getItem('token'), [currentUserId]);

  const updateTypingState = (conversationId, isTyping) => {
    setTypingMap((prev) => ({
      ...prev,
      [conversationId]: isTyping,
    }));
  };

  const scheduleTypingCleanup = (conversationId) => {
    if (typingTimeoutsRef.current.has(conversationId)) {
      clearTimeout(typingTimeoutsRef.current.get(conversationId));
    }
    const timeoutId = setTimeout(() => {
      updateTypingState(conversationId, false);
      typingTimeoutsRef.current.delete(conversationId);
    }, 2500);
    typingTimeoutsRef.current.set(conversationId, timeoutId);
  };

  const upsertConversation = (conversation) => {
    if (!conversation?._id) {
      return;
    }
    setConversations((prev) => {
      const existingIndex = prev.findIndex((item) => item._id === conversation._id);
      if (existingIndex === -1) {
        return sortConversations([...prev, conversation]);
      }
      const next = [...prev];
      next[existingIndex] = { ...next[existingIndex], ...conversation };
      return sortConversations(next);
    });
  };

  const ingestMessage = (conversationId, message) => {
    if (!conversationId || !message?._id) {
      return;
    }
    setMessagesByConversation((prev) => {
      const existing = prev[conversationId] || [];
      
      // Check if message already exists (avoid duplicates)
      if (existing.some((item) => item._id === message._id)) {
        return prev;
      }
      
      // Don't add if it's from current user and we might have an optimistic version
      const senderId = message?.sender?._id || message?.sender;
      if (senderId?.toString() === currentUserId) {
        // Check if we have a recent optimistic message with same content
        const recentOptimistic = existing.find(item => 
          item.status === 'sending' && 
          item.plaintext === decryptMessage(message.encryptedText) &&
          Math.abs(new Date(item.createdAt) - new Date(message.createdAt)) < 5000 // Within 5 seconds
        );
        
        if (recentOptimistic) {
          // Replace optimistic message with real one
          const withoutOptimistic = existing.filter(item => item._id !== recentOptimistic._id);
          const formatted = formatMessage(message, currentUserId);
          formatted.status = 'sent';
          const nextMessages = [...withoutOptimistic, formatted].sort(
            (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
          );
          return {
            ...prev,
            [conversationId]: nextMessages,
          };
        }
      }
      
      const formatted = formatMessage(message, currentUserId);
      formatted.status = 'received';
      const nextMessages = [...existing, formatted].sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      );
      return {
        ...prev,
        [conversationId]: nextMessages,
      };
    });
  };

  const loadFollowing = async () => {
    const response = await profileAPI.getFollowingList();
    setFollowingUsers(response.data || []);
  };

  const loadConversations = async () => {
    const response = await chatAPI.listConversations();
    const fetched = Array.isArray(response.data) ? response.data : [];
    setConversations(sortConversations(fetched));
  };

  const initializeData = async () => {
    if (!currentUserId) {
      return;
    }
    setInitializationError(null);
    setLoadingConversations(true);
    try {
      await Promise.all([loadConversations(), loadFollowing()]);
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Unable to initialize chat';
      setInitializationError(message);
    } finally {
      if (!destroyedRef.current) {
        setLoadingConversations(false);
      }
    }
  };

  const joinConversationRoom = (conversationId) => {
    if (!conversationId || !socketRef.current) {
      return;
    }
    socketRef.current.emit('joinConversation', { conversationId });
  };

  const leaveConversationRoom = (conversationId) => {
    if (!conversationId || !socketRef.current) {
      return;
    }
    socketRef.current.emit('leaveConversation', { conversationId });
  };

  const loadMessages = async (conversationId, { force = false } = {}) => {
    if (!conversationId) {
      return;
    }
    if (!force && loadedConversationsRef.current.has(conversationId)) {
      return;
    }
    setLoadingMessages(true);
    try {
      const response = await chatAPI.getMessages(conversationId);
      const messages = Array.isArray(response.data?.messages) ? response.data.messages : [];
      const formatted = messages.map((message) => formatMessage(message, currentUserId));
      setMessagesByConversation((prev) => ({
        ...prev,
        [conversationId]: formatted,
      }));
      loadedConversationsRef.current.add(conversationId);
      if (response.data?.conversation) {
        upsertConversation(response.data.conversation);
      }
    } catch (error) {
      const message = error?.response?.data?.message || 'Failed to load messages';
      toast.error(message);
    } finally {
      if (!destroyedRef.current) {
        setLoadingMessages(false);
      }
    }
  };

  const selectConversation = async (conversationId) => {
    if (!conversationId) {
      setActiveConversationId(null);
      return;
    }
    if (previousConversationRef.current && previousConversationRef.current !== conversationId) {
      leaveConversationRoom(previousConversationRef.current);
    }
    previousConversationRef.current = conversationId;
    setActiveConversationId(conversationId);
    joinConversationRoom(conversationId);
    await loadMessages(conversationId);
  };

  const sendMessage = async (conversationId, plainText) => {
    if (!conversationId) {
      throw new Error('No conversation selected');
    }
    
    const encryptedText = encryptMessage(plainText);
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    // Create optimistic message for immediate display
    const optimisticMessage = {
      _id: tempId,
      conversationId,
      sender: {
        _id: currentUserId,
        fullName: currentUser?.fullName || 'You',
        profilePic: currentUser?.profilePic || null,
      },
      encryptedText,
      plaintext: plainText,
      createdAt: now,
      isMine: true,
      status: 'sending', // Add status to track message state
    };

    // Immediately show the message in UI
    setMessagesByConversation((prev) => {
      const existing = prev[conversationId] || [];
      const nextMessages = [...existing, optimisticMessage].sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      );
      return {
        ...prev,
        [conversationId]: nextMessages,
      };
    });

    // Update conversation list immediately
    setConversations((prev) => {
      const index = prev.findIndex((conversation) => conversation._id === conversationId);
      if (index === -1) {
        return prev;
      }
      const next = [...prev];
      next[index] = {
        ...next[index],
        lastMessage: encryptedText,
        updatedAt: now,
      };
      return sortConversations(next);
    });

    const emitViaSocket = () =>
      new Promise((resolve, reject) => {
        if (!socketRef.current || socketRef.current.disconnected) {
          reject(new Error('Socket disconnected'));
          return;
        }
        
        const timeout = setTimeout(() => {
          reject(new Error('Socket timeout'));
        }, 10000); // 10 second timeout

        socketRef.current.emit(
          'sendMessage',
          { conversationId, encryptedText },
          (response) => {
            clearTimeout(timeout);
            if (response?.ok && response.message) {
              resolve(response.message);
            } else {
              reject(new Error(response?.error || 'Unable to send message'));
            }
          }
        );
      });

    try {
      let serverMessage;
      if (socketConnected) {
        serverMessage = await emitViaSocket();
      } else {
        const response = await chatAPI.sendMessage(conversationId, { encryptedText });
        serverMessage = response.data?.message;
        if (response.data?.conversation) {
          upsertConversation(response.data?.conversation);
        }
      }

      // Replace optimistic message with server response
      if (serverMessage) {
        setMessagesByConversation((prev) => {
          const existing = prev[conversationId] || [];
          const withoutOptimistic = existing.filter(msg => msg._id !== tempId);
          const formatted = formatMessage(serverMessage, currentUserId);
          formatted.status = 'sent';
          const nextMessages = [...withoutOptimistic, formatted].sort(
            (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
          );
          return {
            ...prev,
            [conversationId]: nextMessages,
          };
        });
      }

      return serverMessage;
    } catch (error) {
      // Mark optimistic message as failed
      setMessagesByConversation((prev) => {
        const existing = prev[conversationId] || [];
        const updated = existing.map(msg => 
          msg._id === tempId 
            ? { ...msg, status: 'failed', error: error.message }
            : msg
        );
        return {
          ...prev,
          [conversationId]: updated,
        };
      });

      const friendly = error?.response?.data?.message || error?.message || 'Failed to send message';
      toast.error(friendly);
      throw error;
    }
  };

  const openConversationWithUser = async (userId) => {
    if (!userId) {
      return null;
    }
    try {
      const response = await chatAPI.getConversationWithUser(userId);
      const conversation = response.data;
      upsertConversation(conversation);
      await selectConversation(conversation._id);
      if (typeof onConversationOpened === 'function') {
        onConversationOpened(conversation);
      }
      return conversation;
    } catch (error) {
      let message = error?.response?.data?.message || 'Unable to open conversation';
      
      if (error?.response?.status === 403) {
        message = 'Both users must follow each other to start a chat';
      }
      
      toast.error(message, { duration: 5000 });
      throw error;
    }
  };

  const handleSocketMessage = ({ conversationId, message }) => {
    if (!conversationId || !message) {
      return;
    }
    ingestMessage(conversationId, message);
    setConversations((prev) => {
      const index = prev.findIndex((conversation) => conversation._id === conversationId);
      if (index === -1) {
        return prev;
      }
      const next = [...prev];
      next[index] = {
        ...next[index],
        lastMessage: message.encryptedText,
        updatedAt: message.createdAt,
      };
      return sortConversations(next);
    });
  };

  const handleConversationUpdate = (conversation) => {
    upsertConversation(conversation);
  };

  const handlePresenceUpdate = (userId, presence) => {
    setPresenceMap((prev) => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || {}),
        ...presence,
      },
    }));
  };

  const initializeSocket = () => {
    if (!token) {
      return;
    }
    const url = deriveSocketUrl();
    const socket = io(`${url}/chat`, {
      transports: ['websocket'],
      auth: { token },
      reconnectionAttempts: 5,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('message', handleSocketMessage);
    socket.on('conversation:update', handleConversationUpdate);
    socket.on('user:online', ({ userId, lastSeen }) => {
      handlePresenceUpdate(userId, { online: true, lastSeen });
    });
    socket.on('user:offline', ({ userId, lastSeen }) => {
      handlePresenceUpdate(userId, { online: false, lastSeen });
    });
    socket.on('typing', ({ conversationId, userId, isTyping }) => {
      if (!conversationId || userId === currentUserId) {
        return;
      }
      updateTypingState(conversationId, Boolean(isTyping));
      if (isTyping) {
        scheduleTypingCleanup(conversationId);
      }
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  };

  useEffect(() => {
    destroyedRef.current = false;
    if (!currentUserId) {
      return undefined;
    }
    initializeData();
    return () => {
      destroyedRef.current = true;
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }
    const cleanup = initializeSocket();
    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [token, currentUserId]);

  useEffect(() => {
    if (!initialParticipantId || initialParticipantHandledRef.current || loadingConversations || initializationError) {
      return;
    }
    initialParticipantHandledRef.current = true;
    openConversationWithUser(initialParticipantId).catch(() => {
      /* toast already handled */
    });
  }, [initialParticipantId, loadingConversations, initializationError]);

  useEffect(() => () => {
    typingTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    typingTimeoutsRef.current.clear();
  }, []);

  const retryInitialization = () => {
    loadedConversationsRef.current.clear();
    setMessagesByConversation({});
    setConversations([]);
    initializeData();
  };

  const contextValue = useMemo(
    () => ({
      currentUserId,
      conversations,
      messagesByConversation,
      activeConversationId,
      selectConversation,
      openConversationWithUser,
      sendMessage,
      loadMessages,
      loadingConversations,
      loadingMessages,
      socketConnected,
      followingUsers,
      presenceMap,
      typingMap,
      initializationError,
      retryInitialization,
    }),
    [
      currentUserId,
      conversations,
      messagesByConversation,
      activeConversationId,
      loadingConversations,
      loadingMessages,
      socketConnected,
      followingUsers,
      presenceMap,
      typingMap,
      initializationError,
    ]
  );

  return <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
