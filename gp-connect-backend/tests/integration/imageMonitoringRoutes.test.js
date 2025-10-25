import request from 'supertest';
import { vi } from 'vitest';
import express from 'express';
import imageMonitoringRoutes from '../../routes/imageMonitoring.js';
import imageCleanupService from '../../services/imageCleanupService.js';
import imagePerformanceService from '../../services/imagePerformanceService.js';

// Mock services
vi.mock('../../services/imageCleanupService.js');
vi.mock('../../services/imagePerformanceService.js');

describe('Image Monitoring Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/image-monitoring', imageMonitoringRoutes);
    
    // Reset mocks
    vi.clearAllMocks();
  });

  describe('GET /api/image-monitoring/cleanup/analysis', () => {
    it('should return orphaned images analysis', async () => {
      const mockAnalysis = {
        totalCloudinaryImages: 100,
        totalUsedImages: 80,
        totalOrphanedImages: 20,
        orphanedImages: [
          { publicId: 'gp-connect-posts/orphan1', bytes: 1000 },
          { publicId: 'gp-connect-posts/orphan2', bytes: 2000 }
        ],
        totalOrphanedSize: 3000
      };

      imageCleanupService.identifyOrphanedImages = vi.fn().mockResolvedValue(mockAnalysis);

      const response = await request(app)
        .get('/api/image-monitoring/cleanup/analysis')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAnalysis);
      expect(imageCleanupService.identifyOrphanedImages).toHaveBeenCalledTimes(1);
    });

    it('should handle errors', async () => {
      imageCleanupService.identifyOrphanedImages.mockRejectedValue(new Error('Analysis failed'));

      const response = await request(app)
        .get('/api/image-monitoring/cleanup/analysis')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Analysis failed');
    });
  });

  describe('POST /api/image-monitoring/cleanup/execute', () => {
    it('should execute cleanup with default options', async () => {
      const mockResult = {
        success: true,
        dryRun: true,
        deletedCount: 0,
        wouldDelete: [
          { publicId: 'gp-connect-posts/orphan1' }
        ]
      };

      imageCleanupService.cleanupOrphanedImages.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/image-monitoring/cleanup/execute')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(imageCleanupService.cleanupOrphanedImages).toHaveBeenCalledWith({
        dryRun: true,
        maxImages: 50,
        olderThanDays: 7,
        createBackup: true
      });
    });

    it('should execute cleanup with custom options', async () => {
      const mockResult = {
        success: true,
        dryRun: false,
        deletedCount: 5,
        deletedImages: []
      };

      imageCleanupService.cleanupOrphanedImages.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/image-monitoring/cleanup/execute')
        .send({
          dryRun: false,
          maxImages: 10,
          olderThanDays: 30,
          createBackup: false
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(imageCleanupService.cleanupOrphanedImages).toHaveBeenCalledWith({
        dryRun: false,
        maxImages: 10,
        olderThanDays: 30,
        createBackup: false
      });
    });

    it('should handle cleanup errors', async () => {
      imageCleanupService.cleanupOrphanedImages.mockRejectedValue(new Error('Cleanup failed'));

      const response = await request(app)
        .post('/api/image-monitoring/cleanup/execute')
        .send({})
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Cleanup failed');
    });
  });

  describe('GET /api/image-monitoring/usage', () => {
    it('should return usage statistics and monitoring data', async () => {
      const mockStats = {
        plan: 'Free',
        images: { total: 100, totalSizeMB: 50 }
      };
      const mockMonitoring = {
        usage: { storage: { used: 50000000, limit: 1000000000 } },
        alerts: []
      };

      imageCleanupService.getUsageStatistics.mockResolvedValue(mockStats);
      imagePerformanceService.monitorCloudinaryUsage.mockResolvedValue(mockMonitoring);

      const response = await request(app)
        .get('/api/image-monitoring/usage')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.statistics).toEqual(mockStats);
      expect(response.body.data.monitoring).toEqual(mockMonitoring);
    });

    it('should handle usage errors', async () => {
      imageCleanupService.getUsageStatistics.mockRejectedValue(new Error('Usage failed'));

      const response = await request(app)
        .get('/api/image-monitoring/usage')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Usage failed');
    });
  });

  describe('GET /api/image-monitoring/performance', () => {
    it('should return performance analytics with default options', async () => {
      const mockAnalytics = {
        totalRequests: 100,
        successfulRequests: 95,
        failedRequests: 5,
        errorRate: 0.05,
        loadTimes: { average: 1500, median: 1200 }
      };

      imagePerformanceService.getPerformanceAnalytics.mockReturnValue(mockAnalytics);

      const response = await request(app)
        .get('/api/image-monitoring/performance')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAnalytics);
      expect(imagePerformanceService.getPerformanceAnalytics).toHaveBeenCalledWith({});
    });

    it('should return performance analytics with query parameters', async () => {
      const mockAnalytics = {
        totalRequests: 50,
        loadTimes: { average: 1000 }
      };

      imagePerformanceService.getPerformanceAnalytics.mockReturnValue(mockAnalytics);

      const response = await request(app)
        .get('/api/image-monitoring/performance')
        .query({
          startDate: '2023-01-01T00:00:00.000Z',
          endDate: '2023-01-02T00:00:00.000Z',
          publicId: 'gp-connect-posts/test'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(imagePerformanceService.getPerformanceAnalytics).toHaveBeenCalledWith({
        startDate: new Date('2023-01-01T00:00:00.000Z'),
        endDate: new Date('2023-01-02T00:00:00.000Z'),
        publicId: 'gp-connect-posts/test'
      });
    });

    it('should handle performance analytics errors', async () => {
      imagePerformanceService.getPerformanceAnalytics.mockImplementation(() => {
        throw new Error('Analytics failed');
      });

      const response = await request(app)
        .get('/api/image-monitoring/performance')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Analytics failed');
    });
  });

  describe('POST /api/image-monitoring/performance/track-load', () => {
    it('should track image load time', async () => {
      const response = await request(app)
        .post('/api/image-monitoring/performance/track-load')
        .send({
          imageUrl: 'https://res.cloudinary.com/demo/image/upload/v123/gp-connect-posts/test.jpg',
          loadTime: 1500,
          userAgent: 'Mozilla/5.0',
          location: 'US'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Load time tracked successfully');
      expect(imagePerformanceService.trackImageLoadTime).toHaveBeenCalledWith(
        'https://res.cloudinary.com/demo/image/upload/v123/gp-connect-posts/test.jpg',
        1500,
        'Mozilla/5.0',
        'US'
      );
    });

    it('should require imageUrl and loadTime', async () => {
      const response = await request(app)
        .post('/api/image-monitoring/performance/track-load')
        .send({
          imageUrl: 'https://example.com/test.jpg'
          // Missing loadTime
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('imageUrl and loadTime are required');
    });

    it('should handle tracking errors', async () => {
      imagePerformanceService.trackImageLoadTime.mockImplementation(() => {
        throw new Error('Tracking failed');
      });

      const response = await request(app)
        .post('/api/image-monitoring/performance/track-load')
        .send({
          imageUrl: 'https://example.com/test.jpg',
          loadTime: 1500
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Tracking failed');
    });
  });

  describe('POST /api/image-monitoring/performance/track-error', () => {
    it('should track image load error', async () => {
      const response = await request(app)
        .post('/api/image-monitoring/performance/track-error')
        .send({
          imageUrl: 'https://res.cloudinary.com/demo/image/upload/v123/gp-connect-posts/test.jpg',
          error: 'Network timeout',
          userAgent: 'Mozilla/5.0'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Error tracked successfully');
      expect(imagePerformanceService.trackImageError).toHaveBeenCalledWith(
        'https://res.cloudinary.com/demo/image/upload/v123/gp-connect-posts/test.jpg',
        'Network timeout',
        'Mozilla/5.0'
      );
    });

    it('should require imageUrl and error', async () => {
      const response = await request(app)
        .post('/api/image-monitoring/performance/track-error')
        .send({
          imageUrl: 'https://example.com/test.jpg'
          // Missing error
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('imageUrl and error are required');
    });
  });

  describe('GET /api/image-monitoring/optimize/:publicId', () => {
    it('should generate optimized URLs', async () => {
      const mockUrls = {
        thumbnail: 'https://cloudinary.com/thumb.jpg',
        small: 'https://cloudinary.com/small.jpg',
        medium: 'https://cloudinary.com/medium.jpg',
        large: 'https://cloudinary.com/large.jpg'
      };

      imagePerformanceService.generateOptimizedUrls.mockReturnValue(mockUrls);

      const response = await request(app)
        .get('/api/image-monitoring/optimize/gp-connect-posts/test')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.publicId).toBe('gp-connect-posts/test');
      expect(response.body.data.optimizedUrls).toEqual(mockUrls);
      expect(imagePerformanceService.generateOptimizedUrls).toHaveBeenCalledWith(
        'gp-connect-posts/test',
        {}
      );
    });

    it('should use query parameters for optimization options', async () => {
      const mockUrls = { large: 'https://cloudinary.com/large.jpg' };
      imagePerformanceService.generateOptimizedUrls.mockReturnValue(mockUrls);

      const response = await request(app)
        .get('/api/image-monitoring/optimize/gp-connect-posts/test')
        .query({
          baseWidth: '1200',
          baseHeight: '800',
          quality: '80',
          format: 'jpg'
        })
        .expect(200);

      expect(imagePerformanceService.generateOptimizedUrls).toHaveBeenCalledWith(
        'gp-connect-posts/test',
        {
          baseWidth: 1200,
          baseHeight: 800,
          quality: '80',
          format: 'jpg'
        }
      );
    });

    it('should handle optimization errors', async () => {
      imagePerformanceService.generateOptimizedUrls.mockImplementation(() => {
        throw new Error('Optimization failed');
      });

      const response = await request(app)
        .get('/api/image-monitoring/optimize/gp-connect-posts/test')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Optimization failed');
    });
  });

  describe('GET /api/image-monitoring/responsive/:publicId', () => {
    it('should generate responsive image set', async () => {
      const mockSet = {
        srcset: 'https://cloudinary.com/w_320/test.jpg 320w, https://cloudinary.com/w_640/test.jpg 640w',
        sizes: '(max-width: 320px) 320px, 640px',
        defaultSrc: 'https://cloudinary.com/w_1024/test.jpg'
      };

      imagePerformanceService.generateResponsiveImageSet.mockReturnValue(mockSet);

      const response = await request(app)
        .get('/api/image-monitoring/responsive/gp-connect-posts/test')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.publicId).toBe('gp-connect-posts/test');
      expect(response.body.data.srcset).toBe(mockSet.srcset);
      expect(response.body.data.sizes).toBe(mockSet.sizes);
      expect(response.body.data.defaultSrc).toBe(mockSet.defaultSrc);
    });

    it('should use custom widths from query parameters', async () => {
      const mockSet = { srcset: 'test', sizes: 'test', defaultSrc: 'test' };
      imagePerformanceService.generateResponsiveImageSet.mockReturnValue(mockSet);

      const response = await request(app)
        .get('/api/image-monitoring/responsive/gp-connect-posts/test')
        .query({
          widths: '400,800,1200',
          quality: 'auto',
          format: 'webp'
        })
        .expect(200);

      expect(imagePerformanceService.generateResponsiveImageSet).toHaveBeenCalledWith(
        'gp-connect-posts/test',
        {
          widths: [400, 800, 1200],
          quality: 'auto',
          format: 'webp'
        }
      );
    });
  });

  describe('GET /api/image-monitoring/health', () => {
    it('should return healthy status', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: '2023-01-01T00:00:00.000Z',
        checks: {
          cloudinaryConnection: { status: 'pass' }
        },
        alerts: []
      };

      imagePerformanceService.getHealthCheck.mockResolvedValue(mockHealth);

      const response = await request(app)
        .get('/api/image-monitoring/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockHealth);
    });

    it('should return degraded status with 200', async () => {
      const mockHealth = {
        status: 'degraded',
        alerts: [{ type: 'performance', severity: 'warning' }]
      };

      imagePerformanceService.getHealthCheck.mockResolvedValue(mockHealth);

      const response = await request(app)
        .get('/api/image-monitoring/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('degraded');
    });

    it('should return unhealthy status with 503', async () => {
      const mockHealth = {
        status: 'unhealthy',
        alerts: [{ type: 'connection', severity: 'critical' }]
      };

      imagePerformanceService.getHealthCheck.mockResolvedValue(mockHealth);

      const response = await request(app)
        .get('/api/image-monitoring/health')
        .expect(503);

      expect(response.body.success).toBe(false);
      expect(response.body.data.status).toBe('unhealthy');
    });

    it('should handle health check errors', async () => {
      imagePerformanceService.getHealthCheck.mockRejectedValue(new Error('Health check failed'));

      const response = await request(app)
        .get('/api/image-monitoring/health')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Health check failed');
      expect(response.body.data.status).toBe('unhealthy');
    });
  });

  describe('PUT /api/image-monitoring/settings/thresholds', () => {
    it('should update alert thresholds', async () => {
      imagePerformanceService.alertThresholds = {
        loadTime: 5000,
        errorRate: 0.1,
        usageLimit: 0.8
      };

      const response = await request(app)
        .put('/api/image-monitoring/settings/thresholds')
        .send({
          loadTime: 5000,
          errorRate: 0.1,
          usageLimit: 0.8
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Alert thresholds updated successfully');
      expect(imagePerformanceService.setAlertThresholds).toHaveBeenCalledWith({
        loadTime: 5000,
        errorRate: 0.1,
        usageLimit: 0.8
      });
    });

    it('should ignore non-numeric values', async () => {
      const response = await request(app)
        .put('/api/image-monitoring/settings/thresholds')
        .send({
          loadTime: 'invalid',
          errorRate: 0.1
        })
        .expect(200);

      expect(imagePerformanceService.setAlertThresholds).toHaveBeenCalledWith({
        errorRate: 0.1
      });
    });
  });

  describe('DELETE /api/image-monitoring/performance/metrics', () => {
    it('should clear performance metrics', async () => {
      const response = await request(app)
        .delete('/api/image-monitoring/performance/metrics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Performance metrics cleared successfully');
      expect(imagePerformanceService.clearMetrics).toHaveBeenCalledTimes(1);
    });

    it('should handle clear metrics errors', async () => {
      imagePerformanceService.clearMetrics.mockImplementation(() => {
        throw new Error('Clear failed');
      });

      const response = await request(app)
        .delete('/api/image-monitoring/performance/metrics')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Clear failed');
    });
  });
});