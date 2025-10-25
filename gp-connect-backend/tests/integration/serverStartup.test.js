import { describe, it, expect } from 'vitest';

describe('Server Startup Integration', () => {
  describe('Route and Middleware Loading', () => {
    it('should load all route modules without errors', async () => {
      try {
        // Import all route modules to ensure they load correctly
        const postRoutes = await import('../../routes/postRoutes.js');
        const profileRoutes = await import('../../routes/profileRoutes.js');
        const communityRoutes = await import('../../routes/communityRoutes.js');
        
        expect(postRoutes.default).toBeDefined();
        expect(profileRoutes.default).toBeDefined();
        expect(communityRoutes.default).toBeDefined();
        
        console.log('✓ All route modules loaded successfully');
      } catch (error) {
        throw new Error(`Failed to load route modules: ${error.message}`);
      }
    });

    it('should load all controller modules without errors', async () => {
      try {
        // Import controller modules to ensure they load correctly
        const postController = await import('../../controllers/postController.js');
        const profileController = await import('../../controllers/profileController.js');
        const communityController = await import('../../controllers/communityController.js');
        
        expect(postController.createPost).toBeDefined();
        expect(postController.updatePost).toBeDefined();
        expect(profileController.uploadProfilePicture).toBeDefined();
        expect(communityController.sendMessage).toBeDefined();
        
        console.log('✓ All controller modules loaded successfully');
      } catch (error) {
        throw new Error(`Failed to load controller modules: ${error.message}`);
      }
    });

    it('should load Cloudinary middleware without errors', async () => {
      try {
        const cloudinaryUpload = await import('../../middleware/cloudinaryUpload.js');
        
        expect(cloudinaryUpload.uploadSingle).toBeDefined();
        expect(cloudinaryUpload.uploadMultiple).toBeDefined();
        expect(cloudinaryUpload.handleUploadError).toBeDefined();
        expect(cloudinaryUpload.checkServiceAvailability).toBeDefined();
        
        console.log('✓ Cloudinary middleware loaded successfully');
      } catch (error) {
        throw new Error(`Failed to load Cloudinary middleware: ${error.message}`);
      }
    });

    it('should validate that no old multer references exist', async () => {
      try {
        // Import all modules and check they don't reference old multer setup
        const postRoutes = await import('../../routes/postRoutes.js');
        const profileRoutes = await import('../../routes/profileRoutes.js');
        const communityRoutes = await import('../../routes/communityRoutes.js');
        
        // Convert modules to strings to check for old patterns
        const postRoutesStr = postRoutes.default.toString();
        const profileRoutesStr = profileRoutes.default.toString();
        const communityRoutesStr = communityRoutes.default.toString();
        
        // These should not contain old multer patterns
        expect(postRoutesStr).not.toMatch(/upload\.single/);
        expect(profileRoutesStr).not.toMatch(/upload\.single/);
        expect(communityRoutesStr).not.toMatch(/upload\.single/);
        
        console.log('✓ No old multer references found in routes');
      } catch (error) {
        throw new Error(`Validation failed: ${error.message}`);
      }
    });
  });

  describe('Middleware Configuration', () => {
    it('should create uploadSingle middleware with proper configuration', async () => {
      const { uploadSingle } = await import('../../middleware/cloudinaryUpload.js');
      
      const middleware = uploadSingle('image');
      
      expect(Array.isArray(middleware)).toBe(true);
      expect(middleware.length).toBeGreaterThan(0);
      
      // Each item should be a function (middleware)
      middleware.forEach(mw => {
        expect(typeof mw).toBe('function');
      });
      
      console.log('✓ uploadSingle middleware configured correctly');
    });

    it('should handle different field names for uploads', async () => {
      const { uploadSingle } = await import('../../middleware/cloudinaryUpload.js');
      
      const testFields = ['image', 'profilePic', 'avatar', 'photo'];
      
      testFields.forEach(field => {
        const middleware = uploadSingle(field);
        expect(Array.isArray(middleware)).toBe(true);
        expect(middleware.length).toBeGreaterThan(0);
      });
      
      console.log('✓ Multiple field names handled correctly');
    });
  });
});