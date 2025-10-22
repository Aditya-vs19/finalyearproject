import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getConversationWithUser,
  listConversations,
} from '../controllers/conversationController.js';

const router = express.Router();

router.get('/', protect, listConversations);
router.get('/:userId', protect, getConversationWithUser);

export default router;
