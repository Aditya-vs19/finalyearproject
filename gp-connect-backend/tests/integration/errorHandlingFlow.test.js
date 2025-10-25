/**
 * Error Handling Flow Integration Tests
 * Tests for complete error handling and fallback mechanisms
 * 
 * Requirements: 2.4, 3.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import uploadSingle from '../../middleware/cloudinaryUpload.js';
import imageErrorHandler from '../../services/imageErrorHandler.js';
import cloudinaryService from '../../services/cloudinaryService.js';

// Create test app
const createTestApp = () => {
  const app = express();
  
  app.use(express.json());
  
  // Test upload endpoint
  app.post('/test-upload', uploadSingle('image'), (req, res) => {
    if (req.uploadedFile) {
      res.json({
        success: true,
        file: req.uploadedFile
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
  });

  // Error handling middleware
  app.use((error, req, res, next) => {
    const errorResponse = imageErrorHandler.createErrorResponse(error);
    res.status(error.status || 500).json(errorResponse);
  });

  return app;
};

describe('Error Handling Flow Integration', () => {
  let app;
  let testImagePath;

  beforeEach(async () => {
    app = createTestApp();
    
    // Create test image file
    testImagePath = path.join(process.cwd(), 'test-image.jpg');
    await fs.writeFile(testImagePath, Buffer.from('fake image data'));
    
    // Reset error handler configuration
    imageErrorHandler.configureRetry({
      maxRetries: 2,
      baseDelay: 10,
      maxDelay: 100
    });
    imageErrorHandler.setFallbackEnabled(true);
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.unlink(testImagePath);
    } catch (error) {
      // File might not exist
    }
    
    vi.clearAllMocks();
  });

  describe('Successful Upload Flow', () => {
    it('should upload successfully when Cloudinary is available', async () => {
      // Mock successful Cloudinary upload
      const mockUpload = vi.spyOn(cloudinaryService, 'uploadImage')
        .mockResolvedValue({
          success: true,
          storage: 'cloudinary',
          url: 'https://cloudinary.com/test.jpg',
          publicId: 'test123'
        });

      const response = await request(app)
        .post('/test-upload')
        .attach('image', testImagePath);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.file.storage).toBe('cloudinary');

      mockUpload.mockRestore();
    });
  });

  describe('Cloudinary Failure with Fallback', () => {
    it('should fallback to local storage when Cloudinary fails', async () => {
      // Mock Cloudinary failure
      const mockUpload = vi.spyOn(cloudinaryService, 'uploadImage')
        .mockRejectedValue(new Error('Cloudinary service unavailable'));

      // Mock successful fallback
      const mockSaveToLocal = vi.spyOn(imageErrorHandler, 'saveToLocalFallback')
        .mockResolvedValue({
          url: 'http://localhost:5000/uploads/fallback/test.jpg',
          path: '/path/to/fallback/test.jpg'
        });

      const response = await request(app)
        .post('/test-upload')
        .attach('image', testImagePath);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.file.storage).toBe('local_fallback');
      expect(response.body.file.requiresMigration).toBe(true);

      mockUpload.mockRestore();
      mockSaveToLocal.mockRestore();
    });
  });

  describe('Complete Upload Failure', () => {
    it('should return error when both Cloudinary and fallback fail', async () => {
      // Mock Cloudinary failure
      const mockUpload = vi.spyOn(cloudinaryService, 'uploadImage')
        .mockRejectedValue(new Error('Cloudinary service unavailable'));

      // Mock fallback failure
      const mockSaveToLocal = vi.spyOn(imageErrorHandler, 'saveToLocalFallback')
        .mockRejectedValue(new Error('Fallback storage full'));

      const response = await request(app)
        .post('/test-upload')
        .attach('image', testImagePath);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('COMPLETE_UPLOAD_FAILURE');

      mockUpload.mockRestore();
      mockSaveToLocal.mockRestore();
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed uploads and eventually succeed', async () => {
      let attemptCount = 0;
      const mockUpload = vi.spyOn(cloudinaryService, 'uploadImage')
        .mockImplementation(() => {
          attemptCount++;
          if (attemptCount < 2) {
            return Promise.reject(new Error('Temporary network error'));
          }
          return Promise.resolve({
            success: true,
            storage: 'cloudinary',
            url: 'https://cloudinary.com/test.jpg',
            publicId: 'test123'
          });
        });

      const response = await request(app)
        .post('/test-upload')
        .attach('image', testImagePath);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(attemptCount).toBe(2); // Failed once, succeeded on retry

      mockUpload.mockRestore();
    });

    it('should exhaust retries and fallback to local storage', async () => {
      const mockUpload = vi.spyOn(cloudinaryService, 'uploadImage')
        .mockRejectedValue(new Error('Persistent network error'));

      const mockSaveToLocal = vi.spyOn(imageErrorHandler, 'saveToLocalFallback')
        .mockResolvedValue({
          url: 'http://localhost:5000/uploads/fallback/test.jpg',
          path: '/path/to/fallback/test.jpg'
        });

      const response = await request(app)
        .post('/test-upload')
        .attach('image', testImagePath);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.file.storage).toBe('local_fallback');

      mockUpload.mockRestore();
      mockSaveToLocal.mockRestore();
    });
  });

  describe('File Validation Errors', () => {
    it('should reject files that are too large', async () => {
      // Create a large test file (simulate > 10MB)
      const largeImagePath = path.join(process.cwd(), 'large-test-image.jpg');
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
      await fs.writeFile(largeImagePath, largeBuffer);

      const response = await request(app)
        .post('/test-upload')
        .attach('image', largeImagePath);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('FILE_TOO_LARGE');

      // Clean up
      await fs.unlink(largeImagePath);
    });

    it('should reject invalid file types', async () => {
      // Create a text file
      const textFilePath = path.join(process.cwd(), 'test.txt');
      await fs.writeFile(textFilePath, 'This is not an image');

      const response = await request(app)
        .post('/test-upload')
        .attach('image', textFilePath);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('INVALID_FILE_TYPE');

      // Clean up
      await fs.unlink(textFilePath);
    });
  });

  describe('Service Availability Checks', () => {
    it('should check service availability before upload', async () => {
      // Mock service as unavailable
      const mockGetHealthStatus = vi.spyOn(cloudinaryService, 'getHealthStatus')
        .mockReturnValue({
          isHealthy: false,
          isConfigured: false
        });

      // Disable fallback
      imageErrorHandler.setFallbackEnabled(false);

      const response = await request(app)
        .post('/test-upload')
        .attach('image', testImagePath);

      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('SERVICE_UNAVAILABLE');

      mockGetHealthStatus.mockRestore();
    });

    it('should use fallback when Cloudinary is unhealthy but configured', async () => {
      // Mock service as configured but unhealthy
      const mockGetHealthStatus = vi.spyOn(cloudinaryService, 'getHealthStatus')
        .mockReturnValue({
          isHealthy: false,
          isConfigured: true
        });

      const mockSaveToLocal = vi.spyOn(imageErrorHandler, 'saveToLocalFallback')
        .mockResolvedValue({
          url: 'http://localhost:5000/uploads/fallback/test.jpg',
          path: '/path/to/fallback/test.jpg'
        });

      const response = await request(app)
        .post('/test-upload')
        .attach('image', testImagePath);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.file.storage).toBe('local_fallback');

      mockGetHealthStatus.mockRestore();
      mockSaveToLocal.mockRestore();
    });
  });

  describe('Error Response Format', () => {
    it('should return consistent error response format', async () => {
      const mockUpload = vi.spyOn(cloudinaryService, 'uploadImage')
        .mockRejectedValue(new Error('Test error'));

      const mockSaveToLocal = vi.spyOn(imageErrorHandler, 'saveToLocalFallback')
        .mockRejectedValue(new Error('Fallback error'));

      const response = await request(app)
        .post('/test-upload')
        .attach('image', testImagePath);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('userMessage');

      mockUpload.mockRestore();
      mockSaveToLocal.mockRestore();
    });

    it('should include helpful user messages', async () => {
      const mockUpload = vi.spyOn(cloudinaryService, 'uploadImage')
        .mockRejectedValue(new Error('Network timeout'));

      const mockSaveToLocal = vi.spyOn(imageErrorHandler, 'saveToLocalFallback')
        .mockRejectedValue(new Error('Disk full'));

      const response = await request(app)
        .post('/test-upload')
        .attach('image', testImagePath);

      expect(response.body.userMessage).toBeDefined();
      expect(typeof response.body.userMessage).toBe('string');
      expect(response.body.userMessage.length).toBeGreaterThan(0);

      mockUpload.mockRestore();
      mockSaveToLocal.mockRestore();
    });
  });

  describe('Upload Metadata', () => {
    it('should include comprehensive upload metadata', async () => {
      const mockUpload = vi.spyOn(cloudinaryService, 'uploadImage')
        .mockResolvedValue({
          success: true,
          storage: 'cloudinary',
          url: 'https://cloudinary.com/test.jpg',
          publicId: 'test123'
        });

      const response = await request(app)
        .post('/test-upload')
        .attach('image', testImagePath);

      expect(response.body.file).toHaveProperty('url');
      expect(response.body.file).toHaveProperty('originalName');
      expect(response.body.file).toHaveProperty('size');
      expect(response.body.file).toHaveProperty('mimetype');
      expect(response.body.file).toHaveProperty('storage');
      expect(response.body.file).toHaveProperty('uploadMode');
      expect(response.body.file).toHaveProperty('timestamp');

      mockUpload.mockRestore();
    });

    it('should include fallback-specific metadata when using fallback', async () => {
      const mockUpload = vi.spyOn(cloudinaryService, 'uploadImage')
        .mockRejectedValue(new Error('Cloudinary error'));

      const mockSaveToLocal = vi.spyOn(imageErrorHandler, 'saveToLocalFallback')
        .mockResolvedValue({
          url: 'http://localhost:5000/uploads/fallback/test.jpg',
          path: '/path/to/fallback/test.jpg'
        });

      const response = await request(app)
        .post('/test-upload')
        .attach('image', testImagePath);

      expect(response.body.file.storage).toBe('local_fallback');
      expect(response.body.file.requiresMigration).toBe(true);
      expect(response.body.file.fallbackReason).toBeDefined();

      mockUpload.mockRestore();
      mockSaveToLocal.mockRestore();
    });
  });

  describe('Graceful Degradation', () => {
    it('should continue operating when Cloudinary is partially available', async () => {
      // Mock intermittent Cloudinary failures
      let callCount = 0;
      const mockUpload = vi.spyOn(cloudinaryService, 'uploadImage')
        .mockImplementation(() => {
          callCount++;
          if (callCount % 2 === 0) {
            return Promise.resolve({
              success: true,
              storage: 'cloudinary',
              url: 'https://cloudinary.com/test.jpg',
              publicId: 'test123'
            });
          } else {
            return Promise.reject(new Error('Intermittent error'));
          }
        });

      const mockSaveToLocal = vi.spyOn(imageErrorHandler, 'saveToLocalFallback')
        .mockResolvedValue({
          url: 'http://localhost:5000/uploads/fallback/test.jpg',
          path: '/path/to/fallback/test.jpg'
        });

      // First request should fail and use fallback
      const response1 = await request(app)
        .post('/test-upload')
        .attach('image', testImagePath);

      expect(response1.status).toBe(200);
      expect(response1.body.file.storage).toBe('local_fallback');

      // Second request should succeed with Cloudinary
      const response2 = await request(app)
        .post('/test-upload')
        .attach('image', testImagePath);

      expect(response2.status).toBe(200);
      expect(response2.body.file.storage).toBe('cloudinary');

      mockUpload.mockRestore();
      mockSaveToLocal.mockRestore();
    });
  });
});