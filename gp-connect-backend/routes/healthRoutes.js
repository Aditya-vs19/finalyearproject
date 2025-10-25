import express from 'express';
import cloudinaryService from '../services/cloudinaryService.js';

const router = express.Router();

/**
 * GET /api/health/cloudinary
 * Get Cloudinary service health status
 */
router.get('/cloudinary', async (req, res) => {
  try {
    const healthStatus = await cloudinaryService.getDetailedHealthStatus();
    
    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json({
      success: healthStatus.status === 'healthy',
      status: healthStatus.status,
      message: healthStatus.message,
      data: healthStatus
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      status: 'error',
      message: 'Health check failed',
      error: error.message
    });
  }
});

/**
 * GET /api/health
 * Get overall system health status
 */
router.get('/', async (req, res) => {
  try {
    const cloudinaryHealth = await cloudinaryService.getDetailedHealthStatus();
    
    const overallHealth = {
      status: cloudinaryHealth.status === 'healthy' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        cloudinary: cloudinaryHealth
      }
    };
    
    const statusCode = overallHealth.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json({
      success: overallHealth.status === 'healthy',
      data: overallHealth
    });
  } catch (error) {
    console.error('Overall health check error:', error);
    res.status(500).json({
      success: false,
      status: 'error',
      message: 'Health check failed',
      error: error.message
    });
  }
});

export default router;