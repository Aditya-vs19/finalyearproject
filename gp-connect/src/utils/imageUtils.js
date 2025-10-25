// Image utility functions for handling image URLs and fallbacks

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Detect if a URL is a Cloudinary URL
 * @param {string} url - URL to check
 * @returns {boolean} - Whether the URL is from Cloudinary
 */
export const isCloudinaryUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  return url.includes('cloudinary.com') || url.includes('res.cloudinary.com');
};

/**
 * Validate and preserve Cloudinary URL format
 * @param {string} url - Cloudinary URL to validate
 * @returns {string} - Validated Cloudinary URL
 */
export const validateCloudinaryUrl = (url) => {
  if (!isCloudinaryUrl(url)) {
    throw new Error('Invalid Cloudinary URL format');
  }
  
  // Ensure the URL is properly formatted
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error('Cloudinary URL must include protocol');
  }
  
  return url;
};

/**
 * Check if a URL is a localhost URL from another machine
 * @param {string} url - URL to check
 * @returns {boolean} - Whether the URL is from localhost
 */
export const isLocalhostUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  return url.includes('localhost:') || url.includes('127.0.0.1:');
};

/**
 * Get the full URL for an uploaded image
 * @param {string} imagePath - The image path from database
 * @returns {string} - Full URL to the image
 */
export const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  
  // Handle Cloudinary URLs directly - don't modify them
  if (isCloudinaryUrl(imagePath)) {
    return validateCloudinaryUrl(imagePath);
  }
  
  // Check if this is a localhost URL from another machine - return null to trigger fallback
  if (isLocalhostUrl(imagePath)) {
    console.warn('Detected localhost URL from another machine, will use fallback:', imagePath);
    return null;
  }
  
  // Handle other full URLs (other cloud providers)
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // Handle local server URLs (fallback/legacy)
  if (imagePath.startsWith('/')) {
    return `${API_BASE_URL}${imagePath}`;
  }
  
  // Otherwise, add the base URL
  return `${API_BASE_URL}/${imagePath}`;
};

/**
 * Get profile picture URL with fallback
 * @param {string} profilePic - Profile picture path
 * @returns {string} - URL to profile picture or default avatar
 */
export const getProfilePicUrl = (profilePic) => {
  return profilePic ? getImageUrl(profilePic) : '/default-avatar.svg';
};

/**
 * Get post image URL with localhost detection
 * @param {string} imagePath - Post image path
 * @returns {string} - URL to post image or null if unavailable
 */
export const getPostImageUrl = (imagePath) => {
  const url = getImageUrl(imagePath);
  
  // If the original path was a localhost URL, return null to trigger fallback
  if (!url && isLocalhostUrl(imagePath)) {
    return null;
  }
  
  return url;
};

/**
 * Handle image load error by setting fallback
 * @param {Event} event - Image load error event
 * @param {string} fallbackSrc - Fallback image source
 */
export const handleImageError = (event, fallbackSrc = '/default-avatar.svg') => {
  event.target.src = fallbackSrc;
  event.target.style.display = 'block';
};

/**
 * Handle image load success
 * @param {Event} event - Image load success event
 */
export const handleImageLoad = (event) => {
  event.target.style.display = 'block';
};

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
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server',
    isCloudinary: isCloudinaryUrl(url)
  };

  console.error('Image validation failed:', errorInfo);
  
  // Additional logging for debugging
  if (attempt === 1) {
    console.warn(`First attempt failed for image: ${url}`);
  } else {
    console.warn(`Retry attempt ${attempt} failed for image: ${url}`);
  }
};

/**
 * Validate image URL accessibility with retry mechanism and exponential backoff
 * @param {string} url - Image URL to validate
 * @param {Object} options - Validation options
 * @param {number} options.maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} options.initialDelay - Initial delay in milliseconds (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in milliseconds (default: 10000)
 * @param {number} options.backoffMultiplier - Multiplier for exponential backoff (default: 2)
 * @param {number} options.timeout - Request timeout in milliseconds (default: 5000)
 * @param {Object} options.context - Additional context for logging
 * @returns {Promise<{isAccessible: boolean, attempts: number, lastError: Error|null}>}
 */
export const validateImageUrl = async (url, options = {}) => {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    timeout = 5000,
    context = {}
  } = options;

  if (!url || typeof url !== 'string') {
    const error = new Error('Invalid URL provided for validation');
    logImageValidationError(url, error, 0, { ...context, reason: 'invalid_url' });
    return { isAccessible: false, attempts: 0, lastError: error };
  }

  let lastError = null;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, { 
        method: 'HEAD',
        signal: controller.signal,
        // Add headers to avoid CORS issues
        headers: {
          'Accept': 'image/*,*/*;q=0.8'
        }
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        // Success - log if this was after retries
        if (attempt > 1) {
          console.info(`Image validation succeeded on attempt ${attempt} for: ${url}`);
        }
        return { isAccessible: true, attempts: attempt, lastError: null };
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
      } else if (error.message.includes('CORS')) {
        errorContext.reason = 'cors_error';
      } else if (error.message.includes('network')) {
        errorContext.reason = 'network_error';
      } else {
        errorContext.reason = 'unknown_error';
      }

      logImageValidationError(url, error, attempt, errorContext);
    }

    // Don't wait after the last attempt
    if (attempt <= maxRetries) {
      console.info(`Retrying image validation in ${delay}ms for: ${url}`);
      await sleep(delay);
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  return { isAccessible: false, attempts: maxRetries + 1, lastError };
};

/**
 * Validate multiple image URLs concurrently with individual retry logic
 * @param {string[]} urls - Array of image URLs to validate
 * @param {Object} options - Validation options (same as validateImageUrl)
 * @returns {Promise<Array<{url: string, isAccessible: boolean, attempts: number, lastError: Error|null}>>}
 */
export const validateMultipleImageUrls = async (urls, options = {}) => {
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
 * Quick image accessibility check without retries (for performance-sensitive scenarios)
 * @param {string} url - Image URL to validate
 * @param {number} timeout - Request timeout in milliseconds (default: 2000)
 * @returns {Promise<boolean>} - Whether the image is accessible
 */
export const quickValidateImageUrl = async (url, timeout = 2000) => {
  if (!url || typeof url !== 'string') return false;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, { 
      method: 'HEAD',
      signal: controller.signal,
      headers: {
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
 * Check if an image exists by trying to load it
 * @param {string} url - Image URL to check
 * @returns {Promise<boolean>} - Whether the image exists
 */
export const checkImageExists = async (url) => {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    return false;
  }
};

/**
 * Get a placeholder image for missing images
 * @param {string} type - Type of placeholder ('profile' or 'post')
 * @returns {string} - Placeholder image URL
 */
export const getPlaceholderImage = (type = 'post') => {
  const placeholders = {
    profile: '/default-avatar.svg',
    post: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBhdmFpbGFibGU8L3RleHQ+PC9zdmc+'
  };
  
  return placeholders[type] || placeholders.post;
};
