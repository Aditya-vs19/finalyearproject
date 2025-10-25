/**
 * Backend image validation utilities for server-side image accessibility checks
 */

import fetch from 'node-fetch';

/**
 * Sleep utility for retry delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Log image validation errors with comprehensive context
 * @param {string} url - Image URL that failed
 * @param {Error} error - Error object
 * @param {number} attempt - Current attempt number
 * @param {Object} context - Additional context information
 */
const logImageValidationError = (url, error, attempt, context = {}) => {
  const errorInfo = {
    timestamp: new Date().toISOString(),
    url,
    attempt,
    error: {
      message: error.message,
      name: error.name,
      stack: error.stack
    },
    context,
    environment: 'server',
    isCloudinary: url && (url.includes('cloudinary.com') || url.includes('res.cloudinary.com'))
  };

  console.error('Server image validation failed:', errorInfo);
  
  // Additional logging for debugging
  if (attempt === 1) {
    console.warn(`First server attempt failed for image: ${url}`);
  } else {
    console.warn(`Server retry attempt ${attempt} failed for image: ${url}`);
  }
};

/**
 * Validate image URL accessibility with retry mechanism and exponential backoff (server-side)
 * @param {string} url - Image URL to validate
 * @param {Object} options - Validation options
 * @param {number} options.maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} options.initialDelay - Initial delay in milliseconds (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in milliseconds (default: 10000)
 * @param {number} options.backoffMultiplier - Multiplier for exponential backoff (default: 2)
 * @param {number} options.timeout - Request timeout in milliseconds (default: 5000)
 * @param {Object} options.context - Additional context for logging
 * @param {boolean} options.detailed - Return detailed diagnostic information (default: false)
 * @returns {Promise<{isAccessible: boolean, attempts: number, lastError: Error|null, statusCode?: number, contentType?: string, contentLength?: number, error?: string}>}
 */
const validateImageUrl = async (url, options = {}) => {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    timeout = 5000,
    context = {},
    detailed = false
  } = options;

  if (!url || typeof url !== 'string') {
    const error = new Error('Invalid URL provided for validation');
    logImageValidationError(url, error, 0, { ...context, reason: 'invalid_url' });
    const result = { isAccessible: false, attempts: 0, lastError: error };
    if (detailed) {
      result.error = error.message;
    }
    return result;
  }

  let lastError = null;
  let delay = initialDelay;
  let lastResponse = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, { 
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'GP-Connect-Server/1.0',
          'Accept': 'image/*,*/*;q=0.8'
        }
      });

      clearTimeout(timeoutId);
      lastResponse = response;

      if (response.ok) {
        // Success - log if this was after retries
        if (attempt > 1) {
          console.info(`Server image validation succeeded on attempt ${attempt} for: ${url}`);
        }
        
        const result = { isAccessible: true, attempts: attempt, lastError: null };
        
        if (detailed) {
          result.statusCode = response.status;
          result.contentType = response.headers.get('content-type');
          result.contentLength = response.headers.get('content-length') ? 
            parseInt(response.headers.get('content-length')) : null;
        }
        
        return result;
      } else {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        lastError = error;
        logImageValidationError(url, error, attempt, { 
          ...context, 
          httpStatus: response.status,
          httpStatusText: response.statusText,
          reason: 'http_error'
        });
      }
    } catch (error) {
      lastError = error;
      
      // Handle specific error types
      let errorContext = { ...context };
      if (error.name === 'AbortError') {
        errorContext.reason = 'timeout';
        errorContext.timeoutMs = timeout;
      } else if (error.message.includes('ENOTFOUND')) {
        errorContext.reason = 'dns_error';
      } else if (error.message.includes('ECONNREFUSED')) {
        errorContext.reason = 'connection_refused';
      } else if (error.message.includes('network')) {
        errorContext.reason = 'network_error';
      } else {
        errorContext.reason = 'unknown_error';
      }

      logImageValidationError(url, error, attempt, errorContext);
    }

    // Don't wait after the last attempt
    if (attempt <= maxRetries) {
      console.info(`Retrying server image validation in ${delay}ms for: ${url}`);
      await sleep(delay);
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  const result = { isAccessible: false, attempts: maxRetries + 1, lastError };
  
  if (detailed) {
    result.error = lastError ? lastError.message : 'Unknown error';
    if (lastResponse) {
      result.statusCode = lastResponse.status;
      result.contentType = lastResponse.headers.get('content-type');
      result.contentLength = lastResponse.headers.get('content-length') ? 
        parseInt(lastResponse.headers.get('content-length')) : null;
    }
  }
  
  return result;
};

/**
 * Validate multiple image URLs concurrently with individual retry logic (server-side)
 * @param {string[]} urls - Array of image URLs to validate
 * @param {Object} options - Validation options (same as validateImageUrl)
 * @returns {Promise<Array<{url: string, isAccessible: boolean, attempts: number, lastError: Error|null}>>}
 */
const validateMultipleImageUrls = async (urls, options = {}) => {
  if (!Array.isArray(urls)) {
    throw new Error('URLs must be provided as an array');
  }

  const validationPromises = urls.map(async (url, index) => {
    const result = await validateImageUrl(url, {
      ...options,
      context: { ...options.context, batchIndex: index, batchSize: urls.length }
    });
    return { url, ...result };
  });

  return Promise.all(validationPromises);
};

/**
 * Quick image accessibility check without retries (server-side, for performance-sensitive scenarios)
 * @param {string} url - Image URL to validate
 * @param {number} timeout - Request timeout in milliseconds (default: 2000)
 * @returns {Promise<boolean>} - Whether the image is accessible
 */
const quickValidateImageUrl = async (url, timeout = 2000) => {
  if (!url || typeof url !== 'string') return false;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, { 
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'GP-Connect-Server/1.0',
        'Accept': 'image/*,*/*;q=0.8'
      }
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    // Silent failure for quick validation
    return false;
  }
};

/**
 * Validate that an uploaded image is immediately accessible after Cloudinary upload
 * @param {string} imageUrl - Cloudinary image URL to validate
 * @param {Object} context - Additional context (userId, postId, etc.)
 * @returns {Promise<{isAccessible: boolean, attempts: number, lastError: Error|null}>}
 */
const validateUploadedImage = async (imageUrl, context = {}) => {
  return validateImageUrl(imageUrl, {
    maxRetries: 2, // Fewer retries for upload validation
    initialDelay: 500, // Shorter initial delay
    context: {
      ...context,
      validationType: 'post_upload'
    }
  });
};

export {
  validateImageUrl,
  validateMultipleImageUrls,
  quickValidateImageUrl,
  validateUploadedImage
};