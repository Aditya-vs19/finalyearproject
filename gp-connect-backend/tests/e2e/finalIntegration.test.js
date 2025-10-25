import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import app from '../../server.js';
import User from '../../models/User.js';
import Post from '../../models/Post.js';
import cloudinaryService from '../../services/cloudinaryService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Final Integration Tests - Cloud Image Storage', () => {
  let testUser;
  let authToken;
  let testImagePath;
  let uploadedImageUrl;
  let createdPostId;

  beforeAll(async () => {
    // Create test image file
    testImagePath = path.join(__dirname, '../fixtures/test-image.jpg');
    if (!fs.existsSync(testImagePath)) {
      // Create a minimal test image buffer
      const testImageBuffer = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
        0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
        0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
        0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
        0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
        0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
        0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01,
        0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
        0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xFF, 0xC4,
        0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x0C,
        0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3F, 0x00, 0xB2, 0xC0,
        0x07, 0xFF, 0xD9
      ]);
      
      // Ensure fixtures directory exists
      const fixturesDir = path.dirname(testImagePath);
      if (!fs.existsSync(fixturesDir)) {
        fs.mkdirSync(fixturesDir, { recursive: true });
      }
      
      fs.writeFileSync(testImagePath, testImageBuffer);
    }

    // Create test user
    testUser = new User({
      fullName: 'Test User',
      email: `test_${Date.now()}@example.com`,
      enrollment: '1234567',
      password: 'testpassword123',
      department: 'Computer Engineering'
    });
    await testUser.save();

    // Get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'testpassword123'
      });

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    // Cleanup test data
    if (createdPostId) {
      await Post.findByIdAndDelete(createdPostId);
    }
    if (testUser) {
      await User.findByIdAndDelete(testUser._id);
    }
    
    // Cleanup uploaded image from Cloudinary
    if (uploadedImageUrl) {
      try {
        const publicId = uploadedImageUrl.split('/').pop().split('.')[0];
        await cloudinaryService.deleteImage(publicId);
      } catch (error) {
        console.log('Cleanup warning: Could not delete test image from Cloudinary');
      }
    }

    // Cleanup test image file
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
  });

  describe('1. Cloudinary Service Integration', () => {
    it('should verify Cloudinary connection', async () => {
      const isConnected = await cloudinaryService.testConnection();
      expect(isConnected).toBe(true);
    });

    it('should have proper configuration', () => {
      expect(process.env.CLOUDINARY_CLOUD_NAME).toBeDefined();
      expect(process.env.CLOUDINARY_API_KEY).toBeDefined();
      expect(process.env.CLOUDINARY_API_SECRET).toBeDefined();
    });
  });

  describe('2. Image Upload Flow', () => {
    it('should upload image and create post successfully', async () => {
      const response = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .field('content', 'Test post with cloud image')
        .attach('image', testImagePath);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.post).toBeDefined();
      expect(response.body.post.image).toBeDefined();
      expect(response.body.post.image).toMatch(/^https:\/\/res\.cloudinary\.com/);

      createdPostId = response.body.post._id;
      uploadedImageUrl = response.body.post.image;
    });

    it('should retrieve post with cloud image URL', async () => {
      const response = await request(app)
        .get('/api/posts')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const testPost = response.body.posts.find(post => post._id === createdPostId);
      expect(testPost).toBeDefined();
      expect(testPost.image).toMatch(/^https:\/\/res\.cloudinary\.com/);
    });

    it('should verify image is accessible via Cloudinary URL', async () => {
      if (!uploadedImageUrl) {
        throw new Error('No uploaded image URL available for testing');
      }

      // Test direct access to Cloudinary URL
      const imageResponse = await fetch(uploadedImageUrl);
      expect(imageResponse.ok).toBe(true);
      expect(imageResponse.headers.get('content-type')).toMatch(/^image\//);
    });
  });

  describe('3. Error Handling', () => {
    it('should handle invalid file types gracefully', async () => {
      const textFilePath = path.join(__dirname, '../fixtures/test.txt');
      fs.writeFileSync(textFilePath, 'This is not an image');

      const response = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .field('content', 'Test post with invalid file')
        .attach('image', textFilePath);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);

      // Cleanup
      fs.unlinkSync(textFilePath);
    });

    it('should handle missing authentication', async () => {
      const response = await request(app)
        .post('/api/posts')
        .field('content', 'Test post without auth')
        .attach('image', testImagePath);

      expect(response.status).toBe(401);
    });
  });

  describe('4. Performance and Monitoring', () => {
    it('should have monitoring endpoints available', async () => {
      const healthResponse = await request(app)
        .get('/api/health/cloudinary');

      expect(healthResponse.status).toBe(200);
      expect(healthResponse.body.status).toBe('healthy');
    });

    it('should track image performance metrics', async () => {
      const metricsResponse = await request(app)
        .get('/api/monitoring/image-performance')
        .set('Authorization', `Bearer ${authToken}`);

      expect(metricsResponse.status).toBe(200);
      expect(metricsResponse.body).toHaveProperty('uploadCount');
      expect(metricsResponse.body).toHaveProperty('averageUploadTime');
    });

    it('should provide storage usage information', async () => {
      const storageResponse = await request(app)
        .get('/api/monitoring/storage-usage')
        .set('Authorization', `Bearer ${authToken}`);

      expect(storageResponse.status).toBe(200);
      expect(storageResponse.body).toHaveProperty('totalImages');
      expect(storageResponse.body).toHaveProperty('storageUsed');
    });
  });

  describe('5. Cross-Device Accessibility', () => {
    it('should serve images with proper CDN headers', async () => {
      if (!uploadedImageUrl) {
        throw new Error('No uploaded image URL available for testing');
      }

      const imageResponse = await fetch(uploadedImageUrl);
      expect(imageResponse.ok).toBe(true);
      
      // Check for CDN headers
      const cacheControl = imageResponse.headers.get('cache-control');
      expect(cacheControl).toBeTruthy();
      
      // Verify it's served from Cloudinary CDN
      expect(uploadedImageUrl).toMatch(/^https:\/\/res\.cloudinary\.com/);
    });

    it('should maintain consistent image URLs across requests', async () => {
      // Make multiple requests for the same post
      const responses = await Promise.all([
        request(app).get('/api/posts').set('Authorization', `Bearer ${authToken}`),
        request(app).get('/api/posts').set('Authorization', `Bearer ${authToken}`),
        request(app).get('/api/posts').set('Authorization', `Bearer ${authToken}`)
      ]);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        const testPost = response.body.posts.find(post => post._id === createdPostId);
        expect(testPost.image).toBe(uploadedImageUrl);
      });
    });
  });

  describe('6. Migration Compatibility', () => {
    it('should handle both old and new image URL formats', async () => {
      // Create a post with old-style local path (simulating pre-migration data)
      const oldPost = new Post({
        content: 'Old post with local image',
        image: '/uploads/old-image.jpg',
        userId: testUser._id
      });
      await oldPost.save();

      const response = await request(app)
        .get('/api/posts')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      
      // Should handle both old and new formats without errors
      const posts = response.body.posts;
      expect(posts.length).toBeGreaterThan(0);

      // Cleanup
      await Post.findByIdAndDelete(oldPost._id);
    });
  });

  describe('7. API Backward Compatibility', () => {
    it('should maintain consistent API response format', async () => {
      const response = await request(app)
        .get('/api/posts')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('posts');
      expect(Array.isArray(response.body.posts)).toBe(true);

      if (response.body.posts.length > 0) {
        const post = response.body.posts[0];
        expect(post).toHaveProperty('_id');
        expect(post).toHaveProperty('content');
        expect(post).toHaveProperty('userId');
        expect(post).toHaveProperty('createdAt');
        // Image field should exist (may be null for posts without images)
        expect(post).toHaveProperty('image');
      }
    });

    it('should handle post updates with image changes', async () => {
      if (!createdPostId) {
        throw new Error('No created post available for update testing');
      }

      const updateResponse = await request(app)
        .put(`/api/posts/${createdPostId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Updated post content'
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.post.content).toBe('Updated post content');
      // Image should remain unchanged
      expect(updateResponse.body.post.image).toBe(uploadedImageUrl);
    });
  });

  describe('8. System Integration', () => {
    it('should integrate properly with existing authentication', async () => {
      // Test that image uploads require proper authentication
      const noAuthResponse = await request(app)
        .post('/api/posts')
        .field('content', 'Test without auth')
        .attach('image', testImagePath);

      expect(noAuthResponse.status).toBe(401);

      // Test with valid auth
      const withAuthResponse = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .field('content', 'Test with auth')
        .attach('image', testImagePath);

      expect(withAuthResponse.status).toBe(201);

      // Cleanup the additional post
      if (withAuthResponse.body.post) {
        await Post.findByIdAndDelete(withAuthResponse.body.post._id);
        
        // Cleanup the image from Cloudinary
        try {
          const imageUrl = withAuthResponse.body.post.image;
          const publicId = imageUrl.split('/').pop().split('.')[0];
          await cloudinaryService.deleteImage(publicId);
        } catch (error) {
          console.log('Cleanup warning: Could not delete additional test image');
        }
      }
    });

    it('should maintain database consistency', async () => {
      // Verify that posts in database have proper image URLs
      const posts = await Post.find({ image: { $exists: true, $ne: null } });
      
      posts.forEach(post => {
        if (post.image) {
          // Should be either Cloudinary URL or old local path
          const isCloudinaryUrl = post.image.startsWith('https://res.cloudinary.com');
          const isLocalPath = post.image.startsWith('/uploads/');
          expect(isCloudinaryUrl || isLocalPath).toBe(true);
        }
      });
    });
  });
});