import asyncHandler from 'express-async-handler';
import {
  buildConversationSummary,
  ensureConversationMembership,
  formatMessageForResponse,
  listConversationMessages,
  persistEncryptedMessage,
  populateConversationMembers,
} from '../services/directMessageService.js';

export const getMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;

  if (!conversationId) {
    res.status(400);
    throw new Error('conversationId parameter is required');
  }

  const conversation = await ensureConversationMembership(conversationId, req.user._id);

  const messages = await listConversationMessages({ conversationId: conversation._id });

  res.json({
    conversation: buildConversationSummary(conversation, req.user._id),
    messages,
  });
});

export const createMessage = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { encryptedText } = req.body || {};

  if (!conversationId) {
    res.status(400);
    throw new Error('conversationId parameter is required');
  }

  if (!encryptedText || typeof encryptedText !== 'string') {
    res.status(400);
    throw new Error('encryptedText is required');
  }

  const conversation = await ensureConversationMembership(conversationId, req.user._id);
  await populateConversationMembers(conversation);

  const message = await persistEncryptedMessage({
    conversation,
    senderId: req.user._id,
    encryptedText,
  });

  await populateConversationMembers(conversation);

  const responseMessage = formatMessageForResponse(message);
  const conversationSummary = buildConversationSummary(conversation, req.user._id);

  const chatEmitter = req.app.get('chatEmitter');
  if (chatEmitter?.emitMessage) {
    chatEmitter.emitMessage({
      conversationId: conversation._id.toString(),
      message: responseMessage,
      conversation: conversationSummary,
      members: conversationSummary.members.map((member) => member.toString()),
    });
  }

  res.status(201).json({ message: responseMessage, conversation: conversationSummary });
});
