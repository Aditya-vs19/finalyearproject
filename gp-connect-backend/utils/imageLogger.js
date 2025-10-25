/**
 * Comprehensive image operation logging utility
 * Provides structured logging for all image-related operations with user context
 */

/**
 * Log levels for image operations
 */
const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
};

/**
 * Image operation types for categorization
 */
const OPERATION_TYPES = {
  UPLOAD: 'upload',
  VALIDATION: 'validation',
  DELETE: 'delete',
  TRANSFORM: 'transform',
  ACCESS: 'access',
  DEBUG: 'debug'
};

/**
 * Create a structured log entry for image operations
 * @param {string} level - Log level (error, warn, info, debug)
 * @param {string} operation - Type of operation
 * @param {string} message - Log message
 * @param {Object} context - Additional context information
 * @returns {Object} Structured log entry
 */
const createLogEntry = (level, operation, message, context = {}) => {
  return {
    timestamp: new Date().toISOString(),
    level,
    operation,
    message,
    context: {
      ...context,
      environment: 'server',
      service: 'gp-connect-backend'
    }
  };
};

/**
 * Log image upload operations
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} context - Upload context
 * @param {string} context.userId - User ID performing the upload
 * @param {string} context.filename - Original filename
 * @param {string} context.cloudinaryUrl - Resulting Cloudinary URL
 * @param {string} context.publicId - Cloudinary public ID
 * @param {number} context.fileSize - File size in bytes
 * @param {string} context.mimeType - File MIME type
 * @param {number} context.duration - Upload duration in milliseconds
 */
const logImageUpload = (level, message, context = {}) => {
  const logEntry = createLogEntry(level, OPERATION_TYPES.UPLOAD, message, {
    ...context,
    operationType: 'image_upload'
  });

  console[level]('[IMAGE_UPLOAD]', JSON.stringify(logEntry, null, 2));
  return logEntry;
};

/**
 * Log image validation operations
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} context - Validation context
 * @param {string} context.url - Image URL being validated
 * @param {string} context.userId - User ID (if available)
 * @param {boolean} context.isAccessible - Whether image is accessible
 * @param {number} context.attempts - Number of validation attempts
 * @param {number} context.responseTime - Response time in milliseconds
 * @param {number} context.statusCode - HTTP status code
 * @param {string} context.validationType - Type of validation (upload, debug, etc.)
 */
const logImageValidation = (level, message, context = {}) => {
  const logEntry = createLogEntry(level, OPERATION_TYPES.VALIDATION, message, {
    ...context,
    operationType: 'image_validation',
    isCloudinary: context.url && (context.url.includes('cloudinary.com') || context.url.includes('res.cloudinary.com'))
  });

  console[level]('[IMAGE_VALIDATION]', JSON.stringify(logEntry, null, 2));
  return logEntry;
};

/**
 * Log image access operations (when users view images)
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} context - Access context
 * @param {string} context.userId - User ID accessing the image
 * @param {string} context.imageUrl - Image URL being accessed
 * @param {string} context.postId - Post ID (if applicable)
 * @param {string} context.userAgent - User agent string
 * @param {string} context.ip - User IP address
 * @param {boolean} context.success - Whether access was successful
 */
const logImageAccess = (level, message, context = {}) => {
  const logEntry = createLogEntry(level, OPERATION_TYPES.ACCESS, message, {
    ...context,
    operationType: 'image_access'
  });

  console[level]('[IMAGE_ACCESS]', JSON.stringify(logEntry, null, 2));
  return logEntry;
};

/**
 * Log image deletion operations
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} context - Deletion context
 * @param {string} context.userId - User ID performing the deletion
 * @param {string} context.publicId - Cloudinary public ID being deleted
 * @param {string} context.postId - Post ID (if applicable)
 * @param {boolean} context.success - Whether deletion was successful
 */
