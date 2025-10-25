/**
 * Comprehensive image error handling service
 * Addresses Requirements: 2.4, 5.3, 5.4
 */

import { getPlaceholderImage, validateImageUrl } from '../utils/imageUtils.js';

/**
 * Error types for image operations
 */
export const IMAGE_ERROR_TYPES = {
  NETWORK_ERROR: 'network_error',
  CORS_ERROR: 'cors_error',
  NOT_FOUND: 'not_found',
  TIMEOUT: 'timeout',
  INVALID_FORMAT: 'invalid_format',
  CLOUDINARY_ERROR: 'cloudinary_error',
  LOCALHOST_UNAVAILABLE: 'localhost_unavailable',
  UNKNOWN: 'unknown'
};

/**
 * User-friendly error messages
 */
export const ERROR_MESSAGES = {
  [IMAGE_ERROR_TYPES.NETWORK_ERROR]: 'Network connection issue. Please check your internet connection.',
  [IMAGE_ERROR_TYPES.CORS_ERROR]: 'Image access blocked. This may be a temporary issue.',
  [IMAGE_ERROR_TYPES.NOT_FOUND]: 'Image not found. It may have been moved or deleted.',
  [IMAGE_ERROR_TYPES.TIMEOUT]: 'Image is taking too long to load. Please try again.',
  [IMAGE_ERROR_TYPES.INVALID_FORMAT]: 'Invalid image format. Please use a supported image type.',
  [IMAGE_ERROR_TYPES.CLOUDINARY_ERROR]: 'Image service temporarily unavailable. Please try again later.',
  [IMAGE_ERROR_TYPES.LOCALHOST_UNAVAILABLE]: 'Image was uploaded from another device and is not accessible.',
  [IMAGE_ERROR_TYPES.UNKNOWN]: 'Unable to load image. Please try again.'
};

/**
 * Classify error type based on error object
 * @param {Error} error - Error object from image loading
 * @returns {string} - Error type from IMAGE_ERROR_TYPES
 */
export const classifyImageError = (error) => {
  if (!error) return IMAGE_ERROR_TYPES.UNKNOWN;
  
  const message = error.message?.toLowerCase() || '';
  
  if (error.name === 'AbortError' || message.includes('timeout')) {
    return IMAGE_ERROR_TYPES.TIMEOUT;
  }
  
  if (message.includes('localhost') || message.includes('another device')) {
    return IMAGE_ERROR_TYPES.LOCALHOST_UNAVAILABLE;
  }
  
  if (message.includes('cors') || message.includes('cross-origin')) {
    return IMAGE_ERROR_TYPES.CORS_ERROR;
  }
  
  if (message.includes('network') || message.includes('fetch')) {
    return IMAGE_ERROR_TYPES.NETWORK_ERROR;
  }
  
  if (message.includes('404') || message.includes('not found')) {
    return IMAGE_ERROR_TYPES.NOT_FOUND;
  }
  
  if (message.includes('cloudinary')) {
    return IMAGE_ERROR_TYPES.CLOUDINARY_ERROR;
  }
  
  if (message.includes('format') || message.includes('invalid')) {
    return IMAGE_ERROR_TYPES.INVALID_FORMAT;
  }
  
  return IMAGE_ERROR_TYPES.UNKNOWN;
};

/**
 * Get user-friendly error message
 * @param {Error} error - Error object
 * @returns {string} - User-friendly error message
 */
export const getErrorMessage = (error) => {
  const errorType = classifyImageError(error);
  return ERROR_MESSAGES[errorType];
};

/**
 * Fallback strategies for different error types
 */
