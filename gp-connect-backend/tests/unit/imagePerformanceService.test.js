import { vi } from 'vitest';
import { ImagePerformanceService } from '../../services/imagePerformanceService.js';
import cloudinaryService from '../../services/cloudinaryService.js';
import { v2 as cloudinary } from 'cloudinary';

// Mock dependencies
vi.mock('../../services/cloudinaryService.js');
vi.mock('cloudinary');

describe('ImagePerformanceService', () => {
  let performanceService;
  let mockCloudinary;

  beforeEach(() => {
    performanceService = new ImagePerformanceService();
    
    // Mock cloudinary
    mockCloudinary = {
      api: {
        usage: vi.fn()
      },
      url: vi.fn()
    };
    
    // Mock the cloudinary v2 import
    cloudinary.api = mockCloudinary.api;
    cloudinary.url = mockCloudinary.url;

    // Reset mocks
    vi.clearAllMocks();
    
    // Mock cloudinaryService
    cloudinaryService.isReady = vi.fn().mockReturnValue(true);
    cloudinaryService.testConnection = vi.fn().mockResolvedValue(true);
  });

  describe('trackImageLoadTime', () => {
    it('should track image load time successfully', () => {
      const imageUrl = 'https://res.cloudinary.com/demo/image/upload/v1234567890/gp-connect-posts/sample.jpg';
      const loadTime = 1500;
      const userAgent = 'Mozilla/5.0';
      const location = 'US';

      performanceService.trackImageLoadTime(imageUrl, loadTime, userAgent, location);

      expect(performanceService.getMetricsCount()).toBe(1);
      
      const metrics = Array.from(performanceService.performanceMetrics.values());
      const metric = metrics[0];
      
      expect(metric.publicId).toBe('gp-connect-posts/sample');
      expect(metric.loadTime).toBe(loadTime);
      expect(metric.userAgent).toBe(userAgent);
      expect(metric.location).toBe(location);
      expect(metric.success).toBe(true);
    });

    it('should not track metrics for invalid URLs', () => {
      performanceService.trackImageLoadTime('invalid-url', 1500);
      expect(performanceService.getMetricsCount()).toBe(0);
    });

    it('should limit metrics to 1000 entries', () => {
      const imageUrl = 'https://res.cloudinary.com/demo/image/upload/v1234567890/gp-connect-posts/sample.jpg';
      
      // Add 1001 metrics
      for (let i = 0; i < 1001; i++) {
        performanceService.trackImageLoadTime(imageUrl, 1000 + i);
      }

      expect(performanceService.getMetricsCount()).toBe(1000);
    });
  });

  describe('trackImageError', () => {
    it('should track image load errors', () => {
      const imageUrl = 'https://res.cloudinary.com/demo/image/upload/v1234567890/gp-connect-posts/sample.jpg';
      const error = 'Network timeout';
      const userAgent = 'Mozilla/5.0';

      performanceService.trackImageError(imageUrl, error, userAgent);

      expect(performanceService.getMetricsCount()).toBe(1);
      
      const metrics = Array.from(performanceService.performanceMetrics.values());
      const metric = metrics[0];
      
      expect(metric.publicId).toBe('gp-connect-posts/sample');
      expect(metric.error).toBe(error);
      expect(metric.userAgent).toBe(userAgent);
      expect(metric.success).toBe(false);
    });

    it('should not track errors for invalid URLs', () => {
      performanceService.trackImageError('invalid-url', 'Error message');
      expect(performanceService.getMetricsCount()).toBe(0);
    });
  });

  describe('extractPublicIdFromUrl', () => {
    it('should extract public ID from Cloudinary URL', () => {
      const url = 'https://res.cloudinary.com/demo/image/upload/v1234567890/gp-connect-posts/sample.jpg';
      const result = performanceService.extractPublicIdFromUrl(url);
      expect(result).toBe('gp-connect-posts/sample');
    });

    it('should handle URLs without file extension', () => {
      const url = 'https://res.cloudinary.com/demo/image/upload/v1234567890/gp-connect-posts/sample';
      const result = performanceService.extractPublicIdFromUrl(url);
      expect(result).toBe('gp-connect-posts/sample');
    });

    it('should return null for invalid URLs', () => {
      const url = 'https://example.com/invalid-url.jpg';
      const result = performanceService.extractPublicIdFromUrl(url);
      expect(result).toBe(null);
    });
  });

  describe('getPerformanceAnalytics', () => {
    beforeEach(() => {
      // Clear metrics before each test
      performanceService.clearMetrics();
    });

    it('should return analytics for tracked metrics', () => {
      const imageUrl = 'https://res.cloudinary.com/demo/image/upload/v1234567890/gp-connect-posts/sample.jpg';
      
      // Add some successful load times
      performanceService.trackImageLoadTime(imageUrl, 1000);
      performanceService.trackImageLoadTime(imageUrl, 2000);
      performanceService.trackImageLoadTime(imageUrl, 3000);
      
      // Add an error
      performanceService.trackImageError(imageUrl, 'Network error');

      const analytics = performanceService.getPerformanceAnalytics();

      expect(analytics.totalRequests).toBe(4);
      expect(analytics.successfulRequests).toBe(3);
      expect(analytics.failedRequests).toBe(1);
      expect(analytics.errorRate).toBe(0.25);
      expect(analytics.loadTimes.average).toBe(2000);
      expect(analytics.loadTimes.median).toBe(2000);
      expect(analytics.loadTimes.min).toBe(1000);
      expect(analytics.loadTimes.max).toBe(3000);
      expect(analytics.topErrors['Network error']).toBe(1);
    });

    it('should filter metrics by date range', () => {
      const imageUrl = 'https://res.cloudinary.com/demo/image/upload/v1234567890/gp-connect-posts/sample.jpg';
      
      // Mock Date.now to control timestamps
      const originalNow = Date.now;
      const baseTime = 1000000000000;
      Date.now = jest.fn()
        .mockReturnValueOnce(baseTime) // First metric
        .mockReturnValueOnce(baseTime + 60000) // Second metric (1 minute later)
        .mockReturnValueOnce(baseTime + 120000); // Third metric (2 minutes later)

      performanceService.trackImageLoadTime(imageUrl, 1000);
      performanceService.trackImageLoadTime(imageUrl, 2000);
      performanceService.trackImageLoadTime(imageUrl, 3000);

      // Restore Date.now
      Date.now = originalNow;

      const startDate = new Date(baseTime + 30000); // 30 seconds after first metric
      const endDate = new Date(baseTime + 90000); // 90 seconds after first metric

      const analytics = performanceService.getPerformanceAnalytics({ startDate, endDate });

      expect(analytics.totalRequests).toBe(1); // Only the second metric should be included
      expect(analytics.loadTimes.average).toBe(2000);
    });

    it('should filter metrics by public ID', () => {
      const imageUrl1 = 'https://res.cloudinary.com/demo/image/upload/v1234567890/gp-connect-posts/sample1.jpg';
      const imageUrl2 = 'https://res.cloudinary.com/demo/image/upload/v1234567890/gp-connect-posts/sample2.jpg';
      
      performanceService.trackImageLoadTime(imageUrl1, 1000);
      performanceService.trackImageLoadTime(imageUrl2, 2000);

      const analytics = performanceService.getPerformanceAnalytics({ 
        publicId: 'gp-connect-posts/sample1' 
      });

      expect(analytics.totalRequests).toBe(1);
      expect(analytics.loadTimes.average).toBe(1000);
    });

    it('should handle empty metrics', () => {
      const analytics = performanceService.getPerformanceAnalytics();

      expect(analytics.totalRequests).toBe(0);
      expect(analytics.successfulRequests).toBe(0);
      expect(analytics.failedRequests).toBe(0);
      expect(analytics.errorRate).toBe(0);
      expect(analytics.loadTimes.average).toBe(0);
    });

    it('should calculate percentiles correctly', () => {
      const imageUrl = 'https://res.cloudinary.com/demo/image/upload/v1234567890/gp-connect-posts/sample.jpg';
      
      // Add 100 metrics with load times from 100ms to 10000ms
      for (let i = 1; i <= 100; i++) {
        performanceService.trackImageLoadTime(imageUrl, i * 100);
      }

      const analytics = performanceService.getPerformanceAnalytics();

      expect(analytics.loadTimes.p95).toBe(9500); // 95th percentile
      expect(analytics.loadTimes.median).toBe(5000); // 50th percentile
    });
  });

  describe('monitorCloudinaryUsage', () => {
    it('should monitor usage and return alerts when thresholds exceeded', async () => {
      const mockUsage = {
        storage: { used: 950000000, limit: 1000000000 }, // 95% usage
        bandwidth: { used: 50000000, limit: 100000000 }, // 50% usage
        transformations: { used: 24000, limit: 25000 }, // 96% usage
        credits: { used: 900, limit: 1000 } // 90% usage
      };

      mockCloudinary.api.usage.mockResolvedValue(mockUsage);

      const result = await performanceService.monitorCloudinaryUsage();

      expect(result.usage).toEqual(mockUsage);
      expect(result.alerts).toHaveLength(3); // Storage, transformations, and credits should trigger alerts
      
      const alertTypes = result.alerts.map(alert => alert.type);
      expect(alertTypes).toContain('storage');
      expect(alertTypes).toContain('transformations');
      expect(alertTypes).toContain('credits');
      expect(alertTypes).not.toContain('bandwidth');
    });

    it('should return no alerts when usage is below thresholds', async () => {
      const mockUsage = {
        storage: { used: 500000000, limit: 1000000000 }, // 50% usage
        bandwidth: { used: 30000000, limit: 100000000 }, // 30% usage
        transformations: { used: 10000, limit: 25000 }, // 40% usage
        credits: { used: 500, limit: 1000 } // 50% usage
      };

      mockCloudinary.api.usage.mockResolvedValue(mockUsage);

      const result = await performanceService.monitorCloudinaryUsage();

      expect(result.alerts).toHaveLength(0);
    });

    it('should handle missing usage data', async () => {
      mockCloudinary.api.usage.mockResolvedValue({});

      const result = await performanceService.monitorCloudinaryUsage();

      expect(result.alerts).toHaveLength(0);
      expect(result.usage).toEqual({});
    });

    it('should throw error when Cloudinary not configured', async () => {
      cloudinaryService.isReady.mockReturnValue(false);

      await expect(performanceService.monitorCloudinaryUsage()).rejects.toThrow('Cloudinary not configured');
    });
  });

  describe('generateOptimizedUrls', () => {
    beforeEach(() => {
      mockCloudinary.url.mockImplementation((publicId, options) => {
        return `https://res.cloudinary.com/demo/image/upload/${JSON.stringify(options)}/${publicId}`;
      });
    });

    it('should generate optimized URLs for different sizes', () => {
      const publicId = 'gp-connect-posts/sample';
      
      const result = performanceService.generateOptimizedUrls(publicId);

      expect(result).toHaveProperty('thumbnail');
      expect(result).toHaveProperty('small');
      expect(result).toHaveProperty('medium');
      expect(result).toHaveProperty('large');
      expect(result).toHaveProperty('original');
      expect(result).toHaveProperty('webp');
      expect(result).toHaveProperty('avif');

      expect(mockCloudinary.url).toHaveBeenCalledTimes(7);
    });

    it('should use custom options', () => {
      const publicId = 'gp-connect-posts/sample';
      const options = {
        baseWidth: 1200,
        baseHeight: 800,
        quality: 80,
        format: 'jpg'
      };
      
      performanceService.generateOptimizedUrls(publicId, options);

      // Verify that custom options are passed to cloudinary.url
      expect(mockCloudinary.url).toHaveBeenCalledWith(
        publicId,
        expect.objectContaining({
          width: 1200,
          height: 800,
          quality: 80,
          fetch_format: 'jpg'
        })
      );
    });

    it('should throw error when Cloudinary not configured', () => {
      cloudinaryService.isReady.mockReturnValue(false);

      expect(() => {
        performanceService.generateOptimizedUrls('test');
      }).toThrow('Cloudinary not configured');
    });
  });

  describe('generateResponsiveImageSet', () => {
    beforeEach(() => {
      mockCloudinary.url.mockImplementation((publicId, options) => {
        return `https://res.cloudinary.com/demo/image/upload/w_${options.width}/${publicId}`;
      });
    });

    it('should generate responsive image srcset', () => {
      const publicId = 'gp-connect-posts/sample';
      
      const result = performanceService.generateResponsiveImageSet(publicId);

      expect(result).toHaveProperty('srcset');
      expect(result).toHaveProperty('sizes');
      expect(result).toHaveProperty('defaultSrc');

      expect(result.srcset).toContain('320w');
      expect(result.srcset).toContain('640w');
      expect(result.srcset).toContain('1920w');
      
      expect(result.sizes).toContain('(max-width: 320px) 320px');
      expect(result.sizes).toContain('1920px');
    });

    it('should use custom widths', () => {
      const publicId = 'gp-connect-posts/sample';
      const options = { widths: [400, 800, 1200] };
      
      const result = performanceService.generateResponsiveImageSet(publicId, options);

      expect(result.srcset).toContain('400w');
      expect(result.srcset).toContain('800w');
      expect(result.srcset).toContain('1200w');
      expect(result.srcset).not.toContain('320w');
    });

    it('should throw error when Cloudinary not configured', () => {
      cloudinaryService.isReady.mockReturnValue(false);

      expect(() => {
        performanceService.generateResponsiveImageSet('test');
      }).toThrow('Cloudinary not configured');
    });
  });

  describe('getHealthCheck', () => {
    it('should return healthy status when all checks pass', async () => {
      cloudinaryService.testConnection.mockResolvedValue(true);
      mockCloudinary.api.usage.mockResolvedValue({
        storage: { used: 500000000, limit: 1000000000 }
      });

      const result = await performanceService.getHealthCheck();

      expect(result.status).toBe('healthy');
      expect(result.checks.cloudinaryConnection.status).toBe('pass');
      expect(result.alerts).toHaveLength(0);
    });

    it('should return unhealthy status when connection fails', async () => {
      cloudinaryService.testConnection.mockResolvedValue(false);
      mockCloudinary.api.usage.mockResolvedValue({});

      const result = await performanceService.getHealthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.cloudinaryConnection.status).toBe('fail');
      expect(result.alerts.some(alert => alert.type === 'connection')).toBe(true);
    });

    it('should return degraded status for performance issues', async () => {
      cloudinaryService.testConnection.mockResolvedValue(true);
      mockCloudinary.api.usage.mockResolvedValue({});

      // Add metrics with high error rate
      const imageUrl = 'https://res.cloudinary.com/demo/image/upload/v1234567890/gp-connect-posts/sample.jpg';
      performanceService.trackImageError(imageUrl, 'Error 1');
      performanceService.trackImageError(imageUrl, 'Error 2');
      performanceService.trackImageLoadTime(imageUrl, 1000);

      const result = await performanceService.getHealthCheck();

      expect(result.status).toBe('degraded');
      expect(result.alerts.some(alert => alert.type === 'error_rate')).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      cloudinaryService.testConnection.mockRejectedValue(new Error('Connection error'));

      const result = await performanceService.getHealthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.error).toBeDefined();
      expect(result.checks.error.status).toBe('fail');
    });
  });

  describe('setAlertThresholds', () => {
    it('should update alert thresholds', () => {
      const newThresholds = {
        loadTime: 5000,
        errorRate: 0.1
      };

      performanceService.setAlertThresholds(newThresholds);

      expect(performanceService.alertThresholds.loadTime).toBe(5000);
      expect(performanceService.alertThresholds.errorRate).toBe(0.1);
      expect(performanceService.alertThresholds.usageLimit).toBe(0.9); // Should keep existing value
    });
  });

  describe('clearMetrics', () => {
    it('should clear all metrics', () => {
      const imageUrl = 'https://res.cloudinary.com/demo/image/upload/v1234567890/gp-connect-posts/sample.jpg';
      performanceService.trackImageLoadTime(imageUrl, 1000);
      
      expect(performanceService.getMetricsCount()).toBe(1);
      
      performanceService.clearMetrics();
      
      expect(performanceService.getMetricsCount()).toBe(0);
    });
  });
});