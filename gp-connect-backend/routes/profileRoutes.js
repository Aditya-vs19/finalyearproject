import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinaryService from '../services/cloudinaryService.js';
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
} from '../controllers/profileController.js';

const router = express.Router();

// Configure Cloudinary service
try {
  cloudinaryService.configure();
  console.log('✅ Cloudinary configured for profile uploads');
} catch (error) {
  console.error('❌ Failed to configure Cloudinary:', error.message);
}

// Simple Cloudinary storage for profile pictures
const profileStorage = new CloudinaryStorage({
  cloudinary: cloudinaryService.cloudinary,
  params: {
    folder: 'gp-connect-profileimages',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [
      { width: 400, height: 400, crop: 'fill', gravity: 'face' },
      { quality: 'auto', fetch_format: 'auto' }
    ],
    public_id: (req, file) => {
      // Create unique filename with user ID and timestamp
      const uniqueId = `profile_${req.params.id}_${Date.now()}`;
      console.log('🖼️ Creating profile pic with ID:', uniqueId);
      return uniqueId;
    }
  }
});

console.log('📁 Profile storage configured for folder: gp-connect-profileimages');

// Simple multer upload for profile pictures
const profileUpload = multer({
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files allowed'), false);
    }
  }
});

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
router.post('/:id/upload', protect, profileUpload.single('profilePic'), uploadProfilePicture);

// Change password
router.put('/:id/password', protect, changePassword);

// Follow/Unfollow users
router.post('/:id/follow', protect, followUser);
router.post('/:id/unfollow', protect, unfollowUser);

export default router;
