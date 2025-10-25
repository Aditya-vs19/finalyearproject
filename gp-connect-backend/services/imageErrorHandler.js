/**
 * Image Error Handler Service
 * Provides comprehensive error handling and fallback mechanisms for image operations
 * 
 * Requirements: 2.4, 3.3
 */

import fs from 'fs/promises';
import path from 'path';
import multer from 'multer';

/**
 * Custom error classes for image operations
 */
export class ImageUploadError extends Error {
  constructor(message, errorCode, details = {}) {
    super(message);
    this.name = 'ImageUploadError';
    this.errorCode = errorCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

export class CloudinaryUnavailableError extends ImageUploadError {
  constructor(originalError, details = {}) {
    super('Cloudinary service is unavailable', 'CLOUDINARY_UNAVAILABLE', {
      originalError: originalError.message,
      ...details
    });
  }
}

export class RetryExhaustedError extends ImageUploadError {
  constructor(attempts, lastError, details = {}) {
    super(`Upload failed after ${attempts} attempts`, 'RETRY_EXHAUSTED', {
      attempts,
      lastError: lastError.message,
      ...details
    });
  }
}

/**
 * Image Error Handler Class
 * Handles errors, retries, and fallback mechanisms for image operations
 */
export class ImageErrorHandler {
  constructor() {
    this.maxRetries = 3;
    this.baseDelay = 1000; // 1 second
    this.maxDelay = 10000; // 10 seconds
    this.fallbackEnabled = true;
    this.localStoragePath = path.join(process.cwd(), 'uploads', 'fallback');
  }

  /**
   * Execute operation with retry logic and exponential backoff
   * @param {Function} operation - The operation to execute
   * @param {Object} options - Retry options
   * @returns {Promise<any>} Operation result
   */
  async executeWithRetry(operation, options = {}) {
    const {
      maxRetries = this.maxRetries,
      baseDelay = this.baseDelay,
      maxDelay = this.maxDelay,
      operationName = 'operation'
    } = options;

    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempting ${operationName} (attempt ${attempt}/${maxRetries})`);
        const result = await operation();
        
        if (attempt > 1) {
          console.log(`${operationName} succeeded on attempt ${attempt}`);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        console.error(`${operationName} failed on attempt ${attempt}:`, error.message);
        
        // Don't retry on certain types of errors
        if (this.isNonRetryableError(error)) {
          console.log(`Non-retryable error detected, stopping retries`);
          throw error;
        }
        
        // If this was the last attempt, don't wait
        if (attempt === maxRetries) {
          break;
        }
        
        // Calculate delay with exponential backoff and jitter
        const delay = Math.min(
          baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000,
          maxDelay
        );
        
        console.log(`Waiting ${delay}ms before retry...`);
        await this.sleep(delay);
      }
    }
    
    throw new RetryExhaustedError(maxRetries, lastError, {
      operationName,
      attempts: maxRetries
    });
  }

  /**
   * Check if an error should not be retried
   * @param {Error} error - The error to check
   * @returns {boolean} True if error should not be retried
   */
  isNonRetryableError(error) {
    const nonRetryablePatterns = [
      /invalid.*credentials/i,
      /unauthorized/i,
      /forbidden/i,
      /file.*too.*large/i,
      /invalid.*file.*type/i,
      /malformed/i,
      /bad.*request/i
    ];
    
    return nonRetryablePatterns.some(pattern => 
      pattern.test(error.message) || pattern.test(error.code)
    );
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create fallback local storage configuration
   * @returns {Object} Multer storage configuration
   */
  createFallbackStorage() {
    return multer.diskStorage({
      destination: async (req, file, cb) => {
        try {
          // Ensure fallback directory exists
          await fs.mkdir(this.localStoragePath, { recursive: true });
          cb(null, this.localStoragePath);
        } catch (error) {
          console.error('Failed to create fallback directory:', error);
          cb(error);
        }
      },
      filename: (req, file, cb) => {
        // Generate unique filename with timestamp
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        const extension = path.extname(file.originalname);
        const filename = `fallback_${timestamp}_${randomString}${extension}`;
        cb(null, filename);
      }
    });
  }

  /**
   * Handle Cloudinary upload with fallback to local storage
   * @param {Function} cloudinaryUpload - Cloudinary upload function
   * @param {Object} file - File object
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result
   */
  async handleUploadWithFallback(cloudinaryUpload, file, options = {}) {
    try {
      // First, try Cloudinary upload with retry
      const result = await this.executeWithRetry(
        () => cloudinaryUpload(file, options),
        {
          operationName: 'Cloudinary upload',
          maxRetries: this.maxRetries
        }
      );
      
      return {
        success: true,
        storage: 'cloudinary',
        url: result.url,
        publicId: result.publicId,
        ...result
      };
      
    } catch (error) {
      console.error('Cloudinary upload failed completely:', error.message);
      
      // If fallback is disabled, throw the error
      if (!this.fallbackEnabled) {
        throw new CloudinaryUnavailableError(error, {
          fallbackDisabled: true
        });
      }
      
      // Try fallback to local storage
      try {
        console.log('Attempting fallback to local storage...');
        const fallbackResult = await this.saveToLocalFallback(file);
        
        return {
          success: true,
          storage: 'local_fallback',
          url: fallbackResult.url,
          localPath: fallbackResult.path,
          fallbackReason: error.message,
          requiresMigration: true
        };
        
      } catch (fallbackError) {
        console.error('Fallback storage also failed:', fallbackError.message);
        
        throw new ImageUploadError(
          'Both cloud and fallback storage failed',
          'COMPLETE_UPLOAD_FAILURE',
          {
            cloudinaryError: error.message,
            fallbackError: fallbackError.message
          }
        );
      }
    }
  }

  /**
   * Save file to local fallback storage
   * @param {Object} file - File object or buffer
   * @returns {Promise<Object>} Save result
   */
  async saveToLocalFallback(file) {
    try {
      // Ensure fallback directory exists
      await fs.mkdir(this.localStoragePath, { recursive: true });
      
      // Generate unique filename
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const extension = file.originalname ? path.extname(file.originalname) : '.jpg';
      const filename = `fallback_${timestamp}_${randomString}${extension}`;
      const filePath = path.join(this.localStoragePath, filename);
      
      // Save file data
      if (file.buffer) {
        // File is in memory (buffer)
        await fs.writeFile(filePath, file.buffer);
      } else if (file.path) {
        // File is already on disk, copy it
        await fs.copyFile(file.path, filePath);
      } else {
        throw new Error('Invalid file object: no buffer or path');
      }
      
      // Generate URL for local file
      const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
      const url = `${baseUrl}/uploads/fallback/${filename}`;
      
      console.log(`File saved to fallback storage: ${filename}`);
      
      return {
        path: filePath,
        filename,
        url,
        size: file.size || (await fs.stat(filePath)).size
      };
      
    } catch (error) {
      throw new ImageUploadError(
        'Failed to save to fallback storage',
        'FALLBACK_SAVE_FAILED',
        { originalError: error.message }
      );
    }
  }

  /**
   * Check Cloudinary service health
   * @param {Object} cloudinaryService - Cloudinary service instance
   * @returns {Promise<Object>} Health check result
   */
  async checkCloudinaryHealth(cloudinaryService) {
    try {
      const isReady = cloudinaryService.isReady();
      if (!isReady) {
        return {
          healthy: false,
          reason: 'Service not configured',
          canRetry: false
        };
      }
      
      const connectionTest = await cloudinaryService.testConnection();
      return {
        healthy: connectionTest,
        reason: connectionTest ? 'Service healthy' : 'Connection test failed',
        canRetry: !connectionTest
      };
      
    } catch (error) {
      return {
        healthy: false,
        reason: error.message,
        canRetry: !this.isNonRetryableError(error)
      };
    }
  }

  /**
   * Create error response for API
   * @param {Error} error - The error that occurred
   * @param {Object} context - Additional context
   * @returns {Object} Formatted error response
   */
  createErrorResponse(error, context = {}) {
    const baseResponse = {
      success: false,
      timestamp: new Date().toISOString(),
      ...context
    };

    if (error instanceof CloudinaryUnavailableError) {
      return {
        ...baseResponse,
        error: 'CLOUDINARY_UNAVAILABLE',
        message: 'Cloud storage is temporarily unavailable',
        userMessage: 'Image upload service is experiencing issues. Your image has been saved and will be processed when the service is restored.',
        details: error.details,
        fallbackUsed: !error.details.fallbackDisabled
      };
    }

    if (error instanceof RetryExhaustedError) {
      return {
        ...baseResponse,
        error: 'UPLOAD_FAILED_AFTER_RETRIES',
        message: `Upload failed after ${error.details.attempts} attempts`,
        userMessage: 'We tried multiple times but couldn\'t upload your image. Please try again later.',
        details: error.details
      };
    }

    if (error instanceof ImageUploadError) {
      return {
        ...baseResponse,
        error: error.errorCode,
        message: error.message,
        userMessage: this.getUserFriendlyMessage(error.errorCode),
        details: error.details
      };
    }

    // Generic error
    return {
      ...baseResponse,
      error: 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      userMessage: 'Something went wrong while uploading your image. Please try again.',
      details: { originalError: error.message }
    };
  }

  /**
   * Get user-friendly error message
   * @param {string} errorCode - Error code
   * @returns {string} User-friendly message
   */
  getUserFriendlyMessage(errorCode) {
    const messages = {
      'CLOUDINARY_UNAVAILABLE': 'Image upload service is temporarily unavailable. Your image has been saved locally.',
      'RETRY_EXHAUSTED': 'We tried multiple times but couldn\'t upload your image. Please try again later.',
      'COMPLETE_UPLOAD_FAILURE': 'Image upload failed completely. Please check your file and try again.',
      'FALLBACK_SAVE_FAILED': 'Unable to save image. Please try again with a different file.',
      'FILE_TOO_LARGE': 'Your image is too large. Please use an image smaller than 10MB.',
      'INVALID_FILE_TYPE': 'Please upload a valid image file (JPEG, PNG, GIF, or WebP).',
      'NETWORK_ERROR': 'Network connection issue. Please check your internet connection and try again.'
    };

    return messages[errorCode] || 'An error occurred while uploading your image. Please try again.';
  }

  /**
   * Enable or disable fallback storage
   * @param {boolean} enabled - Whether fallback is enabled
   */
  setFallbackEnabled(enabled) {
    this.fallbackEnabled = enabled;
    console.log(`Fallback storage ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Configure retry settings
   * @param {Object} settings - Retry settings
   */
  configureRetry(settings = {}) {
    if (settings.maxRetries !== undefined) {
      this.maxRetries = Math.max(1, Math.min(10, settings.maxRetries));
    }
    if (settings.baseDelay !== undefined) {
      this.baseDelay = Math.max(100, settings.baseDelay);
    }
    if (settings.maxDelay !== undefined) {
      this.maxDelay = Math.max(this.baseDelay, settings.maxDelay);
    }
    
    console.log(`Retry configured: maxRetries=${this.maxRetries}, baseDelay=${this.baseDelay}ms, maxDelay=${this.maxDelay}ms`);
  }
}

// Create and export singleton instance
const imageErrorHandler = new ImageErrorHandler();

export default imageErrorHandler;