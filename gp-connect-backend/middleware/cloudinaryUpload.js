import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinaryService from '../services/cloudinaryService.js';
import imageErrorHandler from '../services/imageErrorHandler.js';

/**
 * Cloudinary Upload Middleware
 * Replaces local disk storage with Cloudinary cloud storage
 */

// Configure Cloudinary service
try {
  cloudinaryService.configure();
} catch (error) {
  console.error('Failed to configure Cloudinary:', error.message);
}

// Configure Cloudinary storage for multer with dynamic folder support
const createCloudinaryStorage = (folder = 'gp-connect-posts', transformations = null) => {
  const defaultTransformations = [
    { width: 1000, height: 1000, crop: 'limit' },
    { quality: 'auto', fetch_format: 'auto' }
  ];

  return new CloudinaryStorage({
    cloudinary: cloudinaryService.cloudinary,
    params: {
      folder,
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      transformation: transformations || defaultTransformations,
      resource_type: 'image'
    }
  });
};

// Default storage for posts
const cloudinaryStorage = createCloudinaryStorage();

// Profile picture storage with different transformations
const profilePictureStorage = createCloudinaryStorage('gp-connect-profiles', [
  { width: 400, height: 400, crop: 'fill', gravity: 'face' },
  { quality: 'auto', fetch_format: 'auto' }
]);

// File filter function for image validation
const fileFilter = (req, file, cb) => {
  console.log('=== FILE FILTER DEBUG ===');
  console.log('File:', file);
  console.log('Mimetype:', file.mimetype);
  console.log('========================');
  
  // Check if file is an image
  if (file.mimetype.startsWith('image/')) {
    // Additional validation for allowed image types
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image type. Only JPEG, PNG, GIF, and WebP are allowed.'), false);
    }
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

// Create multer instances for different storage types
const createUpload = (storage) => multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Only allow single file upload
  }
});

// Default upload for posts
const upload = createUpload(cloudinaryStorage);

// Profile picture upload
const profileUpload = createUpload(profilePictureStorage);

// Enhanced error handling middleware for multer errors
const handleUploadError = (error, req, res, next) => {
  // If no error, continue
  if (!error) {
    return next();
  }

  console.error('Upload error:', error);

  // Create basic error response
  const baseErrorResponse = {
    success: false,
    timestamp: new Date().toISOString(),
    operation: 'file_upload',
    userId: req.user?.id,
    filename: req.file?.originalname
  };

  if (error && error.name === 'MulterError') {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          ...baseErrorResponse,
          error: 'FILE_TOO_LARGE',
          message: 'File too large. Maximum size is 10MB.',
          userMessage: 'Your image is too large. Please use an image smaller than 10MB.'
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          ...baseErrorResponse,
          error: 'TOO_MANY_FILES',
          message: 'Too many files. Only one file is allowed.',
          userMessage: 'Please upload only one image at a time.'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          ...baseErrorResponse,
          error: 'UNEXPECTED_FIELD',
          message: 'Unexpected field name for file upload.',
          userMessage: 'Invalid upload format. Please try again.'
        });
      default:
        return res.status(400).json({
          ...baseErrorResponse,
          error: error.code || 'MULTER_ERROR',
          message: 'File upload error.',
          userMessage: 'There was a problem with your file upload. Please try again.'
        });
    }
  }
  
  // Handle custom file filter errors
  if (error.message.includes('Only image files are allowed') || 
      error.message.includes('Invalid image type')) {
    return res.status(400).json({
      ...baseErrorResponse,
      error: 'INVALID_FILE_TYPE',
      message: error.message,
      userMessage: 'Please upload a valid image file (JPEG, PNG, GIF, or WebP).'
    });
  }
  
  // Handle Cloudinary and other storage errors
  console.error('Upload error:', error);
  
  // Determine appropriate status code
  const statusCode = error.status || 
    (error.message.includes('Cloudinary') ? 503 : 500);
  
  return res.status(statusCode).json({
    ...baseErrorResponse,
    error: 'UPLOAD_ERROR',
    message: error.message || 'Upload failed',
    userMessage: 'Failed to upload image. Please try again.'
  });
};

// Enhanced middleware to check service availability
const checkServiceAvailability = async (req, res, next) => {
  try {
    // Simple check - if Cloudinary is configured, proceed
    if (cloudinaryService.isConfigured) {
      req.uploadMode = 'cloudinary_primary';
    } else {
      console.log('Cloudinary not configured, using basic upload');
      req.uploadMode = 'basic';
    }
    
    next();
  } catch (error) {
    console.error('Service availability check failed:', error);
    
    // Continue anyway - let multer handle the upload
    req.uploadMode = 'basic';
    next();
  }
};

// Single file upload middleware with enhanced error handling
const uploadSingle = (fieldName = 'image') => {
  console.log('=== UPLOAD SINGLE DEBUG ===');
  console.log('Field name:', fieldName);
  console.log('Using profile upload:', fieldName === 'profilePic');
  console.log('==========================');
  
  // Use profile upload for profile pictures, regular upload for others
  const uploaderInstance = fieldName === 'profilePic' ? profileUpload : upload;
  
  return [
    checkServiceAvailability,
    uploaderInstance.single(fieldName),
    processUploadResult,
    handleUploadError
  ];
};

// Multiple files upload middleware (for future use)
const uploadMultiple = (fieldName = 'images', maxCount = 5) => {
  return [
    checkServiceAvailability,
    upload.array(fieldName, maxCount),
    processUploadResult,
    handleUploadError
  ];
};

// Middleware to process upload results and add metadata
const processUploadResult = (req, res, next) => {
  if (req.file) {
    // Determine storage type and add metadata
    const isCloudinary = req.file.path && req.file.path.includes('cloudinary');
    const isFallback = req.file.path && req.file.path.includes('fallback');
    
    req.uploadedFile = {
      url: req.file.path,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      storage: isCloudinary ? 'cloudinary' : (isFallback ? 'local_fallback' : 'unknown'),
      uploadMode: req.uploadMode,
      timestamp: new Date().toISOString()
    };
    
    // Add Cloudinary-specific metadata if available
    if (isCloudinary && req.file.filename) {
      req.uploadedFile.publicId = req.file.filename;
      req.uploadedFile.cloudinaryUrl = req.file.path;
    }
    
    // Add fallback-specific metadata
    if (isFallback) {
      req.uploadedFile.localPath = req.file.path;
      req.uploadedFile.requiresMigration = true;
      req.uploadedFile.fallbackReason = 'Cloudinary unavailable during upload';
    }
    
    console.log(`File uploaded successfully: ${req.uploadedFile.storage} storage`);
  }
  
  next();
};

export {
  upload,
  uploadSingle,
  uploadMultiple,
  handleUploadError,
  checkServiceAvailability,
  processUploadResult,
  cloudinaryStorage
};

export default uploadSingle;