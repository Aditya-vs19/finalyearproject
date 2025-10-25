# Image Upload Error Handling and Fallback System

This document describes the comprehensive error handling and fallback mechanisms implemented for image uploads.

## Overview

The system provides graceful degradation when Cloudinary is unavailable through:
- Retry logic with exponential backoff
- Fallback to local storage for critical failures
- Comprehensive error handling and user-friendly messages
- Automatic migration capabilities

## Components

### 1. Image Error Handler Service (`services/imageErrorHandler.js`)

Core service providing:
- Custom error classes for different failure scenarios
- Retry logic with exponential backoff and jitter
- Fallback storage management
- Health checking capabilities
- User-friendly error message generation

### 2. Enhanced Upload Middleware (`middleware/errorHandlingUpload.js`)

Middleware that wraps existing Cloudinary upload with:
- Pre-upload health checks
- Automatic retry on transient failures
- Fallback to local storage when Cloudinary fails
- Comprehensive error classification

### 3. Fallback Migration Service (`services/fallbackMigrationService.js`)

Service for managing fallback images:
- Scanning for images requiring migration
- Batch migration to Cloudinary when service is restored
- Automatic cleanup of migrated files
- Migration status tracking

## Usage

### Basic Enhanced Upload

```javascript
import { enhancedUploadSingle, handleUploadError } from './middleware/errorHandlingUpload.js';

app.post('/upload', 
  enhancedUploadSingle('image'),
  handleUploadError,
  (req, res) => {
    if (req.uploadedFile) {
      res.json({
        success: true,
        file: req.uploadedFile
      });
    }
  }
);
```

### Error Response Format

```json
{
  "success": false,
  "error": "CLOUDINARY_UNAVAILABLE",
  "message": "Cloud storage is temporarily unavailable",
  "userMessage": "Image upload service is experiencing issues. Your image has been saved and will be processed when the service is restored.",
  "timestamp": "2023-12-07T10:30:00.000Z",
  "context": {
    "operation": "upload_with_fallback",
    "attempts": 3
  }
}
```

### File Metadata

When upload succeeds, `req.uploadedFile` contains:

```javascript
{
  url: "https://cloudinary.com/image.jpg", // or local fallback URL
  originalName: "photo.jpg",
  size: 1024000,
  mimetype: "image/jpeg",
  storage: "cloudinary", // or "local_fallback"
  requiresMigration: false, // true for fallback storage
  fallbackReason: null, // reason if fallback was used
  uploadMode: "cloudinary_primary"
}
```

## Error Types

### Retryable Errors
- Network timeouts
- Connection refused
- Service temporarily unavailable
- Rate limiting

### Non-Retryable Errors
- Invalid credentials
- Unauthorized access
- File too large
- Invalid file type
- Malformed requests

## Configuration

### Retry Settings

```javascript
imageErrorHandler.configureRetry({
  maxRetries: 3,        // Maximum retry attempts
  baseDelay: 1000,      // Base delay in milliseconds
  maxDelay: 10000       // Maximum delay cap
});
```

### Fallback Settings

```javascript
imageErrorHandler.setFallbackEnabled(true); // Enable/disable fallback storage
```

## Monitoring

### Health Check Endpoint

```
GET /api/image-service/status
```

Returns current service status including:
- Cloudinary health status
- Migration queue status
- Fallback configuration
- Retry settings

### Migration Management

```
POST /api/image-service/migrate
```

Manually trigger migration of fallback images with options:
- `dryRun`: Preview migration without executing
- `batchSize`: Number of images to process simultaneously
- `deleteAfterMigration`: Remove local files after successful migration

## Best Practices

1. **Monitor Service Health**: Regularly check the status endpoint to monitor system health
2. **Handle Fallback Gracefully**: Inform users when fallback storage is used
3. **Plan for Migration**: Schedule migration during low-traffic periods
4. **Test Error Scenarios**: Regularly test with Cloudinary unavailable to ensure fallback works
5. **User Communication**: Use user-friendly error messages from the error handler

## Testing

The system includes comprehensive tests for:
- Retry logic and exponential backoff
- Fallback storage functionality
- Error classification and response generation
- Migration service operations
- Integration scenarios

Run tests with:
```bash
npm test -- errorHandlingUpload.test.js
npm test -- imageErrorHandler.test.js
npm test -- fallbackMigrationService.test.js
```

## Requirements Satisfied

- **2.4**: Graceful degradation when Cloudinary is unavailable ✅
- **3.3**: Comprehensive error handling and fallback mechanisms ✅
- Retry logic with exponential backoff ✅
- Fallback to local storage for critical failures ✅
- Error handling tests for various failure scenarios ✅