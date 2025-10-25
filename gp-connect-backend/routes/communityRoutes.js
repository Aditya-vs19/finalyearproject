import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { uploadSingle } from '../middleware/cloudinaryUpload.js';
import CommunityAccessMiddleware from '../middleware/communityAccessMiddleware.js';
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

// Join community (with department validation middleware)
router.post('/:communityId/join', CommunityAccessMiddleware.validateCommunityJoin, joinCommunity);

// Leave community
router.post('/:communityId/leave', leaveCommunity);

// Get community messages
router.get('/:communityId/messages', getCommunityMessages);

// Send message to community (text or image) with admin-only posting validation
router.post('/:communityId/messages', uploadSingle('image'), CommunityAccessMiddleware.validateCommunityPost, sendMessage);

export default router;