export const FALLBACK_STRATEGIES = {
  [IMAGE_ERROR_TYPES.NETWORK_ERROR]: {
    showRetry: true,
    showPlaceholder: true,
    retryDelay: 2000,
    maxRetries: 3
  },
  [IMAGE_ERROR_TYPES.CORS_ERROR]: {
    showRetry: true,
    showPlaceholder: true,
    retryDelay: 1000,
    maxRetries: 2
  },
  [IMAGE_ERROR_TYPES.NOT_FOUND]: {
    showRetry: false,
    showPlaceholder: true,
    retryDelay: 0,
    maxRetries: 0
  },
  [IMAGE_ERROR_TYPES.TIMEOUT]: {
    showRetry: true,
    showPlaceholder: true,
    retryDelay: 3000,
    maxRetries: 2
  },
  [IMAGE_ERROR_TYPES.INVALID_FORMAT]: {
    showRetry: false,
    showPlaceholder: true,
    retryDelay: 0,
    maxRetries: 0
  },
  [IMAGE_ERROR_TYPES.CLOUDINARY_ERROR]: {
    showRetry: true,
    showPlaceholder: true,
    retryDelay: 5000,
    maxRetries: 2
  },
  [IMAGE_ERROR_TYPES.LOCALHOST_UNAVAILABLE]: {
    showRetry: false,
    showPlaceholder: true,
    retryDelay: 0,
    maxRetries: 0
  },
  [IMAGE_ERROR_TYPES.UNKNOWN]: {
    showRetry: true,
    showPlaceholder: true,
    retryDelay: 2000,
    maxRetries: 2
  }
};

/**
 * Get fallback strategy for error type
 * @param {Error} error - Error object
 * @returns {Object} - Fallback strategy configuration
 */
export const getFallbackStrategy = (error) => {
  const errorType = classifyImageError(error);
  return FALLBACK_STRATEGIES[errorType];
};

/**
 * Enhanced image error handler class
 */
export class ImageErrorHandler {
  constructor(options = {}) {
    this.options = {
      enableLogging: true,
      enableAnalytics: false,
      defaultPlaceholder: null,
      ...options
    };
    
    this.errorStats = new Map();
    this.retryAttempts = new Map();
  }

  /**
   * Handle image error with comprehensive fallback logic
   * @param {string} imageUrl - URL of the failed image
   * @param {Error} error - Error object
   * @param {Object} context - Additional context (component, user, etc.)
   * @returns {Object} - Error handling result with fallback options
   */
  handleImageError(imageUrl, error, context = {}) {
    const errorType = classifyImageError(error);
    const strategy = getFallbackStrategy(error);
    const errorMessage = getErrorMessage(error);
    
    // Log error if enabled
    if (this.options.enableLogging) {
      this.logError(imageUrl, error, errorType, context);
    }
    
    // Track error statistics
    this.trackError(imageUrl, errorType);
    
    // Determine fallback image
    const fallbackImage = this.getFallbackImage(context.imageType || 'post');
    
    return {
      errorType,
      errorMessage,
      strategy,
      fallbackImage,
      shouldRetry: strategy.showRetry && this.canRetry(imageUrl, strategy.maxRetries),
      retryDelay: strategy.retryDelay,
      showPlaceholder: strategy.showPlaceholder,
      context: {
        ...context,
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
      }
    };
  }

  /**
   * Log error with comprehensive information
   * @param {string} imageUrl - Failed image URL
   * @param {Error} error - Error object
   * @param {string} errorType - Classified error type
   * @param {Object} context - Additional context
   */
  logError(imageUrl, error, errorType, context) {
    const logData = {
      timestamp: new Date().toISOString(),
      imageUrl,
      errorType,
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack
      },
      context,
      retryCount: this.getRetryCount(imageUrl),
      isCloudinary: imageUrl?.includes('cloudinary.com') || false
    };

    console.error('🖼️ Image Error:', logData);
    
