import express from 'express';
import { uploadSingle } from '../middleware/cloudinaryUpload.js';
import { protect } from '../middleware/authMiddleware.js';
import initializeCommunities from '../utils/initializeCommunities.js';
import User from '../models/User.js';

const router = express.Router();

// Test Cloudinary upload
router.post('/upload-test', protect, uploadSingle('testImage'), (req, res) => {
  console.log('Test upload request:', {
    hasFile: !!req.file,
    hasUploadedFile: !!req.uploadedFile,
    file: req.file,
    uploadedFile: req.uploadedFile
  });

  if (req.file || req.uploadedFile) {
    const uploadedFile = req.uploadedFile || req.file;
    const imageUrl = uploadedFile?.url || uploadedFile?.path;
    
    res.json({
      success: true,
      message: 'Test upload successful',
      file: req.file,
      uploadedFile: req.uploadedFile,
      imageUrl,
      storage: req.uploadedFile?.storage || 'unknown'
    });
  } else {
    res.status(400).json({
      success: false,
      message: 'No file uploaded'
    });
  }
});

// Seed communities endpoint (for production setup)
router.get('/seed-communities', async (req, res) => {
  try {
    console.log('Seeding communities...');
    await initializeCommunities();
    res.json({
      success: true,
      message: 'Communities seeded successfully'
    });
  } catch (error) {
    console.error('Seeding error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to seed communities',
      error: error.message
    });
  }
});

// Check OTP for debugging (production only)
router.get('/check-otp/:email', async (req, res) => {
  if (process.env.NODE_ENV !== 'production') {
    return res.status(403).json({ message: 'Only available in production' });
  }
  
  try {
    const { email } = req.params;
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({
      email: user.email,
      hasOTP: !!user.otp,
      otp: user.otp,
      otpExpires: user.otpExpires,
      isVerified: user.isVerified,
      otpExpired: user.otpExpires ? new Date() > user.otpExpires : null
    });
  } catch (error) {
    res.status(500).json({ message: 'Error checking OTP', error: error.message });
  }
});

export default router;