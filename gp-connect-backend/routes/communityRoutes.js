import express from 'express';
import multer from 'multer';
import path from 'path';
import { protect } from '../middleware/authMiddleware.js';
import CommunityAccessMiddleware from '../middleware/communityAccessMiddleware.js';
import {
  listCommunities,
  getCommunity,
  joinCommunity,
  leaveCommunity,
  getCommunityMessages,
  sendMessage,
} from '../controllers/communityController.js';

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/community-images/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'community-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

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
router.post('/:communityId/messages', (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'File size too large. Maximum size is 5MB.' });
        }
        return res.status(400).json({ message: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ message: err.message });
    }
    next();
  });
}, CommunityAccessMiddleware.validateCommunityPost, sendMessage);

export default router;