    // Send to analytics if enabled
    if (this.options.enableAnalytics && typeof window !== 'undefined') {
      this.sendAnalytics(logData);
    }
  }

  /**
   * Track error statistics
   * @param {string} imageUrl - Failed image URL
   * @param {string} errorType - Error type
   */
  trackError(imageUrl, errorType) {
    const key = `${imageUrl}:${errorType}`;
    const current = this.errorStats.get(key) || 0;
    this.errorStats.set(key, current + 1);
  }

  /**
   * Check if retry is allowed for this image
   * @param {string} imageUrl - Image URL
   * @param {number} maxRetries - Maximum allowed retries
   * @returns {boolean} - Whether retry is allowed
   */
  canRetry(imageUrl, maxRetries) {
    const retryCount = this.getRetryCount(imageUrl);
    return retryCount < maxRetries;
  }

  /**
   * Get current retry count for image
   * @param {string} imageUrl - Image URL
   * @returns {number} - Current retry count
   */
  getRetryCount(imageUrl) {
    return this.retryAttempts.get(imageUrl) || 0;
  }

  /**
   * Increment retry count for image
   * @param {string} imageUrl - Image URL
   */
  incrementRetryCount(imageUrl) {
    const current = this.getRetryCount(imageUrl);
    this.retryAttempts.set(imageUrl, current + 1);
  }

  /**
   * Reset retry count for image
   * @param {string} imageUrl - Image URL
   */
  resetRetryCount(imageUrl) {
    this.retryAttempts.delete(imageUrl);
  }

  /**
   * Get appropriate fallback image
   * @param {string} imageType - Type of image ('post', 'profile', etc.)
   * @returns {string} - Fallback image URL
   */
  getFallbackImage(imageType) {
    if (this.options.defaultPlaceholder) {
      return this.options.defaultPlaceholder;
    }
    return getPlaceholderImage(imageType);
  }

  /**
   * Send analytics data (placeholder for future implementation)
   * @param {Object} logData - Error log data
   */
  sendAnalytics(logData) {
    // Placeholder for analytics integration
    // Could send to services like Google Analytics, Sentry, etc.
    console.debug('📊 Analytics:', logData);
  }

  /**
   * Get error statistics summary
   * @returns {Object} - Error statistics
   */
  getErrorStats() {
    const stats = {};
    for (const [key, count] of this.errorStats.entries()) {
      const [url, errorType] = key.split(':');
      if (!stats[errorType]) {
        stats[errorType] = { count: 0, urls: [] };
      }
      stats[errorType].count += count;
      stats[errorType].urls.push({ url, count });
    }
    return stats;
  }

  /**
   * Clear error statistics
   */
  clearStats() {
    this.errorStats.clear();
    this.retryAttempts.clear();
  }
}

/**
 * Global image error handler instance
 */
export const globalImageErrorHandler = new ImageErrorHandler({
  enableLogging: true,
  enableAnalytics: process.env.NODE_ENV === 'production'
});

/**
 * Graceful degradation utility for image components
 * @param {string} imageUrl - Original image URL
 * @param {Error} error - Error that occurred
 * @param {Object} options - Degradation options
 * @returns {Object} - Degradation result
 */
export const gracefulImageDegradation = async (imageUrl, error, options = {}) => {
  const {
    enableValidation = true,
    fallbackType = 'post',
    context = {}
  } = options;

  const errorHandler = globalImageErrorHandler;
  const result = errorHandler.handleImageError(imageUrl, error, { 
    ...context, 
    imageType: fallbackType 
  });

  // If validation is enabled and retry is recommended, validate the URL
  if (enableValidation && result.shouldRetry) {
    try {
      const validation = await validateImageUrl(imageUrl, {
        maxRetries: 1,
        timeout: 3000,
        context: { source: 'gracefulDegradation' }
      });
      
      if (!validation.isAccessible) {
        // Image is not accessible, don't retry
        result.shouldRetry = false;
        result.errorMessage = 'Image is currently unavailable';
      }
    } catch (validationError) {
      console.warn('Image validation failed during degradation:', validationError);
    }
  }

  return result;
};

/**
 * Create error boundary for image operations
 * @param {Function} imageOperation - Function that performs image operation
 * @param {Object} errorContext - Context for error handling
 * @returns {Function} - Wrapped function with error handling
 */
export const withImageErrorBoundary = (imageOperation, errorContext = {}) => {
  return async (...args) => {
    try {
      return await imageOperation(...args);
    } catch (error) {
      const degradation = await gracefulImageDegradation(
        args[0], // Assume first argument is image URL
        error,
        { context: errorContext }
      );
      
      // Return degraded result instead of throwing
      return {
        success: false,
        error: degradation.errorMessage,
        fallback: degradation.fallbackImage,
        shouldRetry: degradation.shouldRetry
      };
    }
  };
};

export default ImageErrorHandler;