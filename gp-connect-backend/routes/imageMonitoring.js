import express from 'express';
import imageCleanupService from '../services/imageCleanupService.js';
import imagePerformanceService from '../services/imagePerformanceService.js';

const router = express.Router();

/**
 * GET /api/image-monitoring/cleanup/analysis
 * Get analysis of orphaned images without performing cleanup
 */
router.get('/cleanup/analysis', async (req, res) => {
  try {
    const analysis = await imageCleanupService.identifyOrphanedImages();
    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('Error analyzing orphaned images:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/image-monitoring/cleanup/execute
 * Execute cleanup of orphaned images
 */
router.post('/cleanup/execute', async (req, res) => {
  try {
    const {
      dryRun = true,
      maxImages = 50,
      olderThanDays = 7,
      createBackup = true
    } = req.body;

    const result = await imageCleanupService.cleanupOrphanedImages({
      dryRun,
      maxImages,
      olderThanDays,
      createBackup
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error executing cleanup:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/image-monitoring/usage
 * Get Cloudinary usage statistics and monitoring data
 */
router.get('/usage', async (req, res) => {
  try {
    const [usageStats, usageMonitoring] = await Promise.all([
      imageCleanupService.getUsageStatistics(),
      imagePerformanceService.monitorCloudinaryUsage()
    ]);

    res.json({
      success: true,
      data: {
        statistics: usageStats,
        monitoring: usageMonitoring
      }
    });
  } catch (error) {
    console.error('Error getting usage data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/image-monitoring/performance
 * Get performance analytics for image delivery
 */
router.get('/performance', async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      publicId
    } = req.query;

    const options = {};
    if (startDate) options.startDate = new Date(startDate);
    if (endDate) options.endDate = new Date(endDate);
    if (publicId) options.publicId = publicId;

    const analytics = imagePerformanceService.getPerformanceAnalytics(options);

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error getting performance analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/image-monitoring/performance/track-load
 * Track image load time (called by frontend)
 */
router.post('/performance/track-load', async (req, res) => {
  try {
    const {
      imageUrl,
      loadTime,
      userAgent,
      location
    } = req.body;

    if (!imageUrl || typeof loadTime !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'imageUrl and loadTime are required'
      });
    }

    imagePerformanceService.trackImageLoadTime(
      imageUrl,
      loadTime,
      userAgent || req.get('User-Agent'),
      location
    );

    res.json({
      success: true,
      message: 'Load time tracked successfully'
    });
  } catch (error) {
    console.error('Error tracking load time:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/image-monitoring/performance/track-error
 * Track image load error (called by frontend)
 */
router.post('/performance/track-error', async (req, res) => {
  try {
    const {
      imageUrl,
      error,
      userAgent
    } = req.body;

    if (!imageUrl || !error) {
      return res.status(400).json({
        success: false,
        error: 'imageUrl and error are required'
      });
    }

    imagePerformanceService.trackImageError(
      imageUrl,
      error,
      userAgent || req.get('User-Agent')
    );

    res.json({
      success: true,
      message: 'Error tracked successfully'
    });
  } catch (error) {
    console.error('Error tracking image error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/image-monitoring/optimize/:publicId
 * Get optimized URLs for a specific image
 */
router.get('/optimize/:publicId', async (req, res) => {
  try {
    const { publicId } = req.params;
    const {
      baseWidth,
      baseHeight,
      quality,
      format
    } = req.query;

    const options = {};
    if (baseWidth) options.baseWidth = parseInt(baseWidth);
    if (baseHeight) options.baseHeight = parseInt(baseHeight);
    if (quality) options.quality = quality;
    if (format) options.format = format;

    const optimizedUrls = imagePerformanceService.generateOptimizedUrls(publicId, options);

    res.json({
      success: true,
      data: {
        publicId,
        optimizedUrls
      }
    });
  } catch (error) {
    console.error('Error generating optimized URLs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/image-monitoring/responsive/:publicId
 * Get responsive image set for a specific image
 */
router.get('/responsive/:publicId', async (req, res) => {
  try {
    const { publicId } = req.params;
    const {
      widths,
      quality,
      format
    } = req.query;

    const options = {};
    if (widths) options.widths = widths.split(',').map(w => parseInt(w.trim()));
    if (quality) options.quality = quality;
    if (format) options.format = format;

    const responsiveSet = imagePerformanceService.generateResponsiveImageSet(publicId, options);

    res.json({
      success: true,
      data: {
        publicId,
        ...responsiveSet
      }
    });
  } catch (error) {
    console.error('Error generating responsive image set:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/image-monitoring/health
 * Get health check status for image delivery system
 */
router.get('/health', async (req, res) => {
  try {
    const healthCheck = await imagePerformanceService.getHealthCheck();
    
    // Set appropriate HTTP status based on health
    let statusCode = 200;
    if (healthCheck.status === 'degraded') {
      statusCode = 200; // Still operational but with issues
    } else if (healthCheck.status === 'unhealthy') {
      statusCode = 503; // Service unavailable
    }

    res.status(statusCode).json({
      success: healthCheck.status !== 'unhealthy',
      data: healthCheck
    });
  } catch (error) {
    console.error('Error getting health check:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      data: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          error: {
            status: 'fail',
            message: error.message
          }
        }
      }
    });
  }
});

/**
 * PUT /api/image-monitoring/settings/thresholds
 * Update alert thresholds for performance monitoring
 */
router.put('/settings/thresholds', async (req, res) => {
  try {
    const {
      loadTime,
      errorRate,
      usageLimit
    } = req.body;

    const thresholds = {};
    if (typeof loadTime === 'number') thresholds.loadTime = loadTime;
    if (typeof errorRate === 'number') thresholds.errorRate = errorRate;
    if (typeof usageLimit === 'number') thresholds.usageLimit = usageLimit;

    imagePerformanceService.setAlertThresholds(thresholds);

    res.json({
      success: true,
      message: 'Alert thresholds updated successfully',
      data: imagePerformanceService.alertThresholds
    });
  } catch (error) {
    console.error('Error updating thresholds:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/image-monitoring/performance/metrics
 * Clear performance metrics (for testing or maintenance)
 */
router.delete('/performance/metrics', async (req, res) => {
  try {
    imagePerformanceService.clearMetrics();

    res.json({
      success: true,
      message: 'Performance metrics cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing metrics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;