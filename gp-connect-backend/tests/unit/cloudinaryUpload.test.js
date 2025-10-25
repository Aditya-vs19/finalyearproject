import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleUploadError, checkCloudinaryConfig, processUploadedFile } from '../../middleware/cloudinaryUpload.js';

// Mock cloudinary service
vi.mock('../../services/cloudinaryService.js', () => ({
  default: {
    configure: vi.fn(),
    isReady: vi.fn(),
    cloudinary: {
      config: vi.fn()
    }
  }
}));

// Mock multer
vi.mock('multer', () => ({
  default: vi.fn(() => ({
    single: vi.fn(),
    array: vi.fn()
  }))
}));

// Create a mock MulterError class for testing
class MockMulterError extends Error {
  constructor(code, field) {
    super(`Multer error: ${code}`);
    this.code = code;
    this.field = field;
    this.name = 'MulterError';
  }
}

// Mock multer-storage-cloudinary
vi.mock('multer-storage-cloudinary', () => ({
  CloudinaryStorage: vi.fn()
}));

describe('Cloudinary Upload Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  describe('handleUploadError', () => {
    it('should handle LIMIT_FILE_SIZE error', () => {
      const error = new MockMulterError('LIMIT_FILE_SIZE');
      
      handleUploadError(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'File too large. Maximum size is 10MB.',
        error: 'FILE_TOO_LARGE'
      });
    });

    it('should handle LIMIT_FILE_COUNT error', () => {
      const error = new MockMulterError('LIMIT_FILE_COUNT');
      
      handleUploadError(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Too many files. Only one file is allowed.',
        error: 'TOO_MANY_FILES'
      });
    });

    it('should handle LIMIT_UNEXPECTED_FILE error', () => {
      const error = new MockMulterError('LIMIT_UNEXPECTED_FILE');
      
      handleUploadError(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Unexpected field name for file upload.',
        error: 'UNEXPECTED_FIELD'
      });
    });

    it('should handle generic MulterError', () => {
      const error = new MockMulterError('UNKNOWN_ERROR');
      
      handleUploadError(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'File upload error.',
        error: 'UNKNOWN_ERROR'
      });
    });

    it('should handle file type validation errors', () => {
      const error = new Error('Only image files are allowed');
      
      handleUploadError(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Only image files are allowed',
        error: 'INVALID_FILE_TYPE'
      });
    });

    it('should handle invalid image type errors', () => {
      const error = new Error('Invalid image type. Only JPEG, PNG, GIF, and WebP are allowed.');
      
      handleUploadError(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid image type. Only JPEG, PNG, GIF, and WebP are allowed.',
        error: 'INVALID_FILE_TYPE'
      });
    });

    it('should handle Cloudinary errors', () => {
      const error = new Error('Cloudinary upload failed');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      handleUploadError(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Cloud storage error. Please try again.',
        error: 'CLOUD_STORAGE_ERROR'
      });
      expect(consoleSpy).toHaveBeenCalledWith('Cloudinary upload error:', error);
      
      consoleSpy.mockRestore();
    });

    it('should handle generic errors', () => {
      const error = new Error('Generic error');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      handleUploadError(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Upload failed. Please try again.',
        error: 'UPLOAD_ERROR'
      });
      expect(consoleSpy).toHaveBeenCalledWith('Upload error:', error);
      
      consoleSpy.mockRestore();
    });
  });

  describe('checkCloudinaryConfig', () => {
    it('should call next() when Cloudinary is ready', async () => {
      const cloudinaryService = (await import('../../services/cloudinaryService.js')).default;
      cloudinaryService.isReady.mockReturnValue(true);
      
      checkCloudinaryConfig(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return error when Cloudinary is not ready', async () => {
      const cloudinaryService = (await import('../../services/cloudinaryService.js')).default;
      cloudinaryService.isReady.mockReturnValue(false);
      
      checkCloudinaryConfig(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Cloud storage service is not available. Please try again later.',
        error: 'SERVICE_UNAVAILABLE'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('processUploadedFile', () => {
    it('should process uploaded file information', () => {
      req.file = {
        path: 'https://res.cloudinary.com/test/image/upload/test.jpg',
        filename: 'gp-connect-posts/test123',
        originalname: 'test.jpg',
        size: 50000,
        mimetype: 'image/jpeg'
      };
      
      processUploadedFile(req, res, next);
      
      expect(req.uploadedFile).toEqual({
        url: 'https://res.cloudinary.com/test/image/upload/test.jpg',
        publicId: 'gp-connect-posts/test123',
        originalName: 'test.jpg',
        size: 50000,
        mimetype: 'image/jpeg'
      });
      expect(next).toHaveBeenCalled();
    });

    it('should call next() when no file is uploaded', () => {
      req.file = undefined;
      
      processUploadedFile(req, res, next);
      
      expect(req.uploadedFile).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });
  });
});