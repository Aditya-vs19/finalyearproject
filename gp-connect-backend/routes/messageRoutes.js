import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  createMessage,
  getMessages,
} from '../controllers/messageController.js';

const router = express.Router();

router.get('/:conversationId', protect, getMessages);
router.post('/:conversationId', protect, createMessage);

export default router;
