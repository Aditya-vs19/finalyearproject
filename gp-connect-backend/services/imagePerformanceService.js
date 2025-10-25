import { v2 as cloudinary } from 'cloudinary';
import cloudinaryService from './cloudinaryService.js';

/**
 * Image Performance Service for monitoring and optimizing image delivery
 * Provides methods for tracking performance and optimizing image delivery
 */
class ImagePerformanceService {
  constructor() {
    this.performanceMetrics = new Map();
    this.alertThresholds = {
      loadTime: 3000, // 3 seconds
      errorRate: 0.05, // 5%
      usageLimit: 0.9 // 90% of plan limits
    };
  }

  /**
   * Track image load time
   * @param {string} imageUrl - Image URL
   * @param {number} loadTime - Load time in milliseconds
   * @param {string} userAgent - User agent string
   * @param {string} location - Geographic location (optional)
   */
  trackImageLoadTime(imageUrl, loadTime, userAgent = '', location = '') {
    const timestamp = new Date();
    const publicId = this.extractPublicIdFromUrl(imageUrl);
    
    if (!publicId) return;

    const metric = {
      publicId,
      imageUrl,
      loadTime,
      userAgent,
      location,
      timestamp,
      success: true
    };

    // Store in memory (in production, this would go to a database or analytics service)
    const key = `${publicId}_${timestamp.getTime()}`;
    this.performanceMetrics.set(key, metric);

    // Keep only last 1000 metrics to prevent memory issues
    if (this.performanceMetrics.size > 1000) {
      const oldestKey = this.performanceMetrics.keys().next().value;
      this.performanceMetrics.delete(oldestKey);
    }

    console.log(`Image load tracked: ${publicId} - ${loadTime}ms`);
  }

  /**
   * Track image load error
   * @param {string} imageUrl - Image URL that failed to load
   * @param {string} error - Error message
   * @param {string} userAgent - User agent string
   */
  trackImageError(imageUrl, error, userAgent = '') {
    const timestamp = new Date();
    const publicId = this.extractPublicIdFromUrl(imageUrl);
    
    if (!publicId) return;

    const metric = {
      publicId,
      imageUrl,
      error,
      userAgent,
      timestamp,
      success: false
    };

    const key = `${publicId}_${timestamp.getTime()}_error`;
    this.performanceMetrics.set(key, metric);

    console.error(`Image load error tracked: ${publicId} - ${error}`);
  }