const logImageDeletion = (level, message, context = {}) => {
  const logEntry = createLogEntry(level, OPERATION_TYPES.DELETE, message, {
    ...context,
    operationType: 'image_deletion'
  });

  console[level]('[IMAGE_DELETE]', JSON.stringify(logEntry, null, 2));
  return logEntry;
};

/**
 * Log image transformation operations
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} context - Transformation context
 * @param {string} context.originalUrl - Original image URL
 * @param {string} context.transformedUrl - Transformed image URL
 * @param {Object} context.transformations - Applied transformations
 * @param {string} context.userId - User ID (if applicable)
 */
const logImageTransformation = (level, message, context = {}) => {
  const logEntry = createLogEntry(level, OPERATION_TYPES.TRANSFORM, message, {
    ...context,
    operationType: 'image_transformation'
  });

  console[level]('[IMAGE_TRANSFORM]', JSON.stringify(logEntry, null, 2));
  return logEntry;
};

/**
 * Log debug operations (health checks, connectivity tests, etc.)
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} context - Debug context
 * @param {string} context.debugType - Type of debug operation
 * @param {string} context.userId - User ID (if applicable)
 * @param {Object} context.testResults - Debug test results
 * @param {number} context.duration - Operation duration in milliseconds
 */
const logImageDebug = (level, message, context = {}) => {
  const logEntry = createLogEntry(level, OPERATION_TYPES.DEBUG, message, {
    ...context,
    operationType: 'image_debug'
  });

  console[level]('[IMAGE_DEBUG]', JSON.stringify(logEntry, null, 2));
  return logEntry;
};

/**
 * Log general image errors with comprehensive context
 * @param {Error} error - Error object
 * @param {Object} context - Error context
 * @param {string} context.operation - Operation that failed
 * @param {string} context.userId - User ID (if applicable)
 * @param {string} context.url - Image URL (if applicable)
 * @param {Object} context.additionalData - Any additional relevant data
 */
const logImageError = (error, context = {}) => {
  const logEntry = createLogEntry(LOG_LEVELS.ERROR, context.operation || 'unknown', error.message, {
    ...context,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    operationType: 'image_error'
  });

  console.error('[IMAGE_ERROR]', JSON.stringify(logEntry, null, 2));
  return logEntry;
};

/**
 * Create a performance log entry for image operations
 * @param {string} operation - Operation name
 * @param {number} duration - Duration in milliseconds
 * @param {Object} context - Additional context
 * @returns {Object} Performance log entry
 */
const logImagePerformance = (operation, duration, context = {}) => {
  const logEntry = createLogEntry(LOG_LEVELS.INFO, operation, `Operation completed in ${duration}ms`, {
    ...context,
    duration,
    operationType: 'image_performance'
  });

  console.info('[IMAGE_PERFORMANCE]', JSON.stringify(logEntry, null, 2));
  return logEntry;
};

/**
 * Middleware to log image-related HTTP requests
 * @param {string} operation - Operation type
 * @returns {Function} Express middleware function
 */
const createImageLogMiddleware = (operation) => {
  return (req, res, next) => {
    const startTime = Date.now();
    
    // Log request start
    logImageDebug(LOG_LEVELS.INFO, `${operation} request started`, {
      debugType: 'request_start',
      userId: req.user?.id,
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    // Override res.json to log response
    const originalJson = res.json;
    res.json = function(data) {
      const duration = Date.now() - startTime;
      
      logImageDebug(LOG_LEVELS.INFO, `${operation} request completed`, {
        debugType: 'request_complete',
        userId: req.user?.id,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration,
        success: res.statusCode < 400
      });

      return originalJson.call(this, data);
    };

    next();
  };
};

export {
  LOG_LEVELS,
  OPERATION_TYPES,
  logImageUpload,
  logImageValidation,
  logImageAccess,
  logImageDeletion,
  logImageTransformation,
  logImageDebug,
  logImageError,
  logImagePerformance,
  createImageLogMiddleware
};