/**
 * Enhanced Upload Middleware with Error Handling and Fallback
 * Wraps the existing Cloudinary upload with comprehensive error handling
 * 
 * Requirements: 2.4, 3.3
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import uploadSingle from './cloudinaryUpload.js';
import imageErrorHandler from '../services/imageErrorHandler.js';
import cloudinaryService from '../services/cloudinaryService.js';

/**
 * Enhanced upload middleware with retry logic and fallback
 * @param {string} fieldName - Field name for the upload
 * @returns {Array} Middleware array
 */
export const enhancedUploadSingle = (fieldName = 'image') => {
  return [
    // Pre-upload health check
    async (req, res, next) => {
      try {
        // Check if Cloudinary is configured and healthy
        if (!cloudinaryService.isReady()) {
          console.log('Cloudinary not ready, will attempt fallback if upload fails');
        }
        
        // Add retry context to request
        req.uploadAttempts = 0;
        req.maxRetries = 3;
        next();
      } catch (error) {
        console.error('Pre-upload check failed:', error);
        next(error);
      }
    },
    
    // Main upload with retry wrapper
    async (req, res, next) => {
      const attemptUpload = async (attempt = 1) => {
        return new Promise((resolve, reject) => {
          const middleware = uploadSingle(fieldName);
          
          // Create a mock response to capture errors
          const mockRes = {
            status: (code) => mockRes,
            json: (data) => {
              if (data.success === false) {
                reject(new Error(data.message || 'Upload failed'));
              } else {
                resolve();
              }
            }
          };
          
          // Execute the upload middleware
          middleware[1](req, mockRes, (error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        });
      };
      
      // Retry logic with exponential backoff
      let lastError;
      for (let attempt = 1; attempt <= req.maxRetries; attempt++) {
        try {
          req.uploadAttempts = attempt;
          await attemptUpload(attempt);
          
          // Success - continue to next middleware
          return next();
        } catch (error) {
          lastError = error;
          console.error(`Upload attempt ${attempt} failed:`, error.message);
          
          // Don't retry on certain errors
          if (isNonRetryableError(error)) {
            console.log('Non-retryable error, stopping retries');
            break;
          }
          
          // If this was the last attempt, break
          if (attempt === req.maxRetries) {
            break;
          }
          
          // Wait before retry with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.log(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      // All retries failed, try fallback
      try {
        console.log('All upload attempts failed, trying fallback storage...');
        await handleFallbackUpload(req, res);
        next();
      } catch (fallbackError) {
        console.error('Fallback upload also failed:', fallbackError);
        
        // Create comprehensive error response
        const errorResponse = imageErrorHandler.createErrorResponse(lastError, {
          operation: 'upload_with_fallback',
          attempts: req.maxRetries,
          fallbackError: fallbackError.message
        });
        
        return res.status(500).json(errorResponse);
      }
    }
  ];
};

/**
 * Handle fallback upload to local storage
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function handleFallbackUpload(req, res) {
  if (!req.file && !req.body.image) {
    throw new Error('No file to save to fallback storage');
  }
  
  // Create fallback directory
  const fallbackDir = path.join(process.cwd(), 'uploads', 'fallback');
  await fs.mkdir(fallbackDir, { recursive: true });
  
  // Generate unique filename
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const extension = req.file ? path.extname(req.file.originalname) : '.jpg';
  const filename = `fallback_${timestamp}_${randomString}${extension}`;
  const filePath = path.join(fallbackDir, filename);
  
  // Save file
  if (req.file && req.file.buffer) {
    await fs.writeFile(filePath, req.file.buffer);
  } else if (req.file && req.file.path) {
    await fs.copyFile(req.file.path, filePath);
  } else {
    throw new Error('Invalid file data for fallback storage');
  }
  
  // Generate URL
  const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
  const url = `${baseUrl}/uploads/fallback/${filename}`;
  
  // Update request with fallback file info
  req.uploadedFile = {
    url,
    originalName: req.file?.originalname || 'unknown',
    size: req.file?.size || 0,
    mimetype: req.file?.mimetype || 'image/jpeg',
    storage: 'local_fallback',
    requiresMigration: true,
    fallbackReason: 'Cloudinary upload failed after retries',
    localPath: filePath,
    filename
  };
  
  console.log(`File saved to fallback storage: ${filename}`);
}

/**
 * Check if error should not be retried
 * @param {Error} error - The error to check
 * @returns {boolean} True if error should not be retried
 */
function isNonRetryableError(error) {
  const nonRetryablePatterns = [
    /invalid.*credentials/i,
    /unauthorized/i,
    /forbidden/i,
    /file.*too.*large/i,
    /invalid.*file.*type/i,
    /malformed/i,
    /bad.*request/i,
    /limit.*file.*size/i,
    /limit.*file.*count/i
  ];
  
  return nonRetryablePatterns.some(pattern => 
    pattern.test(error.message) || pattern.test(error.code)
  );
}

/**
 * Enhanced error handling middleware for upload errors
 */
export const handleUploadError = (error, req, res, next) => {
  console.error('Upload error:', error);
  
  const errorResponse = imageErrorHandler.createErrorResponse(error, {
    operation: 'enhanced_upload',
    attempts: req.uploadAttempts || 0,
    maxRetries: req.maxRetries || 0
  });
  
  // Determine status code based on error type
  let statusCode = 500;
  if (error.message.toLowerCase().includes('too large')) statusCode = 413;
  if (error.message.toLowerCase().includes('invalid') || error.message.toLowerCase().includes('forbidden')) statusCode = 400;
  if (error.message.toLowerCase().includes('unauthorized')) statusCode = 401;
  
  res.status(statusCode).json(errorResponse);
};

export default enhancedUploadSingle;