/**
 * Unit tests for image error handling service
 * Addresses Requirements: 2.4, 5.3, 5.4
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  ImageErrorHandler,
  globalImageErrorHandler,
  classifyImageError,
  getErrorMessage,
  getFallbackStrategy,
  gracefulImageDegradation,
  withImageErrorBoundary,
  IMAGE_ERROR_TYPES,
  ERROR_MESSAGES,
  FALLBACK_STRATEGIES
} from '../imageErrorHandler.js';

// Mock fetch for testing
global.fetch = vi.fn();

// Mock imageUtils
vi.mock('../../utils/imageUtils.js', () => ({
  validateImageUrl: vi.fn(),
  getPlaceholderImage: vi.fn(() => 'placeholder.svg')
}));

describe('ImageErrorHandler', () => {
  let errorHandler;

  beforeEach(() => {
    errorHandler = new ImageErrorHandler({
      enableLogging: false, // Disable logging for tests
      enableAnalytics: false
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    errorHandler.clearStats();
  });

  describe('Error Classification', () => {
    it('should classify network errors correctly', () => {
      const networkError = new Error('Network request failed');
      const errorType = classifyImageError(networkError);
      expect(errorType).toBe(IMAGE_ERROR_TYPES.NETWORK_ERROR);
    });

    it('should classify CORS errors correctly', () => {
      const corsError = new Error('CORS policy blocked the request');
      const errorType = classifyImageError(corsError);
      expect(errorType).toBe(IMAGE_ERROR_TYPES.CORS_ERROR);
    });

    it('should classify timeout errors correctly', () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'AbortError';
      const errorType = classifyImageError(timeoutError);
      expect(errorType).toBe(IMAGE_ERROR_TYPES.TIMEOUT);
    });

    it('should classify 404 errors correctly', () => {
      const notFoundError = new Error('404 not found');
      const errorType = classifyImageError(notFoundError);
      expect(errorType).toBe(IMAGE_ERROR_TYPES.NOT_FOUND);
    });

    it('should classify Cloudinary errors correctly', () => {
      const cloudinaryError = new Error('Cloudinary service error');
      const errorType = classifyImageError(cloudinaryError);
      expect(errorType).toBe(IMAGE_ERROR_TYPES.CLOUDINARY_ERROR);
    });

    it('should classify unknown errors correctly', () => {
      const unknownError = new Error('Some random error');
      const errorType = classifyImageError(unknownError);
      expect(errorType).toBe(IMAGE_ERROR_TYPES.UNKNOWN);
    });

    it('should handle null/undefined errors', () => {
      expect(classifyImageError(null)).toBe(IMAGE_ERROR_TYPES.UNKNOWN);
      expect(classifyImageError(undefined)).toBe(IMAGE_ERROR_TYPES.UNKNOWN);
    });
  });

  describe('Error Messages', () => {
    it('should return appropriate error messages for each error type', () => {
      // Test specific error types directly
      const networkError = new Error('Network request failed');
      const corsError = new Error('CORS policy blocked the request');
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'AbortError';
      
      const networkMessage = getErrorMessage(networkError);
      const corsMessage = getErrorMessage(corsError);
      const timeoutMessage = getErrorMessage(timeoutError);
      
      expect(typeof networkMessage).toBe('string');
      expect(networkMessage.length).toBeGreaterThan(0);
      expect(typeof corsMessage).toBe('string');
      expect(corsMessage.length).toBeGreaterThan(0);
      expect(typeof timeoutMessage).toBe('string');
      expect(timeoutMessage.length).toBeGreaterThan(0);
    });
  });

  describe('Fallback Strategies', () => {
    it('should return appropriate fallback strategies for each error type', () => {
      // Test specific error types directly
      const networkError = new Error('Network request failed');
      const corsError = new Error('CORS policy blocked the request');
      const notFoundError = new Error('404 not found');
      
      const networkStrategy = getFallbackStrategy(networkError);
      const corsStrategy = getFallbackStrategy(corsError);
      const notFoundStrategy = getFallbackStrategy(notFoundError);
      
      // Verify strategy structure
      expect(typeof networkStrategy.showRetry).toBe('boolean');
      expect(typeof networkStrategy.showPlaceholder).toBe('boolean');
      expect(typeof networkStrategy.retryDelay).toBe('number');
      expect(typeof networkStrategy.maxRetries).toBe('number');
      
      expect(typeof corsStrategy.showRetry).toBe('boolean');
      expect(typeof notFoundStrategy.showRetry).toBe('boolean');
      
      // Not found errors should not allow retry
      expect(notFoundStrategy.showRetry).toBe(false);
      expect(notFoundStrategy.maxRetries).toBe(0);
    });
  });

  describe('ImageErrorHandler Class', () => {
    it('should handle image errors and return comprehensive result', () => {
      const imageUrl = 'https://example.com/image.jpg';
      const error = new Error('Network error');
      const context = { component: 'TestComponent' };

      const result = errorHandler.handleImageError(imageUrl, error, context);

      expect(result).toHaveProperty('errorType');
      expect(result).toHaveProperty('errorMessage');
      expect(result).toHaveProperty('strategy');
      expect(result).toHaveProperty('fallbackImage');
      expect(result).toHaveProperty('shouldRetry');
      expect(result).toHaveProperty('retryDelay');
      expect(result).toHaveProperty('showPlaceholder');
      expect(result).toHaveProperty('context');
    });

    it('should track retry counts correctly', () => {
      const imageUrl = 'https://example.com/image.jpg';
      
      expect(errorHandler.getRetryCount(imageUrl)).toBe(0);
      
      errorHandler.incrementRetryCount(imageUrl);
      expect(errorHandler.getRetryCount(imageUrl)).toBe(1);
      
      errorHandler.incrementRetryCount(imageUrl);
      expect(errorHandler.getRetryCount(imageUrl)).toBe(2);
      
      errorHandler.resetRetryCount(imageUrl);
      expect(errorHandler.getRetryCount(imageUrl)).toBe(0);
    });

    it('should respect max retry limits', () => {
      const imageUrl = 'https://example.com/image.jpg';
      const error = new Error('Network error');
      
      // Set retry count to max
      errorHandler.retryAttempts.set(imageUrl, 3);
      
      const result = errorHandler.handleImageError(imageUrl, error);
      expect(result.shouldRetry).toBe(false);
    });

    it('should track error statistics', () => {
      const imageUrl = 'https://example.com/image.jpg';
      const error = new Error('Network error');
      
      errorHandler.handleImageError(imageUrl, error);
      errorHandler.handleImageError(imageUrl, error);
      
      const stats = errorHandler.getErrorStats();
      expect(Object.keys(stats).length).toBeGreaterThan(0);
      
      // Check that some error type was tracked
      const errorTypes = Object.keys(stats);
      expect(errorTypes.length).toBeGreaterThan(0);
      
      // Check that the first error type has the expected structure
      const firstErrorType = errorTypes[0];
      expect(stats[firstErrorType]).toHaveProperty('count');
      expect(stats[firstErrorType]).toHaveProperty('urls');
      expect(stats[firstErrorType].count).toBeGreaterThan(0);
    });

    it('should clear statistics correctly', () => {
      const imageUrl = 'https://example.com/image.jpg';
      const error = new Error('Network error');
      
      errorHandler.handleImageError(imageUrl, error);
      errorHandler.incrementRetryCount(imageUrl);
      
      expect(errorHandler.getErrorStats()).not.toEqual({});
      expect(errorHandler.getRetryCount(imageUrl)).toBe(1);
      
      errorHandler.clearStats();
      
      expect(errorHandler.getErrorStats()).toEqual({});
      expect(errorHandler.getRetryCount(imageUrl)).toBe(0);
    });
  });

  describe('Graceful Degradation', () => {
    it('should perform graceful degradation with validation', async () => {
      // Mock validateImageUrl for this test
      const mockValidateImageUrl = vi.fn().mockResolvedValue({ isAccessible: false });
      
      // Mock the module temporarily
      vi.doMock('../../utils/imageUtils.js', () => ({
        validateImageUrl: mockValidateImageUrl,
        getPlaceholderImage: vi.fn(() => 'placeholder.svg')
      }));

      const imageUrl = 'https://example.com/image.jpg';
      const error = new Error('Network error');
      
      const result = await gracefulImageDegradation(imageUrl, error, {
        enableValidation: true,
        fallbackType: 'post'
      });

      expect(result).toHaveProperty('shouldRetry');
      expect(result).toHaveProperty('errorMessage');
      expect(result).toHaveProperty('fallbackImage');
    });

    it('should skip validation when disabled', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const error = new Error('Network error');
      
      const result = await gracefulImageDegradation(imageUrl, error, {
        enableValidation: false
      });

      expect(result).toHaveProperty('shouldRetry');
    });
  });

  describe('Error Boundary Wrapper', () => {
    it('should wrap functions with error handling', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Test error'));
      const wrappedOperation = withImageErrorBoundary(mockOperation, { component: 'Test' });
      
      const result = await wrappedOperation('https://example.com/image.jpg');
      
      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('fallback');
      expect(result).toHaveProperty('shouldRetry');
    });

    it('should pass through successful operations', async () => {
      const mockOperation = vi.fn().mockResolvedValue({ success: true, data: 'test' });
      const wrappedOperation = withImageErrorBoundary(mockOperation);
      
      const result = await wrappedOperation('https://example.com/image.jpg');
      
      expect(result).toEqual({ success: true, data: 'test' });
    });
  });

  describe('Global Error Handler', () => {
    it('should be properly initialized', () => {
      expect(globalImageErrorHandler).toBeInstanceOf(ImageErrorHandler);
      expect(globalImageErrorHandler.options.enableLogging).toBe(true);
    });

    it('should maintain state across calls', () => {
      const imageUrl = 'https://example.com/global-test.jpg';
      const error = new Error('Test error');
      
      globalImageErrorHandler.handleImageError(imageUrl, error);
      expect(globalImageErrorHandler.getRetryCount(imageUrl)).toBe(0);
      
      globalImageErrorHandler.incrementRetryCount(imageUrl);
      expect(globalImageErrorHandler.getRetryCount(imageUrl)).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty or invalid image URLs', () => {
      const error = new Error('Invalid URL');
      
      const result1 = errorHandler.handleImageError('', error);
      const result2 = errorHandler.handleImageError(null, error);
      const result3 = errorHandler.handleImageError(undefined, error);
      
      [result1, result2, result3].forEach(result => {
        expect(result).toHaveProperty('errorType');
        expect(result).toHaveProperty('fallbackImage');
        expect(result.shouldRetry).toBeDefined();
      });
    });

    it('should handle errors without messages', () => {
      const error = new Error();
      error.message = '';
      
      const result = errorHandler.handleImageError('https://example.com/image.jpg', error);
      expect(result.errorMessage).toBeTruthy();
      expect(typeof result.errorMessage).toBe('string');
    });

    it('should handle very large retry counts', () => {
      const imageUrl = 'https://example.com/image.jpg';
      
      // Set an extremely high retry count
      errorHandler.retryAttempts.set(imageUrl, 999999);
      
      const error = new Error('Network error');
      const result = errorHandler.handleImageError(imageUrl, error);
      
      expect(result.shouldRetry).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should handle multiple concurrent error handling calls', () => {
      const promises = [];
      
      for (let i = 0; i < 100; i++) {
        const imageUrl = `https://example.com/image${i}.jpg`;
        const error = new Error(`Error ${i}`);
        promises.push(
          Promise.resolve(errorHandler.handleImageError(imageUrl, error))
        );
      }
      
      return Promise.all(promises).then(results => {
        expect(results).toHaveLength(100);
        results.forEach(result => {
          expect(result).toHaveProperty('errorType');
          expect(result).toHaveProperty('errorMessage');
        });
      });
    });

    it('should efficiently manage memory for error statistics', () => {
      // Add many errors
      for (let i = 0; i < 1000; i++) {
        const imageUrl = `https://example.com/image${i}.jpg`;
        const error = new Error('Test error');
        errorHandler.handleImageError(imageUrl, error);
      }
      
      const statsBefore = Object.keys(errorHandler.getErrorStats()).length;
      expect(statsBefore).toBeGreaterThan(0);
      
      errorHandler.clearStats();
      
      const statsAfter = Object.keys(errorHandler.getErrorStats()).length;
      expect(statsAfter).toBe(0);
    });
  });
});