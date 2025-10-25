/**
 * Image Error Handler Tests
 * Tests for comprehensive error handling and fallback mechanisms
 * 
 * Requirements: 2.4, 3.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import imageErrorHandler, { 
  ImageErrorHandler, 
  ImageUploadError, 
  CloudinaryUnavailableError, 
  RetryExhaustedError 
} from '../../services/imageErrorHandler.js';

describe('ImageErrorHandler', () => {
  let handler;
  let mockCloudinaryService;

  beforeEach(() => {
    handler = new ImageErrorHandler();
    
    // Mock Cloudinary service
    mockCloudinaryService = {
      isReady: vi.fn(() => true),
      testConnection: vi.fn(() => Promise.resolve(true)),
      uploadImage: vi.fn()
    };

    // Reset configuration
    handler.configureRetry({
      maxRetries: 3,
      baseDelay: 100,
      maxDelay: 1000
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Error Classes', () => {
    it('should create ImageUploadError with correct properties', () => {
      const error = new ImageUploadError('Test error', 'TEST_ERROR', { detail: 'test' });
      
      expect(error.name).toBe('ImageUploadError');
      expect(error.message).toBe('Test error');
      expect(error.errorCode).toBe('TEST_ERROR');
      expect(error.details.detail).toBe('test');
      expect(error.timestamp).toBeDefined();
    });

    it('should create CloudinaryUnavailableError with original error', () => {
      const originalError = new Error('Connection failed');
      const error = new CloudinaryUnavailableError(originalError, { extra: 'info' });
      
      expect(error.name).toBe('ImageUploadError');
      expect(error.errorCode).toBe('CLOUDINARY_UNAVAILABLE');
      expect(error.details.originalError).toBe('Connection failed');
      expect(error.details.extra).toBe('info');
    });

    it('should create RetryExhaustedError with attempt information', () => {
      const lastError = new Error('Final attempt failed');
      const error = new RetryExhaustedError(3, lastError, { operation: 'upload' });
      
      expect(error.errorCode).toBe('RETRY_EXHAUSTED');
      expect(error.details.attempts).toBe(3);
      expect(error.details.lastError).toBe('Final attempt failed');
      expect(error.details.operation).toBe('upload');
    });
  });

  describe('Retry Logic', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      
      const result = await handler.executeWithRetry(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValue('success');
      
      const result = await handler.executeWithRetry(operation, { baseDelay: 10 });
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should exhaust retries and throw RetryExhaustedError', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Always fails'));
      
      await expect(
        handler.executeWithRetry(operation, { maxRetries: 2, baseDelay: 10 })
      ).rejects.toThrow(RetryExhaustedError);
      
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-retryable errors', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Invalid credentials'));
      
      await expect(
        handler.executeWithRetry(operation, { baseDelay: 10 })
      ).rejects.toThrow('Invalid credentials');
      
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should identify non-retryable errors correctly', () => {
      const retryableError = new Error('Network timeout');
      const nonRetryableError = new Error('Invalid credentials');
      const forbiddenError = new Error('Forbidden access');
      
      expect(handler.isNonRetryableError(retryableError)).toBe(false);
      expect(handler.isNonRetryableError(nonRetryableError)).toBe(true);
      expect(handler.isNonRetryableError(forbiddenError)).toBe(true);
    });

    it('should apply exponential backoff with jitter', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');
      
      const startTime = Date.now();
      await handler.executeWithRetry(operation, { 
        baseDelay: 100, 
        maxDelay: 500 
      });
      const endTime = Date.now();
      
      // Should have waited at least for the delays (100ms + 200ms minimum)
      expect(endTime - startTime).toBeGreaterThan(250);
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('Fallback Storage', () => {
    it('should create fallback storage configuration', () => {
      const storage = handler.createFallbackStorage();
      
      expect(storage).toBeDefined();
      expect(typeof storage.destination).toBe('function');
      expect(typeof storage.filename).toBe('function');
    });

    it('should save file to local fallback storage', async () => {
      // Mock fs operations
      const mockMkdir = vi.spyOn(fs, 'mkdir').mockResolvedValue();
      const mockWriteFile = vi.spyOn(fs, 'writeFile').mockResolvedValue();
      const mockStat = vi.spyOn(fs, 'stat').mockResolvedValue({ size: 1024 });

      const file = {
        buffer: Buffer.from('test image data'),
        originalname: 'test.jpg',
        size: 1024
      };

      const result = await handler.saveToLocalFallback(file);

      expect(result.filename).toMatch(/^fallback_\d+_[a-z0-9]+\.jpg$/);
      expect(result.url).toContain('/uploads/fallback/');
      expect(result.size).toBe(1024);
      expect(mockMkdir).toHaveBeenCalled();
      expect(mockWriteFile).toHaveBeenCalled();

      // Restore mocks
      mockMkdir.mockRestore();
      mockWriteFile.mockRestore();
      mockStat.mockRestore();
    });

    it('should handle fallback storage failure', async () => {
      const mockMkdir = vi.spyOn(fs, 'mkdir').mockRejectedValue(new Error('Permission denied'));

      const file = {
        buffer: Buffer.from('test image data'),
        originalname: 'test.jpg'
      };

      await expect(handler.saveToLocalFallback(file)).rejects.toThrow(ImageUploadError);

      mockMkdir.mockRestore();
    });
  });

  describe('Upload with Fallback', () => {
    it('should use Cloudinary when available', async () => {
      const mockUpload = vi.fn().mockResolvedValue({
        url: 'https://cloudinary.com/image.jpg',
        publicId: 'test123'
      });

      const file = { originalname: 'test.jpg' };
      const result = await handler.handleUploadWithFallback(mockUpload, file);

      expect(result.success).toBe(true);
      expect(result.storage).toBe('cloudinary');
      expect(result.url).toBe('https://cloudinary.com/image.jpg');
      expect(mockUpload).toHaveBeenCalledWith(file, {});
    });

    it('should fallback to local storage when Cloudinary fails', async () => {
      const mockUpload = vi.fn().mockRejectedValue(new Error('Cloudinary error'));
      
      // Mock fallback storage
      const mockSaveToLocal = vi.spyOn(handler, 'saveToLocalFallback')
        .mockResolvedValue({
          url: 'http://localhost:5000/uploads/fallback/test.jpg',
          path: '/path/to/fallback/test.jpg'
        });

      const file = { originalname: 'test.jpg' };
      const result = await handler.handleUploadWithFallback(mockUpload, file);

      expect(result.success).toBe(true);
      expect(result.storage).toBe('local_fallback');
      expect(result.requiresMigration).toBe(true);
      expect(result.fallbackReason).toBe('Cloudinary error');

      mockSaveToLocal.mockRestore();
    });

    it('should fail when both Cloudinary and fallback fail', async () => {
      const mockUpload = vi.fn().mockRejectedValue(new Error('Cloudinary error'));
      const mockSaveToLocal = vi.spyOn(handler, 'saveToLocalFallback')
        .mockRejectedValue(new Error('Fallback error'));

      const file = { originalname: 'test.jpg' };

      await expect(
        handler.handleUploadWithFallback(mockUpload, file)
      ).rejects.toThrow(ImageUploadError);

      mockSaveToLocal.mockRestore();
    });

    it('should not use fallback when disabled', async () => {
      handler.setFallbackEnabled(false);
      const mockUpload = vi.fn().mockRejectedValue(new Error('Cloudinary error'));

      const file = { originalname: 'test.jpg' };

      await expect(
        handler.handleUploadWithFallback(mockUpload, file)
      ).rejects.toThrow(CloudinaryUnavailableError);
    });
  });

  describe('Health Check', () => {
    it('should return healthy status when service is ready and connected', async () => {
      const result = await handler.checkCloudinaryHealth(mockCloudinaryService);

      expect(result.healthy).toBe(true);
      expect(result.reason).toBe('Service healthy');
      expect(result.canRetry).toBe(false);
    });

    it('should return unhealthy when service is not configured', async () => {
      mockCloudinaryService.isReady.mockReturnValue(false);

      const result = await handler.checkCloudinaryHealth(mockCloudinaryService);

      expect(result.healthy).toBe(false);
      expect(result.reason).toBe('Service not configured');
      expect(result.canRetry).toBe(false);
    });

    it('should return unhealthy when connection test fails', async () => {
      mockCloudinaryService.testConnection.mockResolvedValue(false);

      const result = await handler.checkCloudinaryHealth(mockCloudinaryService);

      expect(result.healthy).toBe(false);
      expect(result.reason).toBe('Connection test failed');
      expect(result.canRetry).toBe(true);
    });

    it('should handle connection test errors', async () => {
      mockCloudinaryService.testConnection.mockRejectedValue(new Error('Network error'));

      const result = await handler.checkCloudinaryHealth(mockCloudinaryService);

      expect(result.healthy).toBe(false);
      expect(result.reason).toBe('Network error');
      expect(result.canRetry).toBe(true);
    });
  });

  describe('Error Response Creation', () => {
    it('should create CloudinaryUnavailableError response', () => {
      const error = new CloudinaryUnavailableError(new Error('Service down'));
      const response = handler.createErrorResponse(error);

      expect(response.success).toBe(false);
      expect(response.error).toBe('CLOUDINARY_UNAVAILABLE');
      expect(response.userMessage).toContain('temporarily unavailable');
      expect(response.fallbackUsed).toBe(true);
    });

    it('should create RetryExhaustedError response', () => {
      const error = new RetryExhaustedError(3, new Error('Final error'));
      const response = handler.createErrorResponse(error);

      expect(response.success).toBe(false);
      expect(response.error).toBe('UPLOAD_FAILED_AFTER_RETRIES');
      expect(response.userMessage).toContain('tried multiple times');
    });

    it('should create generic error response', () => {
      const error = new Error('Unknown error');
      const response = handler.createErrorResponse(error);

      expect(response.success).toBe(false);
      expect(response.error).toBe('UNKNOWN_ERROR');
      expect(response.userMessage).toContain('Something went wrong');
    });

    it('should include context in error response', () => {
      const error = new Error('Test error');
      const context = { userId: '123', operation: 'upload' };
      const response = handler.createErrorResponse(error, context);

      expect(response.userId).toBe('123');
      expect(response.operation).toBe('upload');
    });
  });

  describe('Configuration', () => {
    it('should configure retry settings', () => {
      handler.configureRetry({
        maxRetries: 5,
        baseDelay: 200,
        maxDelay: 2000
      });

      expect(handler.maxRetries).toBe(5);
      expect(handler.baseDelay).toBe(200);
      expect(handler.maxDelay).toBe(2000);
    });

    it('should enforce retry limits', () => {
      handler.configureRetry({
        maxRetries: 15, // Should be capped at 10
        baseDelay: 50   // Should be increased to 100
      });

      expect(handler.maxRetries).toBe(10);
      expect(handler.baseDelay).toBe(100);
    });

    it('should enable and disable fallback', () => {
      expect(handler.fallbackEnabled).toBe(true);

      handler.setFallbackEnabled(false);
      expect(handler.fallbackEnabled).toBe(false);

      handler.setFallbackEnabled(true);
      expect(handler.fallbackEnabled).toBe(true);
    });
  });

  describe('User-Friendly Messages', () => {
    it('should return appropriate message for each error code', () => {
      const testCases = [
        ['CLOUDINARY_UNAVAILABLE', 'temporarily unavailable'],
        ['RETRY_EXHAUSTED', 'tried multiple times'],
        ['FILE_TOO_LARGE', 'too large'],
        ['INVALID_FILE_TYPE', 'valid image file'],
        ['UNKNOWN_CODE', 'error occurred while uploading']
      ];

      testCases.forEach(([code, expectedText]) => {
        const message = handler.getUserFriendlyMessage(code);
        expect(message.toLowerCase()).toContain(expectedText);
      });
    });
  });
});

describe('Singleton Instance', () => {
  it('should export a singleton instance', () => {
    expect(imageErrorHandler).toBeInstanceOf(ImageErrorHandler);
    expect(imageErrorHandler.maxRetries).toBeDefined();
    expect(imageErrorHandler.fallbackEnabled).toBeDefined();
  });

  it('should maintain configuration across imports', () => {
    imageErrorHandler.configureRetry({ maxRetries: 7 });
    expect(imageErrorHandler.maxRetries).toBe(7);
  });
});