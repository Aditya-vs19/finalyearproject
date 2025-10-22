import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getUserProfile,
  updateUserProfile,
  uploadProfilePicture,
  changePassword,
  getCurrentUserProfile,
  getFollowingList,
  followUser,
  unfollowUser,
  searchUsers,
  testUsers,
  upload,
} from '../controllers/profileController.js';

const router = express.Router();

// Get current user profile
router.get('/me', protect, getCurrentUserProfile);
router.get('/me/following', protect, getFollowingList);

// Search users (must be before /:id route)
router.get('/search', protect, searchUsers);

// Test endpoint to check users in database
router.get('/test-users', protect, testUsers);

// Get user profile by ID
router.get('/:id', protect, getUserProfile);

// Update user profile
router.put('/:id', protect, updateUserProfile);

// Upload profile picture
router.post('/:id/upload', protect, upload.single('profilePic'), uploadProfilePicture);

// Change password
router.put('/:id/password', protect, changePassword);

// Follow/Unfollow users
router.post('/:id/follow', protect, followUser);
router.post('/:id/unfollow', protect, unfollowUser);

export default router;
