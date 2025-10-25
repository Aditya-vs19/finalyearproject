import express from 'express';
import { uploadSingle } from '../middleware/cloudinaryUpload.js';
import { protect } from '../middleware/authMiddleware.js';

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

export default router;