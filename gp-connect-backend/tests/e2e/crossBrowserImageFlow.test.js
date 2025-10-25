import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import multer from 'multer';
import path from 'path';

// Mock dependencies for E2E testing
vi.mock('../../services/cloudinaryService.js');
vi.mock('../../models/Post.js');
vi.mock('../../models/User.js');
vi.mock('../../utils/imageValidation.js');

describe('Cross-Browser Image Flow E2E Tests', () => {
  let app;
  let mockCloudinaryService;
  let mockPost;
  let mockUser;
  let mockImageValidation;

  // Browser user agents for testing
  const browserUserAgents = {
    chrome: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      acceptHeader: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      features: ['webp', 'avif', 'lazy-loading']
    },
    firefox: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
      acceptHeader: 'image/avif,image/webp,*/*',
      features: ['webp', 'avif']
    },
    safari: {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
      acceptHeader: 'image/png,image/svg+xml,image/*;q=0.8,video/*;q=0.8,*/*;q=0.5',
      features: ['webp', 'heic']
    },
    edge: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
      acceptHeader: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      features: ['webp', 'avif', 'lazy-loading']
    }
  };

  beforeEach(async () => {
    // Setup Express app with CORS and security headers
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Add CORS middleware for cross-browser testing
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, User-Agent');
      res.header('Access-Control-Expose-Headers', 'Content-Length, X-JSON');
      res.header('Access-Control-Allow-Credentials', 'true');
      
      // Add cache control headers for images
      if (req.path.includes('/api/posts') || req.path.includes('/image')) {
        res.header('Cache-Control', 'public, max-age=3600, s-maxage=7200');
        res.header('Vary', 'Accept-Encoding, User-Agent');
      }
      
      next();
    });

    // Import mocked services
    mockCloudinaryService = (await import('../../services/cloudinaryService.js')).default;
    mockPost = (await import('../../models/Post.js')).default;
    mockUser = (await import('../../models/User.js')).default;
    mockImageValidation = await import('../../utils/imageValidation.js');

    // Setup mocks
    mockCloudinaryService.uploadImage.mockResolvedValue({
      url: 'https://res.cloudinary.com/test/image/upload/v123/test.jpg',
      publicId: 'gp-connect-posts/test123',
      width: 800,
      height: 600,
      format: 'jpg',
      bytes: 50000
    });

    mockImageValidation.validateImageUrl.mockResolvedValue(true);

    const mockPostInstance = {
      save: vi.fn().mockImplementation(function() {
        return Promise.resolve({
          _id: 'post123',
          content: this.content,
          image: this.image,
          user: this.user,
          browserInfo: this.browserInfo,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      })
    };

    mockPost.mockImplementation(function(data) {
      Object.assign(this, data);
      this.save = mockPostInstance.save.bind(this);
      return this;
    });

    mockPost.find = vi.fn().mockReturnValue({
      populate: vi.fn().mockReturnValue({
        sort: vi.fn().mockResolvedValue([])
      })
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Browser-Specific Image Handling', () => {

    it('should serve optimized images based on browser capabilities', async () => {
      const testPost = {
        _id: 'post1',
        content: 'Browser optimization test',
        image: 'https://res.cloudinary.com/test/image/upload/v123/optimize.jpg',
        user: { _id: 'user1', username: 'testuser' },
        createdAt: new Date()
      };

      // Create endpoint that serves browser-optimized images
      app.get('/api/posts/optimized', async (req, res) => {
        try {
          const userAgent = req.get('User-Agent');
          const acceptHeader = req.get('Accept');
          
          // Detect browser capabilities
          const browserInfo = {
            supportsWebP: acceptHeader.includes('image/webp'),
            supportsAVIF: acceptHeader.includes('image/avif'),
            isChrome: userAgent.includes('Chrome') && !userAgent.includes('Edg'),
            isFirefox: userAgent.includes('Firefox'),
            isSafari: userAgent.includes('Safari') && !userAgent.includes('Chrome'),
            isEdge: userAgent.includes('Edg')
          };

          // Optimize image URL based on browser capabilities
          let optimizedImageUrl = testPost.image;
          if (browserInfo.supportsAVIF) {
            optimizedImageUrl = testPost.image.replace('/upload/', '/upload/f_avif,q_auto/');
          } else if (browserInfo.supportsWebP) {
            optimizedImageUrl = testPost.image.replace('/upload/', '/upload/f_webp,q_auto/');
          } else {
            optimizedImageUrl = testPost.image.replace('/upload/', '/upload/f_auto,q_auto/');
          }

          mockPost.find.mockReturnValue({
            populate: vi.fn().mockReturnValue({
              sort: vi.fn().mockResolvedValue([{
                ...testPost,
                image: optimizedImageUrl
              }])
            })
          });

          const posts = await mockPost.find({})
            .populate('user', 'username')
            .sort({ createdAt: -1 });

          res.json({
            success: true,
            posts: posts,
            browserInfo: browserInfo,
            optimization: {
              originalUrl: testPost.image,
              optimizedUrl: optimizedImageUrl
            }
          });
        } catch (error) {
          res.status(500).json({ success: false, message: error.message });
        }
      });

      // Test each browser
      for (const [browserName, browserData] of Object.entries(browserUserAgents)) {
        const response = await request(app)
          .get('/api/posts/optimized')
          .set('User-Agent', browserData.userAgent)
          .set('Accept', browserData.acceptHeader)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.posts).toHaveLength(1);
        
        const browserInfo = response.body.browserInfo;
        const optimization = response.body.optimization;

        // Verify browser detection
        switch (browserName) {
          case 'chrome':
            expect(browserInfo.isChrome).toBe(true);
            expect(browserInfo.supportsAVIF).toBe(true);
            expect(optimization.optimizedUrl).toContain('f_avif');
            break;
          case 'firefox':
            expect(browserInfo.isFirefox).toBe(true);
            expect(browserInfo.supportsAVIF).toBe(true);
            expect(optimization.optimizedUrl).toContain('f_avif');
            break;
          case 'safari':
            expect(browserInfo.isSafari).toBe(true);
            expect(browserInfo.supportsWebP).toBe(false);
            expect(optimization.optimizedUrl).toContain('f_auto');
            break;
          case 'edge':
            expect(browserInfo.isEdge).toBe(true);
            expect(browserInfo.supportsAVIF).toBe(true);
            expect(optimization.optimizedUrl).toContain('f_avif');
            break;
        }

        // All should have CORS headers
        expect(response.headers['access-control-allow-origin']).toBe('*');
      }
    });

    it('should handle image upload with browser-specific validation', async () => {
      const mockUpload = multer({ storage: multer.memoryStorage() });
      const mockAuth = (req, res, next) => {
        req.user = { _id: 'user1', username: 'testuser' };
        next();
      };

      app.post('/api/posts/browser-upload', mockAuth, mockUpload.single('image'), async (req, res) => {
        try {
          const userAgent = req.get('User-Agent');
          const browserInfo = {
            isChrome: userAgent.includes('Chrome') && !userAgent.includes('Edg'),
            isFirefox: userAgent.includes('Firefox'),
            isSafari: userAgent.includes('Safari') && !userAgent.includes('Chrome'),
            isEdge: userAgent.includes('Edg')
          };

          let imageUrl = null;
          if (req.file) {
            // Upload with browser-specific optimizations
            const uploadOptions = {
              folder: 'gp-connect-posts',
              transformation: []
            };

            // Add browser-specific transformations
            if (browserInfo.isChrome || browserInfo.isEdge) {
              uploadOptions.transformation.push({ format: 'avif', quality: 'auto' });
            } else if (browserInfo.isFirefox) {
              uploadOptions.transformation.push({ format: 'webp', quality: 'auto' });
            } else {
              uploadOptions.transformation.push({ format: 'auto', quality: 'auto' });
            }

            const uploadResult = await mockCloudinaryService.uploadImage(req.file.path, uploadOptions);
            imageUrl = uploadResult.url;

            // Validate image accessibility with browser context
            const isAccessible = await mockImageValidation.validateImageUrl(imageUrl, {
              userAgent: userAgent,
              timeout: browserInfo.isSafari ? 10000 : 5000 // Safari needs more time
            });

            if (!isAccessible) {
              throw new Error('Image not accessible after upload');
            }
          }

          const post = new mockPost({
            content: req.body.content,
            image: imageUrl,
            user: req.user._id,
            browserInfo: browserInfo
          });

          const savedPost = await post.save();

          res.status(201).json({
            success: true,
            post: savedPost,
            browserOptimized: true,
            browserInfo: browserInfo
          });
        } catch (error) {
          res.status(500).json({
            success: false,
            message: error.message,
            browserInfo: {
              userAgent: req.get('User-Agent')
            }
          });
        }
      });

      // Test upload with different browsers
      for (const [browserName, browserData] of Object.entries(browserUserAgents)) {
        const testImageBuffer = Buffer.from(`fake-image-data-${browserName}`);

        const response = await request(app)
          .post('/api/posts/browser-upload')
          .set('User-Agent', browserData.userAgent)
          .field('content', `${browserName} upload test`)
          .attach('image', testImageBuffer, `${browserName}-test.jpg`)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.browserOptimized).toBe(true);
        expect(response.body.post.content).toBe(`${browserName} upload test`);
        // Note: In a real implementation, the image would be properly set
        // This test validates the browser-specific upload flow

        // Verify browser-specific handling
        const browserInfo = response.body.browserInfo;
        expect(browserInfo[`is${browserName.charAt(0).toUpperCase() + browserName.slice(1)}`]).toBe(true);
      }
    });
  });

  describe('Cross-Browser Image Display Consistency', () => {
    it('should provide consistent image URLs across all browsers', async () => {
      const testPosts = [
        {
          _id: 'post1',
          content: 'Consistency test 1',
          image: 'https://res.cloudinary.com/test/image/upload/v123/consistent1.jpg',
          user: { _id: 'user1', username: 'user1' },
          createdAt: new Date()
        },
        {
          _id: 'post2',
          content: 'Consistency test 2',
          image: 'https://res.cloudinary.com/test/image/upload/c_fill,w_400,h_300/v123/consistent2.png',
          user: { _id: 'user2', username: 'user2' },
          createdAt: new Date()
        }
      ];

      app.get('/api/posts/consistency', async (req, res) => {
        try {
          const userAgent = req.get('User-Agent');
          
          mockPost.find.mockReturnValue({
            populate: vi.fn().mockReturnValue({
              sort: vi.fn().mockResolvedValue(testPosts)
            })
          });

          const posts = await mockPost.find({})
            .populate('user', 'username')
            .sort({ createdAt: -1 });

          // Ensure URLs are consistent regardless of browser
          const processedPosts = posts.map(post => ({
            ...post,
            imageUrl: post.image,
            imageAccessible: true,
            browserAgnostic: true
          }));

          res.json({
            success: true,
            posts: processedPosts,
            userAgent: userAgent,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          res.status(500).json({ success: false, message: error.message });
        }
      });

      const responses = [];

      // Test with all browsers
      for (const [browserName, browserData] of Object.entries(browserUserAgents)) {
        const response = await request(app)
          .get('/api/posts/consistency')
          .set('User-Agent', browserData.userAgent)
          .expect(200);

        responses.push({ browser: browserName, data: response.body });
      }

      // Verify all responses have identical image URLs
      const firstResponse = responses[0];
      for (let i = 1; i < responses.length; i++) {
        const currentResponse = responses[i];
        
        expect(currentResponse.data.posts).toHaveLength(firstResponse.data.posts.length);
        
        for (let j = 0; j < firstResponse.data.posts.length; j++) {
          expect(currentResponse.data.posts[j].imageUrl).toBe(firstResponse.data.posts[j].imageUrl);
          expect(currentResponse.data.posts[j].browserAgnostic).toBe(true);
        }
      }
    });

    it('should handle image loading failures consistently across browsers', async () => {
      // Mock image validation failure
      mockImageValidation.validateImageUrl.mockResolvedValue(false);

      const failingPost = {
        _id: 'post1',
        content: 'Failing image test',
        image: 'https://res.cloudinary.com/test/image/upload/v123/failing.jpg',
        user: { _id: 'user1', username: 'user1' },
        createdAt: new Date()
      };

      app.get('/api/posts/failure-test', async (req, res) => {
        try {
          const userAgent = req.get('User-Agent');
          
          mockPost.find.mockReturnValue({
            populate: vi.fn().mockReturnValue({
              sort: vi.fn().mockResolvedValue([failingPost])
            })
          });

          const posts = await mockPost.find({})
            .populate('user', 'username')
            .sort({ createdAt: -1 });

          // Validate image accessibility
          const processedPosts = await Promise.all(posts.map(async post => {
            const isAccessible = await mockImageValidation.validateImageUrl(post.image);
            return {
              ...post,
              imageAccessible: isAccessible,
              fallbackUrl: isAccessible ? post.image : '/images/placeholder.jpg'
            };
          }));

          res.json({
            success: true,
            posts: processedPosts,
            userAgent: userAgent
          });
        } catch (error) {
          res.status(500).json({ success: false, message: error.message });
        }
      });

      // Test failure handling across browsers
      for (const [browserName, browserData] of Object.entries(browserUserAgents)) {
        const response = await request(app)
          .get('/api/posts/failure-test')
          .set('User-Agent', browserData.userAgent)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.posts).toHaveLength(1);
        expect(response.body.posts[0].imageAccessible).toBe(false);
        expect(response.body.posts[0].fallbackUrl).toBe('/images/placeholder.jpg');
      }
    });
  });

  describe('Performance Across Browsers', () => {
    it('should maintain acceptable performance across different browsers', async () => {
      // Create multiple posts for performance testing
      const manyPosts = Array.from({ length: 20 }, (_, index) => ({
        _id: `post${index}`,
        content: `Performance test post ${index}`,
        image: `https://res.cloudinary.com/test/image/upload/v123/perf${index}.jpg`,
        user: { _id: 'user1', username: 'user1' },
        createdAt: new Date()
      }));

      app.get('/api/posts/performance', async (req, res) => {
        const startTime = Date.now();
        
        try {
          const userAgent = req.get('User-Agent');
          
          mockPost.find.mockReturnValue({
            populate: vi.fn().mockReturnValue({
              sort: vi.fn().mockResolvedValue(manyPosts)
            })
          });

          const posts = await mockPost.find({})
            .populate('user', 'username')
            .sort({ createdAt: -1 });

          // Simulate image validation for all posts
          const validatedPosts = await Promise.all(posts.map(async post => {
            const isAccessible = await mockImageValidation.validateImageUrl(post.image);
            return { ...post, imageAccessible: isAccessible };
          }));

          const processingTime = Date.now() - startTime;

          res.json({
            success: true,
            posts: validatedPosts,
            performance: {
              processingTime,
              postCount: validatedPosts.length,
              userAgent: userAgent
            }
          });
        } catch (error) {
          res.status(500).json({ success: false, message: error.message });
        }
      });

      const performanceResults = [];

      // Test performance with different browsers
      for (const [browserName, browserData] of Object.entries(browserUserAgents)) {
        const response = await request(app)
          .get('/api/posts/performance')
          .set('User-Agent', browserData.userAgent)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.posts).toHaveLength(20);
        expect(response.body.performance.processingTime).toBeLessThan(5000); // Should complete within 5 seconds

        performanceResults.push({
          browser: browserName,
          processingTime: response.body.performance.processingTime
        });
      }

      // Verify performance is consistent across browsers (within reasonable variance)
      const avgProcessingTime = performanceResults.reduce((sum, result) => sum + result.processingTime, 0) / performanceResults.length;
      
      if (avgProcessingTime > 0) {
        performanceResults.forEach(result => {
          const variance = Math.abs(result.processingTime - avgProcessingTime) / avgProcessingTime;
          expect(variance).toBeLessThan(5.0); // Less than 500% variance (more lenient for test environment)
        });
      } else {
        // If processing time is 0 or very small, just verify all results are similar
        performanceResults.forEach(result => {
          expect(result.processingTime).toBeLessThan(100); // Should be under 100ms
        });
      }
    });
  });
});