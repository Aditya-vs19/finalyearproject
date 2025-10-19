import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  listCommunities,
  getCommunity,
  joinCommunity,
  leaveCommunity,
  getCommunityMessages,
  sendMessage,
} from '../controllers/communityController.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// List all communities
router.get('/', listCommunities);

// Get community details
router.get('/:communityId', getCommunity);

// Join community
router.post('/:communityId/join', joinCommunity);

// Leave community
router.post('/:communityId/leave', leaveCommunity);

// Get community messages
router.get('/:communityId/messages', getCommunityMessages);

// Send message to community
router.post('/:communityId/messages', sendMessage);

export default router;
