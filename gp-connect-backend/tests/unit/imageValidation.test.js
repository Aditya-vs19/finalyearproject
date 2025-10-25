import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock node-fetch
vi.mock('node-fetch', () => ({
  default: vi.fn()
}));

// Import after mocking
const fetch = (await import('node-fetch')).default;
const {
  validateImageUrl,
  validateMultipleImageUrls,
  quickValidateImageUrl,
  validateUploadedImage
} = await import('../../utils/imageValidation.js');

describe('Backend Image Validation Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('validateImageUrl', () => {
    it('should return error result for invalid URLs', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const result1 = await validateImageUrl(null);
      expect(result1.isAccessible).toBe(false);
      expect(result1.attempts).toBe(0);
      expect(result1.lastError).toBeInstanceOf(Error);
      
      const result2 = await validateImageUrl('');
      expect(result2.isAccessible).toBe(false);
      
      consoleSpy.mockRestore();
    });

    it('should return success result for accessible images on first attempt', async () => {
      fetch.mockResolvedValue({ ok: true });
      
      const result = await validateImageUrl('https://res.cloudinary.com/demo/image/upload/sample.jpg');
      expect(result.isAccessible).toBe(true);
      expect(result.attempts).toBe(1);
      expect(result.lastError).toBe(null);
      expect(fetch).toHaveBeenCalledWith('https://res.cloudinary.com/demo/image/upload/sample.jpg', {
        method: 'HEAD',
        signal: expect.any(Object),
        headers: {
          'User-Agent': 'GP-Connect-Server/1.0',
          'Accept': 'image/*,*/*;q=0.8'
        }
      });
    });

    it('should retry on failure and eventually succeed', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      
      fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true });
      
      const validationPromise = validateImageUrl('https://example.com/image.jpg', { maxRetries: 2 });
      
      // Fast-forward through the retry delay
      await vi.runAllTimersAsync();
      
      const result = await validationPromise;
      expect(result.isAccessible).toBe(true);
      expect(result.attempts).toBe(2);
      expect(result.lastError).toBe(null);
      
      consoleSpy.mockRestore();
      infoSpy.mockRestore();
    });

    it('should fail after max retries', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      fetch.mockRejectedValue(new Error('Persistent network error'));
      
      const validationPromise = validateImageUrl('https://example.com/image.jpg', { maxRetries: 2 });
      
      // Fast-forward through all retry delays
      await vi.runAllTimersAsync();
      
      const result = await validationPromise;
      expect(result.isAccessible).toBe(false);
      expect(result.attempts).toBe(3); // 1 initial + 2 retries
      expect(result.lastError).toBeInstanceOf(Error);
      expect(result.lastError.message).toBe('Persistent network error');
      
      consoleSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('should handle HTTP error responses', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      fetch.mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' });
      
      const validationPromise = validateImageUrl('https://example.com/nonexistent.jpg', { maxRetries: 1 });
      
      await vi.runAllTimersAsync();
      
      const result = await validationPromise;
      expect(result.isAccessible).toBe(false);
      expect(result.lastError.message).toBe('HTTP 404: Not Found');
      
      consoleSpy.mockRestore();
    });

    it('should handle DNS errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const dnsError = new Error('getaddrinfo ENOTFOUND example.com');
      fetch.mockRejectedValue(dnsError);
      
      const validationPromise = validateImageUrl('https://example.com/image.jpg', { maxRetries: 0 });
      
      await vi.runAllTimersAsync();
      
      const result = await validationPromise;
      expect(result.isAccessible).toBe(false);
      expect(result.lastError).toBe(dnsError);
      
      // Check that DNS error context was logged
      expect(consoleSpy).toHaveBeenCalledWith('Server image validation failed:', expect.objectContaining({
        context: expect.objectContaining({
          reason: 'dns_error'
        })
      }));
      
      consoleSpy.mockRestore();
    });

    it('should handle connection refused errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const connError = new Error('connect ECONNREFUSED 127.0.0.1:80');
      fetch.mockRejectedValue(connError);
      
      const validationPromise = validateImageUrl('https://example.com/image.jpg', { maxRetries: 0 });
      
      await vi.runAllTimersAsync();
      
      const result = await validationPromise;
      expect(result.isAccessible).toBe(false);
      
      // Check that connection refused error context was logged
      expect(consoleSpy).toHaveBeenCalledWith('Server image validation failed:', expect.objectContaining({
        context: expect.objectContaining({
          reason: 'connection_refused'
        })
      }));
      
      consoleSpy.mockRestore();
    });

    it('should include context in error logging', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      fetch.mockRejectedValue(new Error('Network error'));
      
      const context = { userId: '123', postId: '456' };
      const validationPromise = validateImageUrl('https://example.com/image.jpg', {
        maxRetries: 0,
        context
      });
      
      await vi.runAllTimersAsync();
      
      await validationPromise;
      
      expect(consoleSpy).toHaveBeenCalledWith('Server image validation failed:', expect.objectContaining({
        context: expect.objectContaining(context)
      }));
      
      consoleSpy.mockRestore();
    });

    it('should identify Cloudinary URLs in error logs', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      fetch.mockRejectedValue(new Error('Network error'));
      
      const validationPromise = validateImageUrl('https://res.cloudinary.com/demo/image/upload/sample.jpg', {
        maxRetries: 0
      });
      
      await vi.runAllTimersAsync();
      
      await validationPromise;
      
      expect(consoleSpy).toHaveBeenCalledWith('Server image validation failed:', expect.objectContaining({
        isCloudinary: true
      }));
      
      consoleSpy.mockRestore();
    });
  });

  describe('validateMultipleImageUrls', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should validate multiple URLs concurrently', async () => {
      fetch
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' })
        .mockResolvedValueOnce({ ok: true });
      
      const urls = [
        'https://example.com/image1.jpg',
        'https://example.com/image2.jpg',
        'https://example.com/image3.jpg'
      ];
      
      const validationPromise = validateMultipleImageUrls(urls, { maxRetries: 0 });
      
      await vi.runAllTimersAsync();
      
      const results = await validationPromise;
      
      expect(results).toHaveLength(3);
      expect(results[0].isAccessible).toBe(true);
      expect(results[1].isAccessible).toBe(false);
      expect(results[2].isAccessible).toBe(true);
      
      expect(results[0].url).toBe(urls[0]);
      expect(results[1].url).toBe(urls[1]);
      expect(results[2].url).toBe(urls[2]);
    });

    it('should throw error for non-array input', async () => {
      await expect(validateMultipleImageUrls('not-an-array')).rejects.toThrow('URLs must be provided as an array');
    });

    it('should include batch context in validation', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      fetch.mockRejectedValue(new Error('Network error'));
      
      const urls = ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'];
      const validationPromise = validateMultipleImageUrls(urls, { maxRetries: 0 });
      
      await vi.runAllTimersAsync();
      
      await validationPromise;
      
      expect(consoleSpy).toHaveBeenCalledWith('Server image validation failed:', expect.objectContaining({
        context: expect.objectContaining({
          batchIndex: expect.any(Number),
          batchSize: 2
        })
      }));
      
      consoleSpy.mockRestore();
    });
  });

  describe('quickValidateImageUrl', () => {
    it('should return true for accessible images', async () => {
      fetch.mockResolvedValue({ ok: true });
      
      const result = await quickValidateImageUrl('https://example.com/image.jpg');
      expect(result).toBe(true);
    });

    it('should return false for inaccessible images', async () => {
      fetch.mockResolvedValue({ ok: false });
      
      const result = await quickValidateImageUrl('https://example.com/nonexistent.jpg');
      expect(result).toBe(false);
    });

    it('should return false for invalid URLs without logging', async () => {
      const result1 = await quickValidateImageUrl(null);
      const result2 = await quickValidateImageUrl('');
      
      expect(result1).toBe(false);
      expect(result2).toBe(false);
    });

    it('should return false on network errors without logging', async () => {
      fetch.mockRejectedValue(new Error('Network error'));
      
      const result = await quickValidateImageUrl('https://example.com/image.jpg');
      expect(result).toBe(false);
    });

    it('should use server-specific headers', async () => {
      fetch.mockResolvedValue({ ok: true });
      
      await quickValidateImageUrl('https://example.com/image.jpg');
      
      expect(fetch).toHaveBeenCalledWith('https://example.com/image.jpg', {
        method: 'HEAD',
        signal: expect.any(Object),
        headers: {
          'User-Agent': 'GP-Connect-Server/1.0',
          'Accept': 'image/*,*/*;q=0.8'
        }
      });
    });
  });

  describe('validateUploadedImage', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should validate uploaded Cloudinary images with appropriate settings', async () => {
      fetch.mockResolvedValue({ ok: true });
      
      const context = { userId: '123', postId: '456' };
      const result = await validateUploadedImage('https://res.cloudinary.com/demo/image/upload/sample.jpg', context);
      
      expect(result.isAccessible).toBe(true);
      expect(result.attempts).toBe(1);
      expect(result.lastError).toBe(null);
    });

    it('should use fewer retries for upload validation', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      fetch.mockRejectedValue(new Error('Network error'));
      
      const validationPromise = validateUploadedImage('https://res.cloudinary.com/demo/image/upload/sample.jpg');
      
      await vi.runAllTimersAsync();
      
      const result = await validationPromise;
      expect(result.isAccessible).toBe(false);
      expect(result.attempts).toBe(3); // 1 initial + 2 retries (maxRetries: 2)
      
      consoleSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('should include post_upload validation type in context', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      fetch.mockRejectedValue(new Error('Network error'));
      
      const context = { userId: '123' };
      const validationPromise = validateUploadedImage('https://res.cloudinary.com/demo/image/upload/sample.jpg', context);
      
      await vi.runAllTimersAsync();
      
      await validationPromise;
      
      expect(consoleSpy).toHaveBeenCalledWith('Server image validation failed:', expect.objectContaining({
        context: expect.objectContaining({
          userId: '123',
          validationType: 'post_upload'
        })
      }));
      
      consoleSpy.mockRestore();
    });
  });
});