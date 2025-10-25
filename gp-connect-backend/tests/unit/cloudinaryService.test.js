import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock cloudinary before importing the service
vi.mock('cloudinary', () => ({
  v2: {
    config: vi.fn(),
    uploader: {
      upload: vi.fn(),
      destroy: vi.fn()
    },
    url: vi.fn(),
    api: {
      ping: vi.fn(),
      resources: vi.fn()
    }
  }
}));

import { CloudinaryService } from '../../services/cloudinaryService.js';

// Get the mocked cloudinary instance
const { v2: mockCloudinary } = await import('cloudinary');

// Create service instance with mocked cloudinary
const cloudinaryService = new CloudinaryService(mockCloudinary);

describe('CloudinaryService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset the service configuration state
    cloudinaryService.isConfigured = false;
    
    // Clear all mocks
    vi.clearAllMocks();
    
    // Set up test environment variables
    process.env = {
      ...originalEnv,
      CLOUDINARY_CLOUD_NAME: 'test-cloud',
      CLOUDINARY_API_KEY: 'test-key',
      CLOUDINARY_API_SECRET: 'test-secret'
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('configure()', () => {
    it('should configure Cloudinary with environment variables', () => {
      cloudinaryService.configure();
      
      expect(mockCloudinary.config).toHaveBeenCalledWith({
        cloud_name: 'test-cloud',
        api_key: 'test-key',
        api_secret: 'test-secret',
        secure: true
      });
      
      expect(cloudinaryService.isReady()).toBe(true);
    });

    it('should throw error when CLOUDINARY_CLOUD_NAME is missing', () => {
      delete process.env.CLOUDINARY_CLOUD_NAME;
      
      expect(() => cloudinaryService.configure()).toThrow(
        'Missing required Cloudinary environment variables'
      );
    });

    it('should throw error when CLOUDINARY_API_KEY is missing', () => {
      delete process.env.CLOUDINARY_API_KEY;
      
      expect(() => cloudinaryService.configure()).toThrow(
        'Missing required Cloudinary environment variables'
      );
    });

    it('should throw error when CLOUDINARY_API_SECRET is missing', () => {
      delete process.env.CLOUDINARY_API_SECRET;
      
      expect(() => cloudinaryService.configure()).toThrow(
        'Missing required Cloudinary environment variables'
      );
    });
  });

  describe('uploadImage()', () => {
    beforeEach(() => {
      cloudinaryService.configure();
    });

    it('should upload image successfully', async () => {
      const mockResult = {
        secure_url: 'https://res.cloudinary.com/test/image/upload/test.jpg',
        public_id: 'gp-connect-posts/test123',
        width: 800,
        height: 600,
        format: 'jpg',
        bytes: 50000
      };
      
      mockCloudinary.uploader.upload.mockResolvedValue(mockResult);
      
      const result = await cloudinaryService.uploadImage('/path/to/test.jpg');
      
      expect(mockCloudinary.uploader.upload).toHaveBeenCalledWith('/path/to/test.jpg', {
        folder: 'gp-connect-posts',
        resource_type: 'image',
        transformation: [
          { width: 1000, height: 1000, crop: 'limit' },
          { quality: 'auto', fetch_format: 'auto' }
        ]
      });
      
      expect(result).toEqual({
        url: mockResult.secure_url,
        publicId: mockResult.public_id,
        width: mockResult.width,
        height: mockResult.height,
        format: mockResult.format,
        bytes: mockResult.bytes
      });
    });

    it('should throw error when not configured', async () => {
      cloudinaryService.isConfigured = false;
      
      await expect(cloudinaryService.uploadImage('/path/to/test.jpg'))
        .rejects.toThrow('Cloudinary not configured. Call configure() first.');
    });

    it('should handle upload errors', async () => {
      mockCloudinary.uploader.upload.mockRejectedValue(new Error('Upload failed'));
      
      await expect(cloudinaryService.uploadImage('/path/to/test.jpg'))
        .rejects.toThrow('Failed to upload image: Upload failed');
    });

    it('should merge custom options with defaults', async () => {
      mockCloudinary.uploader.upload.mockResolvedValue({
        secure_url: 'test-url',
        public_id: 'test-id',
        width: 100,
        height: 100,
        format: 'jpg',
        bytes: 1000
      });
      
      const customOptions = {
        folder: 'custom-folder',
        quality: 80
      };
      
      await cloudinaryService.uploadImage('/path/to/test.jpg', customOptions);
      
      expect(mockCloudinary.uploader.upload).toHaveBeenCalledWith('/path/to/test.jpg', {
        folder: 'custom-folder',
        resource_type: 'image',
        transformation: [
          { width: 1000, height: 1000, crop: 'limit' },
          { quality: 'auto', fetch_format: 'auto' }
        ],
        quality: 80
      });
    });
  });

  describe('deleteImage()', () => {
    beforeEach(() => {
      cloudinaryService.configure();
    });

    it('should delete image successfully', async () => {
      const mockResult = { result: 'ok' };
      mockCloudinary.uploader.destroy.mockResolvedValue(mockResult);
      
      const result = await cloudinaryService.deleteImage('test-public-id');
      
      expect(mockCloudinary.uploader.destroy).toHaveBeenCalledWith('test-public-id');
      expect(result).toEqual(mockResult);
    });

    it('should throw error when not configured', async () => {
      cloudinaryService.isConfigured = false;
      
      await expect(cloudinaryService.deleteImage('test-id'))
        .rejects.toThrow('Cloudinary not configured. Call configure() first.');
    });

    it('should handle delete errors', async () => {
      mockCloudinary.uploader.destroy.mockRejectedValue(new Error('Delete failed'));
      
      await expect(cloudinaryService.deleteImage('test-id'))
        .rejects.toThrow('Failed to delete image: Delete failed');
    });
  });

  describe('optimizeUrl()', () => {
    beforeEach(() => {
      cloudinaryService.configure();
    });

    it('should generate optimized URL', () => {
      mockCloudinary.url.mockReturnValue('https://optimized-url.com/image.jpg');
      
      const result = cloudinaryService.optimizeUrl('test-public-id');
      
      expect(mockCloudinary.url).toHaveBeenCalledWith('test-public-id', {
        quality: 'auto',
        fetch_format: 'auto'
      });
      expect(result).toBe('https://optimized-url.com/image.jpg');
    });

    it('should merge custom transformations', () => {
      mockCloudinary.url.mockReturnValue('https://custom-url.com/image.jpg');
      
      const transformations = { width: 500, height: 300 };
      cloudinaryService.optimizeUrl('test-id', transformations);
      
      expect(mockCloudinary.url).toHaveBeenCalledWith('test-id', {
        quality: 'auto',
        fetch_format: 'auto',
        width: 500,
        height: 300
      });
    });

    it('should throw error when not configured', () => {
      cloudinaryService.isConfigured = false;
      
      expect(() => cloudinaryService.optimizeUrl('test-id'))
        .toThrow('Cloudinary not configured. Call configure() first.');
    });
  });

  describe('isReady()', () => {
    it('should return false when not configured', () => {
      expect(cloudinaryService.isReady()).toBe(false);
    });

    it('should return true when configured', () => {
      cloudinaryService.configure();
      expect(cloudinaryService.isReady()).toBe(true);
    });
  });

  describe('testConnection()', () => {
    beforeEach(() => {
      cloudinaryService.configure();
    });

    it('should return true for successful connection', async () => {
      mockCloudinary.api.ping.mockResolvedValue({ status: 'ok' });
      
      const result = await cloudinaryService.testConnection();
      
      expect(mockCloudinary.api.ping).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false for failed connection', async () => {
      mockCloudinary.api.ping.mockRejectedValue(new Error('Connection failed'));
      
      const result = await cloudinaryService.testConnection();
      
      expect(result).toBe(false);
    });

    it('should throw error when not configured', async () => {
      cloudinaryService.isConfigured = false;
      
      await expect(cloudinaryService.testConnection())
        .rejects.toThrow('Cloudinary not configured. Call configure() first.');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    beforeEach(() => {
      cloudinaryService.configure();
    });

    it('should handle large file uploads', async () => {
      const mockResult = {
        secure_url: 'https://res.cloudinary.com/test/image/upload/large.jpg',
        public_id: 'gp-connect-posts/large123',
        width: 4000,
        height: 3000,
        format: 'jpg',
        bytes: 5000000 // 5MB
      };
      
      mockCloudinary.uploader.upload.mockResolvedValue(mockResult);
      
      const result = await cloudinaryService.uploadImage('/path/to/large.jpg');
      
      expect(result.bytes).toBe(5000000);
      expect(result.width).toBe(4000);
      expect(result.height).toBe(3000);
    });

    it('should handle different image formats', async () => {
      const formats = ['jpg', 'png', 'gif', 'webp'];
      
      for (const format of formats) {
        const mockResult = {
          secure_url: `https://res.cloudinary.com/test/image/upload/test.${format}`,
          public_id: `gp-connect-posts/test_${format}`,
          width: 800,
          height: 600,
          format: format,
          bytes: 50000
        };
        
        mockCloudinary.uploader.upload.mockResolvedValue(mockResult);
        
        const result = await cloudinaryService.uploadImage(`/path/to/test.${format}`);
        
        expect(result.format).toBe(format);
        expect(result.url).toContain(format);
      }
    });

    it('should handle network timeout errors', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.code = 'ETIMEDOUT';
      
      mockCloudinary.uploader.upload.mockRejectedValue(timeoutError);
      
      await expect(cloudinaryService.uploadImage('/path/to/test.jpg'))
        .rejects.toThrow('Failed to upload image: Request timeout');
    });

    it('should handle Cloudinary API rate limits', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.http_code = 429;
      
      mockCloudinary.uploader.upload.mockRejectedValue(rateLimitError);
      
      await expect(cloudinaryService.uploadImage('/path/to/test.jpg'))
        .rejects.toThrow('Failed to upload image: Rate limit exceeded');
    });

    it('should handle invalid credentials', async () => {
      const authError = new Error('Invalid credentials');
      authError.http_code = 401;
      
      mockCloudinary.uploader.upload.mockRejectedValue(authError);
      
      await expect(cloudinaryService.uploadImage('/path/to/test.jpg'))
        .rejects.toThrow('Failed to upload image: Invalid credentials');
    });

    it('should handle malformed image files', async () => {
      const malformedError = new Error('Invalid image file');
      malformedError.http_code = 400;
      
      mockCloudinary.uploader.upload.mockRejectedValue(malformedError);
      
      await expect(cloudinaryService.uploadImage('/path/to/corrupted.jpg'))
        .rejects.toThrow('Failed to upload image: Invalid image file');
    });
  });

  describe('Performance and Optimization', () => {
    beforeEach(() => {
      cloudinaryService.configure();
    });

    it('should apply quality optimization by default', async () => {
      mockCloudinary.uploader.upload.mockResolvedValue({
        secure_url: 'test-url',
        public_id: 'test-id',
        width: 100,
        height: 100,
        format: 'jpg',
        bytes: 1000
      });
      
      await cloudinaryService.uploadImage('/path/to/test.jpg');
      
      expect(mockCloudinary.uploader.upload).toHaveBeenCalledWith('/path/to/test.jpg', {
        folder: 'gp-connect-posts',
        resource_type: 'image',
        transformation: [
          { width: 1000, height: 1000, crop: 'limit' },
          { quality: 'auto', fetch_format: 'auto' }
        ]
      });
    });

    it('should generate responsive image URLs', () => {
      mockCloudinary.url.mockReturnValue('https://optimized-url.com/image.jpg');
      
      const result = cloudinaryService.optimizeUrl('test-id', {
        width: 300,
        height: 200,
        crop: 'fill'
      });
      
      expect(mockCloudinary.url).toHaveBeenCalledWith('test-id', {
        quality: 'auto',
        fetch_format: 'auto',
        width: 300,
        height: 200,
        crop: 'fill'
      });
      expect(result).toBe('https://optimized-url.com/image.jpg');
    });

    it('should handle batch operations efficiently', async () => {
      const mockResults = Array.from({ length: 5 }, (_, i) => ({
        secure_url: `https://res.cloudinary.com/test/image/upload/batch${i}.jpg`,
        public_id: `gp-connect-posts/batch${i}`,
        width: 800,
        height: 600,
        format: 'jpg',
        bytes: 50000
      }));
      
      mockCloudinary.uploader.upload
        .mockResolvedValueOnce(mockResults[0])
        .mockResolvedValueOnce(mockResults[1])
        .mockResolvedValueOnce(mockResults[2])
        .mockResolvedValueOnce(mockResults[3])
        .mockResolvedValueOnce(mockResults[4]);
      
      const uploadPromises = Array.from({ length: 5 }, (_, i) => 
        cloudinaryService.uploadImage(`/path/to/batch${i}.jpg`)
      );
      
      const results = await Promise.all(uploadPromises);
      
      expect(results).toHaveLength(5);
      expect(mockCloudinary.uploader.upload).toHaveBeenCalledTimes(5);
      results.forEach((result, i) => {
        expect(result.url).toBe(mockResults[i].secure_url);
      });
    });
  });

  describe('uploadImageWithValidation()', () => {
    beforeEach(() => {
      cloudinaryService.configure();
      // Mock global fetch
      global.fetch = vi.fn();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should upload image and validate successfully', async () => {
      const mockUploadResult = {
        secure_url: 'https://res.cloudinary.com/test/image/upload/test.jpg',
        public_id: 'gp-connect-posts/test123',
        width: 800,
        height: 600,
        format: 'jpg',
        bytes: 50000
      };
      
      mockCloudinary.uploader.upload.mockResolvedValue(mockUploadResult);
      
      // Mock successful validation
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200
      });
      
      const result = await cloudinaryService.uploadImageWithValidation('/path/to/test.jpg');
      
      expect(mockCloudinary.uploader.upload).toHaveBeenCalledWith('/path/to/test.jpg', {
        folder: 'gp-connect-posts',
        resource_type: 'image',
        transformation: [
          { width: 1000, height: 1000, crop: 'limit' },
          { quality: 'auto', fetch_format: 'auto' }
        ]
      });
      
      expect(global.fetch).toHaveBeenCalledWith(mockUploadResult.secure_url, {
        method: 'HEAD',
        signal: expect.any(AbortSignal),
        headers: {
          'User-Agent': 'GP-Connect-Image-Validator/1.0'
        }
      });
      
      expect(result).toEqual({
        url: mockUploadResult.secure_url,
        publicId: mockUploadResult.public_id,
        width: mockUploadResult.width,
        height: mockUploadResult.height,
        format: mockUploadResult.format,
        bytes: mockUploadResult.bytes,
        validated: true,
        validationTime: expect.any(Number)
      });
    });

    it('should upload image but fail validation', async () => {
      const mockUploadResult = {
        secure_url: 'https://res.cloudinary.com/test/image/upload/test.jpg',
        public_id: 'gp-connect-posts/test123',
        width: 800,
        height: 600,
        format: 'jpg',
        bytes: 50000
      };
      
      mockCloudinary.uploader.upload.mockResolvedValue(mockUploadResult);
      
      // Mock failed validation
      global.fetch.mockResolvedValue({
        ok: false,
        status: 404
      });
      
      const result = await cloudinaryService.uploadImageWithValidation('/path/to/test.jpg');
      
      expect(result.validated).toBe(false);
      expect(result.validationTime).toBeGreaterThan(0);
    });

    it('should handle upload failure in uploadImageWithValidation', async () => {
      mockCloudinary.uploader.upload.mockRejectedValue(new Error('Upload failed'));
      
      await expect(cloudinaryService.uploadImageWithValidation('/path/to/test.jpg'))
        .rejects.toThrow('Failed to upload image: Upload failed');
    });

    it('should throw error when not configured', async () => {
      cloudinaryService.isConfigured = false;
      
      await expect(cloudinaryService.uploadImageWithValidation('/path/to/test.jpg'))
        .rejects.toThrow('Cloudinary not configured. Call configure() first.');
    });
  });

  describe('validateImageUrl()', () => {
    beforeEach(() => {
      cloudinaryService.configure();
      global.fetch = vi.fn();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should validate accessible image URL', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200
      });
      
      const result = await cloudinaryService.validateImageUrl('https://res.cloudinary.com/test/image/upload/test.jpg');
      
      expect(global.fetch).toHaveBeenCalledWith('https://res.cloudinary.com/test/image/upload/test.jpg', {
        method: 'HEAD',
        signal: expect.any(AbortSignal),
        headers: {
          'User-Agent': 'GP-Connect-Image-Validator/1.0'
        }
      });
      
      expect(result).toBe(true);
    });

    it('should return false for inaccessible image URL', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 404
      });
      
      const result = await cloudinaryService.validateImageUrl('https://res.cloudinary.com/test/image/upload/nonexistent.jpg');
      
      expect(result).toBe(false);
    });

    it('should return false for empty URL', async () => {
      const result = await cloudinaryService.validateImageUrl('');
      
      expect(result).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return false for null URL', async () => {
      const result = await cloudinaryService.validateImageUrl(null);
      
      expect(result).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle network errors', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));
      
      const result = await cloudinaryService.validateImageUrl('https://res.cloudinary.com/test/image/upload/test.jpg');
      
      expect(result).toBe(false);
    });

    it('should retry on failure', async () => {
      global.fetch
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: true, status: 200 });
      
      const result = await cloudinaryService.validateImageUrl('https://res.cloudinary.com/test/image/upload/test.jpg');
      
      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(result).toBe(true);
    });

    it('should respect retry limit', async () => {
      global.fetch.mockResolvedValue({ ok: false, status: 500 });
      
      const result = await cloudinaryService.validateImageUrl('https://res.cloudinary.com/test/image/upload/test.jpg');
      
      expect(global.fetch).toHaveBeenCalledTimes(3); // Default retries = 3
      expect(result).toBe(false);
    });

    it('should use custom validation options', async () => {
      global.fetch.mockResolvedValue({ ok: true, status: 200 });
      
      const result = await cloudinaryService.validateImageUrl(
        'https://res.cloudinary.com/test/image/upload/test.jpg',
        { retries: 1, retryDelay: 500 }
      );
      
      expect(result).toBe(true);
    });

    it('should handle timeout', async () => {
      // Mock fetch to reject with AbortError when signal is aborted
      global.fetch.mockImplementation((url, options) => {
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            const abortError = new Error('The operation was aborted');
            abortError.name = 'AbortError';
            reject(abortError);
          }, 50); // Shorter than the timeout to ensure it triggers
          
          if (options.signal) {
            options.signal.addEventListener('abort', () => {
              clearTimeout(timeoutId);
              const abortError = new Error('The operation was aborted');
              abortError.name = 'AbortError';
              reject(abortError);
            });
          }
        });
      });
      
      const result = await cloudinaryService.validateImageUrl(
        'https://res.cloudinary.com/test/image/upload/test.jpg',
        { timeout: 100, retries: 1 }
      );
      
      expect(result).toBe(false);
    }, 15000);

    it('should handle AbortError specifically', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      global.fetch.mockRejectedValue(abortError);
      
      const result = await cloudinaryService.validateImageUrl('https://res.cloudinary.com/test/image/upload/test.jpg');
      
      expect(result).toBe(false);
    });
  });

  describe('Enhanced Error Logging', () => {
    beforeEach(() => {
      cloudinaryService.configure();
      // Spy on console methods
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should log upload start and completion', async () => {
      const mockResult = {
        secure_url: 'https://res.cloudinary.com/test/image/upload/test.jpg',
        public_id: 'gp-connect-posts/test123',
        width: 800,
        height: 600,
        format: 'jpg',
        bytes: 50000
      };
      
      mockCloudinary.uploader.upload.mockResolvedValue(mockResult);
      
      await cloudinaryService.uploadImage('/path/to/test.jpg');
      
      expect(console.log).toHaveBeenCalledWith('[CloudinaryService] Starting upload for file: /path/to/test.jpg');
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[CloudinaryService] Upload completed in'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('URL: https://res.cloudinary.com/test/image/upload/test.jpg'));
    });

    it('should log upload errors with details', async () => {
      const error = new Error('Upload failed');
      error.stack = 'Error stack trace';
      mockCloudinary.uploader.upload.mockRejectedValue(error);
      
      await expect(cloudinaryService.uploadImage('/path/to/test.jpg')).rejects.toThrow();
      
      expect(console.error).toHaveBeenCalledWith('[CloudinaryService] Upload failed for file: /path/to/test.jpg', {
        error: 'Upload failed',
        stack: 'Error stack trace',
        options: {
          folder: 'gp-connect-posts',
          resource_type: 'image',
          transformation: [
            { width: 1000, height: 1000, crop: 'limit' },
            { quality: 'auto', fetch_format: 'auto' }
          ]
        }
      });
    });

    it('should log delete operations', async () => {
      mockCloudinary.uploader.destroy.mockResolvedValue({ result: 'ok' });
      
      await cloudinaryService.deleteImage('test-public-id');
      
      expect(console.log).toHaveBeenCalledWith('[CloudinaryService] Deleting image with public ID: test-public-id');
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[CloudinaryService] Image deletion completed in'));
    });

    it('should log delete errors', async () => {
      const error = new Error('Delete failed');
      error.stack = 'Error stack trace';
      mockCloudinary.uploader.destroy.mockRejectedValue(error);
      
      await expect(cloudinaryService.deleteImage('test-id')).rejects.toThrow();
      
      expect(console.error).toHaveBeenCalledWith('[CloudinaryService] Delete failed for public ID: test-id', {
        error: 'Delete failed',
        stack: 'Error stack trace'
      });
    });

    it('should log validation operations', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      
      await cloudinaryService.validateImageUrl('https://test-url.com/image.jpg');
      
      expect(console.log).toHaveBeenCalledWith('[CloudinaryService] Validating image URL: https://test-url.com/image.jpg');
      expect(console.log).toHaveBeenCalledWith('[CloudinaryService] Image validation successful on attempt 1. Status: 200');
    });

    it('should log validation failures', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
      
      await cloudinaryService.validateImageUrl('https://test-url.com/nonexistent.jpg');
      
      expect(console.warn).toHaveBeenCalledWith('[CloudinaryService] Image validation failed on attempt 1. Status: 404');
      expect(console.error).toHaveBeenCalledWith('[CloudinaryService] Image validation failed after 3 attempts: https://test-url.com/nonexistent.jpg');
    });
  });
});