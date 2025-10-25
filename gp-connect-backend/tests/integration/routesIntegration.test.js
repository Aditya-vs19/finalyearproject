import { describe, it, expect } from 'vitest';
import { uploadSingle } from '../../middleware/cloudinaryUpload.js';

describe('Route Integration Tests', () => {
  describe('Cloudinary Middleware Integration', () => {
    it('should export uploadSingle middleware function', () => {
      expect(uploadSingle).toBeDefined();
      expect(typeof uploadSingle).toBe('function');
    });

    it('should return middleware array when called', () => {
      const middleware = uploadSingle('image');
      expect(Array.isArray(middleware)).toBe(true);
      expect(middleware.length).toBeGreaterThan(0);
    });

    it('should handle different field names', () => {
      const imageMiddleware = uploadSingle('image');
      const profileMiddleware = uploadSingle('profilePic');
      
      expect(Array.isArray(imageMiddleware)).toBe(true);
      expect(Array.isArray(profileMiddleware)).toBe(true);
    });
  });

  describe('Route Configuration Validation', () => {
    it('should validate that routes are properly configured', async () => {
      // Test that the route files can be imported without errors
      try {
        const postRoutes = await import('../../routes/postRoutes.js');
        const profileRoutes = await import('../../routes/profileRoutes.js');
        const communityRoutes = await import('../../routes/communityRoutes.js');
        
        expect(postRoutes.default).toBeDefined();
        expect(profileRoutes.default).toBeDefined();
        expect(communityRoutes.default).toBeDefined();
      } catch (error) {
        throw new Error(`Route import failed: ${error.message}`);
      }
    });

    it('should validate middleware imports', async () => {
      try {
        const cloudinaryUpload = await import('../../middleware/cloudinaryUpload.js');
        
        expect(cloudinaryUpload.uploadSingle).toBeDefined();
        expect(cloudinaryUpload.uploadMultiple).toBeDefined();
        expect(cloudinaryUpload.handleUploadError).toBeDefined();
        expect(cloudinaryUpload.checkServiceAvailability).toBeDefined();
      } catch (error) {
        throw new Error(`Middleware import failed: ${error.message}`);
      }
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain expected middleware interface', () => {
      const middleware = uploadSingle('image');
      
      // Should return an array of middleware functions
      expect(Array.isArray(middleware)).toBe(true);
      
      // Each middleware should be a function
      middleware.forEach(mw => {
        expect(typeof mw).toBe('function');
      });
    });

    it('should handle standard multer field names', () => {
      const standardFields = ['image', 'profilePic', 'avatar', 'photo'];
      
      standardFields.forEach(field => {
        const middleware = uploadSingle(field);
        expect(Array.isArray(middleware)).toBe(true);
        expect(middleware.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling Integration', () => {
    it('should have error handling middleware available', async () => {
      try {
        const { handleUploadError } = await import('../../middleware/cloudinaryUpload.js');
        expect(handleUploadError).toBeDefined();
        expect(typeof handleUploadError).toBe('function');
      } catch (error) {
        throw new Error(`Error handling middleware not available: ${error.message}`);
      }
    });

    it('should have service availability check', async () => {
      try {
        const { checkServiceAvailability } = await import('../../middleware/cloudinaryUpload.js');
        expect(checkServiceAvailability).toBeDefined();
        expect(typeof checkServiceAvailability).toBe('function');
      } catch (error) {
        throw new Error(`Service availability check not available: ${error.message}`);
      }
    });
  });
});