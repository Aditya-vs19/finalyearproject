import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.js';

const toObjectId = (value) => {
  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }
  return new mongoose.Types.ObjectId(value);
};

const sortPair = (a, b) => {
  const [first, second] = [a, b].map((id) => id.toString()).sort();
  return [toObjectId(first), toObjectId(second)];
};

export const ensureMutualFollowing = async (currentUserId, otherUserId) => {
  if (currentUserId.toString() === otherUserId.toString()) {
    const error = new Error('Cannot start a conversation with yourself');
    error.statusCode = 400;
    throw error;
  }

  const [currentUser, otherUser] = await Promise.all([
    User.findById(currentUserId).select('following'),
    User.findById(otherUserId).select('fullName profilePic followers following isVerified'),
  ]);

  if (!currentUser || !otherUser) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const currentFollowsOther = currentUser.following.some(
    (id) => id.toString() === otherUserId.toString()
  );
  const otherFollowsCurrent = otherUser.following.some(
    (id) => id.toString() === currentUserId.toString()
  );

  if (!currentFollowsOther || !otherFollowsCurrent) {
    const error = new Error('Both users must follow each other to chat');
    error.statusCode = 403;
    throw error;
  }

  return otherUser;
};

export const findConversationByMembers = async (userId, otherUserId) => {
  const members = sortPair(userId, otherUserId);
  return Conversation.findOne({ members });
};

export const getOrCreateConversation = async (userId, otherUserId) => {
  const members = sortPair(userId, otherUserId);
  const existing = await Conversation.findOne({ members });
  if (existing) {
    return existing;
  }
  return Conversation.create({ members, lastMessage: null });
};

export const populateConversationMembers = (conversation) =>
  conversation.populate('members', 'fullName profilePic');

export const ensureConversationMembership = async (conversationId, userId) => {
  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    const error = new Error('Invalid conversation ID');
    error.statusCode = 400;
    throw error;
  }

  const conversation = await Conversation.findById(conversationId).populate(
    'members',
    'fullName profilePic'
  );

  if (!conversation) {
    const error = new Error('Conversation not found');
    error.statusCode = 404;
    throw error;
  }

  const isMember = conversation.members.some(
    (member) => member._id.toString() === userId.toString()
  );

  if (!isMember) {
    const error = new Error('Not authorized to access this conversation');
    error.statusCode = 403;
    throw error;
  }

  return conversation;
};

export const persistEncryptedMessage = async ({
  conversation,
  senderId,
  encryptedText,
}) => {
  if (!encryptedText || typeof encryptedText !== 'string') {
    const error = new Error('encryptedText is required');
    error.statusCode = 400;
    throw error;
  }

  const trimmed = encryptedText.trim();
  if (!trimmed) {
    const error = new Error('encryptedText cannot be empty');
    error.statusCode = 400;
    throw error;
  }

  // Create message and update conversation in parallel for better performance
  const [message] = await Promise.all([
    Message.create({
      conversationId: conversation._id,
      sender: senderId,
      encryptedText: trimmed,
    }),
    // Update conversation lastMessage and timestamp
    conversation.updateOne({
      lastMessage: trimmed,
      updatedAt: new Date(),
    })
  ]);

  await message.populate('sender', 'fullName profilePic');

  return message;
};

export const buildConversationSummary = (conversation, currentUserId) => {
  const members = Array.isArray(conversation.members)
    ? conversation.members
    : [];

  const otherUser = members.find((member) => {
    const memberId = member?._id || member;
    return memberId?.toString() !== currentUserId.toString();
  });

  return {
    _id: conversation._id,
    members: members.map((member) => (member?._id ? member._id : member)),
    otherUser: otherUser
      ? {
          _id: otherUser._id || otherUser,
          fullName: otherUser.fullName || null,
          profilePic: otherUser.profilePic || null,
        }
      : null,
    lastMessage: conversation.lastMessage,
    updatedAt: conversation.updatedAt,
  };
};

export const formatMessageForResponse = (message) => ({
  _id: message._id,
  conversationId: message.conversationId,
  sender: {
    _id: message.sender?._id || message.sender,
    fullName: message.sender?.fullName || null,
    profilePic: message.sender?.profilePic || null,
  },
  encryptedText: message.encryptedText,
  createdAt: message.createdAt,
  updatedAt: message.updatedAt,
});

export const listConversationMessages = async ({ conversationId, limit = 200 }) => {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const messages = await Message.find({ conversationId })
    .sort({ createdAt: 1 })
    .limit(safeLimit)
    .populate('sender', 'fullName profilePic');
  return messages.map(formatMessageForResponse);
};

export const getMemberIds = (conversation) =>
  conversation.members.map((member) => member._id?.toString() || member.toString());