  /**
   * Extract public ID from Cloudinary URL
   * @param {string} url - Cloudinary image URL
   * @returns {string|null} Public ID or null if not valid
   */
  extractPublicIdFromUrl(url) {
    try {
      const match = url.match(/\/v\d+\/(.+?)(?:\.[^.]+)?$/);
      return match ? match[1] : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get performance analytics for a specific time period
   * @param {Object} options - Analytics options
   * @returns {Object} Performance analytics
   */
  getPerformanceAnalytics(options = {}) {
    const {
      startDate = new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      endDate = new Date(),
      publicId = null
    } = options;

    const metrics = Array.from(this.performanceMetrics.values()).filter(metric => {
      const inTimeRange = metric.timestamp >= startDate && metric.timestamp <= endDate;
      const matchesPublicId = !publicId || metric.publicId === publicId;
      return inTimeRange && matchesPublicId;
    });

    const successMetrics = metrics.filter(m => m.success && m.loadTime);
    const errorMetrics = metrics.filter(m => !m.success);

    const analytics = {
      timeRange: { startDate, endDate },
      totalRequests: metrics.length,
      successfulRequests: successMetrics.length,
      failedRequests: errorMetrics.length,
      errorRate: metrics.length > 0 ? errorMetrics.length / metrics.length : 0,
      loadTimes: {
        average: 0,
        median: 0,
        p95: 0,
        min: 0,
        max: 0
      },
      topErrors: {},
      slowestImages: [],
      fastestImages: []
    };

    if (successMetrics.length > 0) {
      const loadTimes = successMetrics.map(m => m.loadTime).sort((a, b) => a - b);
      
      analytics.loadTimes.average = Math.round(loadTimes.reduce((sum, time) => sum + time, 0) / loadTimes.length);
      analytics.loadTimes.median = loadTimes[Math.floor(loadTimes.length / 2)];
      analytics.loadTimes.p95 = loadTimes[Math.floor(loadTimes.length * 0.95)];
      analytics.loadTimes.min = loadTimes[0];
      analytics.loadTimes.max = loadTimes[loadTimes.length - 1];

      // Get slowest and fastest images
      const imagePerformance = new Map();
      successMetrics.forEach(metric => {
        if (!imagePerformance.has(metric.publicId)) {
          imagePerformance.set(metric.publicId, []);
        }
        imagePerformance.get(metric.publicId).push(metric.loadTime);
      });

      const imageAverages = Array.from(imagePerformance.entries()).map(([publicId, times]) => ({
        publicId,
        averageLoadTime: Math.round(times.reduce((sum, time) => sum + time, 0) / times.length),
        requestCount: times.length
      }));

      analytics.slowestImages = imageAverages
        .sort((a, b) => b.averageLoadTime - a.averageLoadTime)
        .slice(0, 10);

      analytics.fastestImages = imageAverages
        .sort((a, b) => a.averageLoadTime - b.averageLoadTime)
        .slice(0, 10);
    }

    // Count error types
    errorMetrics.forEach(metric => {
      const errorType = metric.error || 'Unknown Error';
      analytics.topErrors[errorType] = (analytics.topErrors[errorType] || 0) + 1;
    });

    return analytics;
  }

  /**
   * Monitor Cloudinary usage and check for alerts
   * @returns {Promise<Object>} Usage monitoring results with alerts
   */
  async monitorCloudinaryUsage() {
    try {
      if (!cloudinaryService.isReady()) {
        throw new Error('Cloudinary not configured');
      }

      const usage = await cloudinary.api.usage();
      const alerts = [];

      // Check storage usage
      if (usage.storage && usage.storage.limit > 0) {
        const storageUsage = usage.storage.used / usage.storage.limit;
        if (storageUsage >= this.alertThresholds.usageLimit) {
          alerts.push({
            type: 'storage',
            severity: 'warning',
            message: `Storage usage at ${Math.round(storageUsage * 100)}% of limit`,
            current: usage.storage.used,
            limit: usage.storage.limit
          });
        }
      }

      // Check bandwidth usage
      if (usage.bandwidth && usage.bandwidth.limit > 0) {
        const bandwidthUsage = usage.bandwidth.used / usage.bandwidth.limit;
        if (bandwidthUsage >= this.alertThresholds.usageLimit) {
          alerts.push({
            type: 'bandwidth',
            severity: 'warning',
            message: `Bandwidth usage at ${Math.round(bandwidthUsage * 100)}% of limit`,
            current: usage.bandwidth.used,
            limit: usage.bandwidth.limit
          });
        }
      }

      // Check transformations usage
      if (usage.transformations && usage.transformations.limit > 0) {
        const transformationsUsage = usage.transformations.used / usage.transformations.limit;
        if (transformationsUsage >= this.alertThresholds.usageLimit) {
          alerts.push({
            type: 'transformations',
            severity: 'warning',
            message: `Transformations usage at ${Math.round(transformationsUsage * 100)}% of limit`,
            current: usage.transformations.used,
            limit: usage.transformations.limit
          });
        }
      }

      // Check credits usage
      if (usage.credits && usage.credits.limit > 0) {
        const creditsUsage = usage.credits.used / usage.credits.limit;
        if (creditsUsage >= this.alertThresholds.usageLimit) {
          alerts.push({
            type: 'credits',
            severity: 'warning',
            message: `Credits usage at ${Math.round(creditsUsage * 100)}% of limit`,
            current: usage.credits.used,
            limit: usage.credits.limit
          });
        }
      }

      return {
        timestamp: new Date().toISOString(),
        usage,
        alerts,
        thresholds: this.alertThresholds
      };
    } catch (error) {
      console.error('Error monitoring Cloudinary usage:', error);
      throw new Error(`Failed to monitor usage: ${error.message}`);
    }
  }

  /**
   * Generate optimized image URLs for different use cases
   * @param {string} publicId - Cloudinary public ID
   * @param {Object} options - Optimization options
   * @returns {Object} Optimized URLs for different scenarios
   */
  generateOptimizedUrls(publicId, options = {}) {
    const {
      baseWidth = 1000,
      baseHeight = 1000,
      quality = 'auto',
      format = 'auto'
    } = options;

    if (!cloudinaryService.isReady()) {
      throw new Error('Cloudinary not configured');
    }

    const baseTransformation = {
      quality,
      fetch_format: format
    };

    return {
      thumbnail: cloudinary.url(publicId, {
        ...baseTransformation,
        width: 150,
        height: 150,
        crop: 'fill',
        gravity: 'auto'
      }),
      small: cloudinary.url(publicId, {
        ...baseTransformation,
        width: 300,
        height: 300,
        crop: 'limit'
      }),
      medium: cloudinary.url(publicId, {
        ...baseTransformation,
        width: 600,
        height: 600,
        crop: 'limit'
      }),
      large: cloudinary.url(publicId, {
        ...baseTransformation,
        width: baseWidth,
        height: baseHeight,
        crop: 'limit'
      }),
      original: cloudinary.url(publicId, baseTransformation),
      webp: cloudinary.url(publicId, {
        ...baseTransformation,
        width: baseWidth,
        height: baseHeight,
        crop: 'limit',
        fetch_format: 'webp'
      }),
      avif: cloudinary.url(publicId, {
        ...baseTransformation,
        width: baseWidth,
        height: baseHeight,
        crop: 'limit',
        fetch_format: 'avif'
      })
    };
  }

  /**
   * Create responsive image srcset for different screen sizes
   * @param {string} publicId - Cloudinary public ID
   * @param {Object} options - Responsive options
   * @returns {Object} Srcset and sizes for responsive images
   */
  generateResponsiveImageSet(publicId, options = {}) {
    const {
      widths = [320, 640, 768, 1024, 1280, 1920],
      quality = 'auto',
      format = 'auto'
    } = options;

    if (!cloudinaryService.isReady()) {
      throw new Error('Cloudinary not configured');
    }

    const srcset = widths.map(width => {
      const url = cloudinary.url(publicId, {
        width,
        crop: 'scale',
        quality,
        fetch_format: format
      });
      return `${url} ${width}w`;
    }).join(', ');

    const sizes = [
      '(max-width: 320px) 320px',
      '(max-width: 640px) 640px',
      '(max-width: 768px) 768px',
      '(max-width: 1024px) 1024px',
      '(max-width: 1280px) 1280px',
      '1920px'
    ].join(', ');

    return {
      srcset,
      sizes,
      defaultSrc: cloudinary.url(publicId, {
        width: 1024,
        crop: 'scale',
        quality,
        fetch_format: format
      })
    };
  }

  /**
   * Get health check status for image delivery system
   * @returns {Promise<Object>} Health check results
   */
  async getHealthCheck() {
    const healthCheck = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      checks: {},
      performance: {},
      alerts: []
    };

    try {
      // Check Cloudinary connection
      const connectionTest = await cloudinaryService.testConnection();
      healthCheck.checks.cloudinaryConnection = {
        status: connectionTest ? 'pass' : 'fail',
        message: connectionTest ? 'Connected' : 'Connection failed'
      };

      if (!connectionTest) {
        healthCheck.status = 'unhealthy';
        healthCheck.alerts.push({
          type: 'connection',
          severity: 'critical',
          message: 'Cloudinary connection failed'
        });
      }

      // Check recent performance metrics
      const recentAnalytics = this.getPerformanceAnalytics({
        startDate: new Date(Date.now() - 60 * 60 * 1000) // Last hour
      });

      healthCheck.performance = {
        totalRequests: recentAnalytics.totalRequests,
        errorRate: recentAnalytics.errorRate,
        averageLoadTime: recentAnalytics.loadTimes.average
      };

      // Check for performance alerts
      if (recentAnalytics.errorRate > this.alertThresholds.errorRate) {
        healthCheck.status = 'degraded';
        healthCheck.alerts.push({
          type: 'error_rate',
          severity: 'warning',
          message: `High error rate: ${Math.round(recentAnalytics.errorRate * 100)}%`
        });
      }

      if (recentAnalytics.loadTimes.average > this.alertThresholds.loadTime) {
        healthCheck.status = 'degraded';
        healthCheck.alerts.push({
          type: 'load_time',
          severity: 'warning',
          message: `Slow average load time: ${recentAnalytics.loadTimes.average}ms`
        });
      }

      // Check Cloudinary usage
      const usageMonitoring = await this.monitorCloudinaryUsage();
      healthCheck.checks.cloudinaryUsage = {
        status: usageMonitoring.alerts.length === 0 ? 'pass' : 'warning',
        alerts: usageMonitoring.alerts
      };

      if (usageMonitoring.alerts.length > 0) {
        healthCheck.alerts.push(...usageMonitoring.alerts);
        if (healthCheck.status === 'healthy') {
          healthCheck.status = 'degraded';
        }
      }

    } catch (error) {
      console.error('Health check error:', error);
      healthCheck.status = 'unhealthy';
      healthCheck.checks.error = {
        status: 'fail',
        message: error.message
      };
    }

    return healthCheck;
  }

  /**
   * Set alert thresholds
   * @param {Object} thresholds - New threshold values
   */
  setAlertThresholds(thresholds) {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
    console.log('Alert thresholds updated:', this.alertThresholds);
  }

  /**
   * Clear performance metrics (useful for testing or memory management)
   */
  clearMetrics() {
    this.performanceMetrics.clear();
    console.log('Performance metrics cleared');
  }

  /**
   * Get current metrics count
   * @returns {number} Number of stored metrics
   */
  getMetricsCount() {
    return this.performanceMetrics.size;
  }
}

// Create and export singleton instance
const imagePerformanceService = new ImagePerformanceService();

export default imagePerformanceService;
export { ImagePerformanceService };