import asyncHandler from 'express-async-handler';
import Conversation from '../models/Conversation.js';
import {
  buildConversationSummary,
  ensureMutualFollowing,
  findConversationByMembers,
  getOrCreateConversation,
  populateConversationMembers,
} from '../services/directMessageService.js';

export const listConversations = asyncHandler(async (req, res) => {
  const conversations = await Conversation.find({ members: req.user._id })
    .sort({ updatedAt: -1 })
    .populate('members', 'fullName profilePic');

  const summaries = conversations.map((conversation) =>
    buildConversationSummary(conversation, req.user._id)
  );

  res.json(summaries);
});

export const getConversationWithUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    res.status(400);
    throw new Error('userId parameter is required');
  }

  const otherUser = await ensureMutualFollowing(req.user._id, userId);

  let conversation = await findConversationByMembers(req.user._id, otherUser._id);
  
  if (!conversation) {
    try {
      conversation = await getOrCreateConversation(req.user._id, otherUser._id);
    } catch (createError) {
      // Handle race condition - if another request created it simultaneously
      if (createError.code === 11000) {
        conversation = await findConversationByMembers(req.user._id, otherUser._id);
        if (!conversation) {
          throw createError;
        }
      } else {
        throw createError;
      }
    }
  }

  await populateConversationMembers(conversation);

  res.json(buildConversationSummary(conversation, req.user._id));
});
