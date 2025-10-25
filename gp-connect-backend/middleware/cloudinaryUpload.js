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

// Configure Cloudinary storage for multer
const cloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinaryService.cloudinary,
  params: {
    folder: 'gp-connect-posts',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [
      { width: 1000, height: 1000, crop: 'limit' },
      { quality: 'auto', fetch_format: 'auto' }
    ],
    resource_type: 'image'
  }
});

// Create fallback storage for when Cloudinary is unavailable
const fallbackStorage = imageErrorHandler.createFallbackStorage();

// Dynamic storage selection based on Cloudinary health
const dynamicStorage = (req, file, cb) => {
  const healthStatus = cloudinaryService.getHealthStatus();
  
  if (healthStatus.isHealthy && healthStatus.isConfigured) {
    // Use Cloudinary storage
    cloudinaryStorage._handleFile(req, file, cb);
  } else {
    console.log('Cloudinary unavailable, using fallback storage');
    // Use fallback local storage
    fallbackStorage._handleFile(req, file, cb);
  }
};

// Main storage configuration
const storage = {
  _handleFile: dynamicStorage,
  _removeFile: (req, file, cb) => {
    // Handle file removal for both storage types
    if (file.cloudinary) {
      cloudinaryStorage._removeFile(req, file, cb);
    } else {
      fallbackStorage._removeFile(req, file, cb);
    }
  }
};

// File filter function for image validation
const fileFilter = (req, file, cb) => {
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

// Configure multer with Cloudinary storage
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit (increased from 5MB for better quality)
    files: 1 // Only allow single file upload
  }
});

// Enhanced error handling middleware for multer errors
const handleUploadError = (error, req, res, next) => {
  // Use image error handler for consistent error responses
  const errorResponse = imageErrorHandler.createErrorResponse(error, {
    operation: 'file_upload',
    userId: req.user?.id,
    filename: req.file?.originalname
  });

  if (error && error.name === 'MulterError') {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          ...errorResponse,
          error: 'FILE_TOO_LARGE',
          message: 'File too large. Maximum size is 10MB.',
          userMessage: 'Your image is too large. Please use an image smaller than 10MB.'
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          ...errorResponse,
          error: 'TOO_MANY_FILES',
          message: 'Too many files. Only one file is allowed.',
          userMessage: 'Please upload only one image at a time.'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          ...errorResponse,
          error: 'UNEXPECTED_FIELD',
          message: 'Unexpected field name for file upload.',
          userMessage: 'Invalid upload format. Please try again.'
        });
      default:
        return res.status(400).json({
          ...errorResponse,
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
      ...errorResponse,
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
  
  return res.status(statusCode).json(errorResponse);
};

// Enhanced middleware to check service availability
const checkServiceAvailability = async (req, res, next) => {
  try {
    const healthStatus = cloudinaryService.getHealthStatus();
    
    // If Cloudinary is not configured, check if fallback is available
    if (!healthStatus.isConfigured) {
      console.log('Cloudinary not configured, checking fallback availability');
      
      if (!imageErrorHandler.fallbackEnabled) {
        return res.status(503).json({
          success: false,
          error: 'SERVICE_UNAVAILABLE',
          message: 'Image upload service is not available',
          userMessage: 'Image upload is temporarily unavailable. Please try again later.',
          details: { cloudinaryConfigured: false, fallbackEnabled: false }
        });
      }
      
      // Fallback is available, continue
      req.uploadMode = 'fallback_only';
      return next();
    }
    
    // Check Cloudinary health if configured
    if (!healthStatus.isHealthy) {
      console.log('Cloudinary unhealthy, will use fallback if available');
      req.uploadMode = imageErrorHandler.fallbackEnabled ? 'fallback_preferred' : 'cloudinary_retry';
    } else {
      req.uploadMode = 'cloudinary_primary';
    }
    
    next();
  } catch (error) {
    console.error('Service availability check failed:', error);
    
    const errorResponse = imageErrorHandler.createErrorResponse(error, {
      operation: 'service_check'
    });
    
    return res.status(503).json(errorResponse);
  }
};

// Single file upload middleware with enhanced error handling
const uploadSingle = (fieldName = 'image') => {
  return [
    checkServiceAvailability,
    upload.single(fieldName),
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
  cloudinaryStorage,
  fallbackStorage
};

export default uploadSingle;