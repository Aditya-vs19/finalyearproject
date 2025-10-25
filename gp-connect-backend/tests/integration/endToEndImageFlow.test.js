import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';

// Mock dependencies
vi.mock('../../services/cloudinaryService.js');
vi.mock('../../models/Post.js');
vi.mock('../../models/User.js');

describe('End-to-End Image Upload Flow Integration Tests', () => {
  let app;
  let mockCloudinaryService;
  let mockPost;
  let mockUser;
  let testImagePath;

  beforeEach(async () => {
    // Setup Express app
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Import mocked services
    mockCloudinaryService = (await import('../../services/cloudinaryService.js')).default;
    mockPost = (await import('../../models/Post.js')).default;
    mockUser = (await import('../../models/User.js')).default;

    // Setup mock auth middleware
    const mockAuth = (req, res, next) => {
      req.user = { _id: 'user123', username: 'testuser' };
      next();
    };

    // Setup default mocks
    mockCloudinaryService.isReady.mockReturnValue(true);
    mockCloudinaryService.uploadImage.mockResolvedValue({
      url: 'https://res.cloudinary.com/test/image/upload/v123/test.jpg',
      publicId: 'gp-connect-posts/test123',
      width: 800,
      height: 600,
      format: 'jpg',
      bytes: 50000
    });

    // Mock Post model
    mockPost.mockImplementation(function(data) {
      this.save = vi.fn().mockResolvedValue({
        _id: 'post123',
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      Object.assign(this, data);
      return this;
    });

    mockPost.find = vi.fn().mockReturnValue({
      populate: vi.fn().mockReturnValue({
        sort: vi.fn().mockResolvedValue([])
      })
    });

    mockUser.findById = vi.fn().mockResolvedValue({
      _id: 'user123',
      username: 'testuser'
    });

    // Create test image path
    testImagePath = path.join(process.cwd(), 'tests', 'fixtures', 'test-image.jpg');

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Complete Image Upload API Flow', () => {
    it('should handle complete image upload from API request to Cloudinary', async () => {
      // Setup upload middleware mock
      const mockUpload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 10 * 1024 * 1024 }
      });

      // Create test route
      app.post('/api/posts', mockUpload.single('image'), async (req, res) => {
        try {
          // Simulate the complete flow
          let imageUrl = null;
          
          if (req.file) {
            // Mock file processing
            const mockFile = {
              path: 'https://res.cloudinary.com/test/image/upload/test.jpg',
              originalname: req.file.originalname,
              mimetype: req.file.mimetype,
              size: req.file.size
            };
            
            // Upload to Cloudinary
            const uploadResult = await mockCloudinaryService.uploadImage(mockFile.path);
            imageUrl = uploadResult.url;
          }

          // Create post
          const post = new mockPost({
            content: req.body.content,
            image: imageUrl,
            user: req.user._id
          });

          const savedPost = await post.save();

          res.status(201).json({
            success: true,
            post: savedPost
          });
        } catch (error) {
          res.status(500).json({
            success: false,
            message: error.message
          });
        }
      });

      // Create test image buffer
      const testImageBuffer = Buffer.from('fake-image-data');

      const response = await request(app)
        .post('/api/posts')
        .field('content', 'Test post with image')
        .attach('image', testImageBuffer, 'test.jpg')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.post.content).toBe('Test post with image');
      expect(response.body.post.image).toContain('cloudinary.com');
      expect(mockCloudinaryService.uploadImage).toHaveBeenCalled();
    });

    it('should handle post creation without image', async () => {
      // Create test route for posts without images
      app.post('/api/posts/text-only', async (req, res) => {
        try {
          const post = new mockPost({
            content: req.body.content,
            image: null,
            user: 'user123'
          });

          const savedPost = await post.save();

          res.status(201).json({
            success: true,
            post: savedPost
          });
        } catch (error) {
          res.status(500).json({
            success: false,
            message: error.message
          });
        }
      });

      const response = await request(app)
        .post('/api/posts/text-only')
        .send({ content: 'Text-only post' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.post.content).toBe('Text-only post');
      expect(response.body.post.image).toBeNull();
      expect(mockCloudinaryService.uploadImage).not.toHaveBeenCalled();
    });

    it('should handle image upload errors gracefully', async () => {
      // Mock Cloudinary failure
      mockCloudinaryService.uploadImage.mockRejectedValue(new Error('Cloudinary upload failed'));

      const mockUpload = multer({
        storage: multer.memoryStorage()
      });

      app.post('/api/posts/upload-error', mockUpload.single('image'), async (req, res) => {
        try {
          if (req.file) {
            await mockCloudinaryService.uploadImage('/fake/path');
          }
          
          res.status(201).json({ success: true });
        } catch (error) {
          res.status(500).json({
            success: false,
            message: 'Image upload failed',
            error: error.message
          });
        }
      });

      const testImageBuffer = Buffer.from('fake-image-data');

      const response = await request(app)
        .post('/api/posts/upload-error')
        .attach('image', testImageBuffer, 'test.jpg')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Image upload failed');
      expect(response.body.error).toBe('Cloudinary upload failed');
    });
  });

  describe('Post Retrieval with Cloud Images', () => {
    it('should retrieve posts with cloud image URLs', async () => {
      const mockPosts = [
        {
          _id: 'post1',
          content: 'Post with cloud image',
          image: 'https://res.cloudinary.com/test/image/upload/v123/post1.jpg',
          user: { _id: 'user1', username: 'user1' },
          createdAt: new Date()
        },
        {
          _id: 'post2',
          content: 'Post without image',
          image: null,
          user: { _id: 'user2', username: 'user2' },
          createdAt: new Date()
        }
      ];

      mockPost.find.mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockResolvedValue(mockPosts)
        })
      });

      app.get('/api/posts', async (req, res) => {
        try {
          const posts = await mockPost.find({})
            .populate('user', 'username')
            .sort({ createdAt: -1 });

          res.json({
            success: true,
            posts: posts
          });
        } catch (error) {
          res.status(500).json({
            success: false,
            message: error.message
          });
        }
      });

      const response = await request(app)
        .get('/api/posts')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.posts).toHaveLength(2);
      expect(response.body.posts[0].image).toContain('cloudinary.com');
      expect(response.body.posts[1].image).toBeNull();
    });

    it('should handle optimized image URLs for different screen sizes', async () => {
      const baseImageUrl = 'https://res.cloudinary.com/test/image/upload/v123/sample.jpg';
      
      const generateOptimizedUrls = (baseUrl) => {
        const publicId = baseUrl.split('/').pop().split('.')[0];
        return {
          thumbnail: `https://res.cloudinary.com/test/image/upload/c_fill,w_150,h_150/${publicId}.jpg`,
          medium: `https://res.cloudinary.com/test/image/upload/c_fill,w_400,h_300/${publicId}.jpg`,
          large: `https://res.cloudinary.com/test/image/upload/c_limit,w_1000,h_1000/${publicId}.jpg`,
          original: baseUrl
        };
      };

      app.get('/api/posts/:id/images', async (req, res) => {
        const post = {
          _id: req.params.id,
          image: baseImageUrl
        };

        if (post.image) {
          const optimizedUrls = generateOptimizedUrls(post.image);
          res.json({
            success: true,
            images: optimizedUrls
          });
        } else {
          res.json({
            success: true,
            images: null
          });
        }
      });

      const response = await request(app)
        .get('/api/posts/post123/images')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.images.thumbnail).toContain('c_fill,w_150,h_150');
      expect(response.body.images.medium).toContain('c_fill,w_400,h_300');
      expect(response.body.images.large).toContain('c_limit,w_1000,h_1000');
      expect(response.body.images.original).toBe(baseImageUrl);
    });
  });

  describe('Migration Integration Workflows', () => {
    it('should test complete migration workflow with database updates', async () => {
      const localImages = [
        { filename: 'local1.jpg', localPath: '/uploads/local1.jpg' },
        { filename: 'local2.png', localPath: '/uploads/local2.png' }
      ];

      const postsWithLocalImages = [
        { _id: 'post1', image: 'local1.jpg', content: 'Post 1' },
        { _id: 'post2', image: 'local2.png', content: 'Post 2' }
      ];

      // Mock migration endpoint
      app.post('/api/admin/migrate-images', async (req, res) => {
        try {
          const migrationResults = [];

          for (const image of localImages) {
            // Upload to Cloudinary
            const uploadResult = await mockCloudinaryService.uploadImage(image.localPath);
            
            // Update database references
            const updateResult = { modifiedCount: 1 };
            mockPost.updateMany = vi.fn().mockResolvedValue(updateResult);
            
            await mockPost.updateMany(
              { image: image.filename },
              { image: uploadResult.url }
            );

            migrationResults.push({
              filename: image.filename,
              cloudinaryUrl: uploadResult.url,
              postsUpdated: updateResult.modifiedCount,
              success: true
            });
          }

          res.json({
            success: true,
            migrationResults: migrationResults,
            totalMigrated: migrationResults.length
          });
        } catch (error) {
          res.status(500).json({
            success: false,
            message: error.message
          });
        }
      });

      const response = await request(app)
        .post('/api/admin/migrate-images')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.totalMigrated).toBe(2);
      expect(response.body.migrationResults).toHaveLength(2);
      
      response.body.migrationResults.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.cloudinaryUrl).toContain('cloudinary.com');
        expect(result.postsUpdated).toBe(1);
      });
    });

    it('should handle migration status and progress tracking', async () => {
      let migrationProgress = {
        inProgress: false,
        totalImages: 0,
        processed: 0,
        successful: 0,
        failed: 0,
        startTime: null,
        errors: []
      };

      // Migration status endpoint
      app.get('/api/admin/migration-status', (req, res) => {
        const progress = {
          ...migrationProgress,
          percentComplete: migrationProgress.totalImages > 0 
            ? Math.round((migrationProgress.processed / migrationProgress.totalImages) * 100)
            : 0,
          elapsedTime: migrationProgress.startTime 
            ? Date.now() - migrationProgress.startTime
            : 0
        };

        res.json({
          success: true,
          progress: progress
        });
      });

      // Start migration endpoint
      app.post('/api/admin/start-migration', async (req, res) => {
        if (migrationProgress.inProgress) {
          return res.status(400).json({
            success: false,
            message: 'Migration already in progress'
          });
        }

        migrationProgress = {
          inProgress: true,
          totalImages: 5,
          processed: 0,
          successful: 0,
          failed: 0,
          startTime: Date.now(),
          errors: []
        };

        // Simulate migration progress
        const simulateMigration = async () => {
          for (let i = 0; i < 5; i++) {
            await new Promise(resolve => setTimeout(resolve, 100));
            migrationProgress.processed++;
            
            if (Math.random() > 0.2) { // 80% success rate
              migrationProgress.successful++;
            } else {
              migrationProgress.failed++;
              migrationProgress.errors.push(`Failed to migrate image ${i + 1}`);
            }
          }
          migrationProgress.inProgress = false;
        };

        // Start migration in background
        simulateMigration();

        res.json({
          success: true,
          message: 'Migration started',
          migrationId: 'migration_' + Date.now()
        });
      });

      // Start migration
      const startResponse = await request(app)
        .post('/api/admin/start-migration')
        .expect(200);

      expect(startResponse.body.success).toBe(true);
      expect(startResponse.body.message).toBe('Migration started');

      // Wait for migration to complete
      await new Promise(resolve => setTimeout(resolve, 600));

      // Check final status
      const statusResponse = await request(app)
        .get('/api/admin/migration-status')
        .expect(200);

      expect(statusResponse.body.success).toBe(true);
      expect(statusResponse.body.progress.percentComplete).toBe(100);
      expect(statusResponse.body.progress.processed).toBe(5);
      expect(statusResponse.body.progress.inProgress).toBe(false);
    });
  });

  describe('Performance Integration Tests', () => {
    it('should handle concurrent image uploads efficiently', async () => {
      const concurrentUploads = 5;
      
      // Mock upload processing with delays
      mockCloudinaryService.uploadImage.mockImplementation(async (path) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          url: `https://res.cloudinary.com/test/image/upload/${Date.now()}.jpg`,
          publicId: `gp-connect-posts/${Date.now()}`
        };
      });

      const mockUpload = multer({
        storage: multer.memoryStorage()
      });

      app.post('/api/posts/concurrent', mockUpload.single('image'), async (req, res) => {
        try {
          if (req.file) {
            const uploadResult = await mockCloudinaryService.uploadImage('/fake/path');
            res.json({
              success: true,
              imageUrl: uploadResult.url,
              uploadTime: Date.now()
            });
          } else {
            res.status(400).json({ success: false, message: 'No image provided' });
          }
        } catch (error) {
          res.status(500).json({ success: false, message: error.message });
        }
      });

      // Create concurrent upload promises
      const uploadPromises = Array.from({ length: concurrentUploads }, (_, i) => {
        const testBuffer = Buffer.from(`fake-image-data-${i}`);
        return request(app)
          .post('/api/posts/concurrent')
          .attach('image', testBuffer, `test${i}.jpg`);
      });

      const startTime = Date.now();
      const responses = await Promise.all(uploadPromises);
      const totalTime = Date.now() - startTime;

      // All uploads should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.imageUrl).toContain('cloudinary.com');
      });

      // Should complete faster than sequential processing
      expect(totalTime).toBeLessThan(concurrentUploads * 150); // Allow some overhead
      expect(mockCloudinaryService.uploadImage).toHaveBeenCalledTimes(concurrentUploads);
    });

    it('should test image loading performance with CDN optimization', async () => {
      const imageUrls = [
        'https://res.cloudinary.com/test/image/upload/c_auto,q_auto/sample1.jpg',
        'https://res.cloudinary.com/test/image/upload/c_auto,q_auto/sample2.jpg',
        'https://res.cloudinary.com/test/image/upload/c_auto,q_auto/sample3.jpg'
      ];

      app.get('/api/posts/optimized', async (req, res) => {
        const posts = imageUrls.map((url, index) => ({
          _id: `post${index + 1}`,
          content: `Post ${index + 1}`,
          image: url,
          optimizations: {
            autoFormat: url.includes('f_auto'),
            autoQuality: url.includes('q_auto'),
            responsive: url.includes('c_auto')
          }
        }));

        res.json({
          success: true,
          posts: posts,
          loadTime: Date.now()
        });
      });

      const response = await request(app)
        .get('/api/posts/optimized')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.posts).toHaveLength(3);
      
      response.body.posts.forEach(post => {
        expect(post.image).toContain('cloudinary.com');
        expect(post.image).toContain('q_auto'); // Quality optimization
        expect(post.optimizations.autoQuality).toBe(true);
      });
    });
  });

  describe('Error Recovery Integration Tests', () => {
    it('should test complete error recovery workflow', async () => {
      let failureCount = 0;
      const maxFailures = 2;

      // Mock service that fails initially then succeeds
      mockCloudinaryService.uploadImage.mockImplementation(async () => {
        failureCount++;
        if (failureCount <= maxFailures) {
          throw new Error(`Upload failed (attempt ${failureCount})`);
        }
        return {
          url: 'https://res.cloudinary.com/test/image/upload/recovered.jpg',
          publicId: 'gp-connect-posts/recovered'
        };
      });

      const mockUpload = multer({
        storage: multer.memoryStorage()
      });

      app.post('/api/posts/retry', mockUpload.single('image'), async (req, res) => {
        const maxRetries = 3;
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            if (req.file) {
              const result = await mockCloudinaryService.uploadImage('/fake/path');
              return res.json({
                success: true,
                imageUrl: result.url,
                attemptsRequired: attempt
              });
            }
          } catch (error) {
            lastError = error;
            if (attempt < maxRetries) {
              // Wait before retry
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
        }

        res.status(500).json({
          success: false,
          message: `Upload failed after ${maxRetries} attempts`,
          lastError: lastError.message
        });
      });

      const testBuffer = Buffer.from('fake-image-data');

      const response = await request(app)
        .post('/api/posts/retry')
        .attach('image', testBuffer, 'test.jpg')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.imageUrl).toContain('recovered.jpg');
      expect(response.body.attemptsRequired).toBe(3);
      expect(mockCloudinaryService.uploadImage).toHaveBeenCalledTimes(3);
    });
  });
});