/**
 * Error Handling Example
 * Demonstrates how to use the enhanced upload middleware with error handling and fallback
 * 
 * Requirements: 2.4, 3.3
 */

import express from 'express';
import { enhancedUploadSingle, handleUploadError } from '../middleware/errorHandlingUpload.js';

const app = express();

// Example endpoint using enhanced upload with error handling
app.post('/api/posts/upload-with-fallback', 
  enhancedUploadSingle('image'),
  handleUploadError,
  (req, res) => {
    try {
      if (req.uploadedFile) {
        res.json({
          success: true,
          message: 'Image uploaded successfully',
          file: {
            url: req.uploadedFile.url,
            storage: req.uploadedFile.storage,
            requiresMigration: req.uploadedFile.requiresMigration || false,
            fallbackReason: req.uploadedFile.fallbackReason || null
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }
    } catch (error) {
      console.error('Post-upload processing error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process uploaded file'
      });
    }
  }
);

// Example of graceful degradation status endpoint
app.get('/api/upload/status', (req, res) => {
  res.json({
    message: 'Upload service supports graceful degradation',
    features: {
      cloudinaryUpload: 'Primary storage with retry logic',
      fallbackStorage: 'Local storage when Cloudinary is unavailable',
      automaticRetry: 'Exponential backoff for transient failures',
      errorHandling: 'Comprehensive error classification and user-friendly messages'
    },
    usage: {
      endpoint: '/api/posts/upload-with-fallback',
      method: 'POST',
      field: 'image',
      maxSize: '10MB',
      supportedTypes: ['JPEG', 'PNG', 'GIF', 'WebP']
    }
  });
});

export default app;