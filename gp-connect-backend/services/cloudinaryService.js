import { v2 as cloudinary } from 'cloudinary';

/**
 * Cloudinary Service for handling cloud image operations
 * Provides methods for uploading, deleting, and optimizing images
 */
class CloudinaryService {
  constructor(cloudinaryInstance = cloudinary) {
    this.cloudinary = cloudinaryInstance;
    this.isConfigured = false;
  }

  /**
   * Configure Cloudinary with environment variables
   * @throws {Error} If required environment variables are missing
   */
  configure() {
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      throw new Error('Missing required Cloudinary environment variables');
    }

    this.cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
      secure: true
    });

    this.isConfigured = true;
    console.log('Cloudinary configured successfully');
  }

  /**
   * Upload an image to Cloudinary
   * @param {string} filePath - Path to the file to upload
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result with URL and public_id
   */
  async uploadImage(filePath, options = {}) {
    if (!this.isConfigured) {
      throw new Error('Cloudinary not configured. Call configure() first.');
    }

    const defaultOptions = {
      folder: 'gp-connect-posts',
      resource_type: 'image',
      transformation: [
        { width: 1000, height: 1000, crop: 'limit' },
        { quality: 'auto', fetch_format: 'auto' }
      ]
    };

    const uploadOptions = { ...defaultOptions, ...options };

    try {
      const result = await this.cloudinary.uploader.upload(filePath, uploadOptions);
      return {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes
      };
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  }

  /**
   * Delete an image from Cloudinary
   * @param {string} publicId - The public ID of the image to delete
   * @returns {Promise<Object>} Deletion result
   */
  async deleteImage(publicId) {
    if (!this.isConfigured) {
      throw new Error('Cloudinary not configured. Call configure() first.');
    }

    try {
      const result = await this.cloudinary.uploader.destroy(publicId);
      return result;
    } catch (error) {
      console.error('Cloudinary delete error:', error);
      throw new Error(`Failed to delete image: ${error.message}`);
    }
  }

  /**
   * Generate optimized URL for an existing image
   * @param {string} publicId - The public ID of the image
   * @param {Object} transformations - Transformation options
   * @returns {string} Optimized image URL
   */
  optimizeUrl(publicId, transformations = {}) {
    if (!this.isConfigured) {
      throw new Error('Cloudinary not configured. Call configure() first.');
    }

    const defaultTransformations = {
      quality: 'auto',
      fetch_format: 'auto'
    };

    const options = { ...defaultTransformations, ...transformations };

    return this.cloudinary.url(publicId, options);
  }

  /**
   * Get Cloudinary configuration status
   * @returns {boolean} True if configured, false otherwise
   */
  isReady() {
    return this.isConfigured;
  }

  /**
   * Test Cloudinary connection
   * @returns {Promise<boolean>} True if connection is successful
   */
  async testConnection() {
    if (!this.isConfigured) {
      throw new Error('Cloudinary not configured. Call configure() first.');
    }

    try {
      // Test connection by getting account details
      const result = await this.cloudinary.api.ping();
      return result.status === 'ok';
    } catch (error) {
      console.error('Cloudinary connection test failed:', error);
      return false;
    }
  }

  /**
   * Get basic health status synchronously (for middleware)
   * @returns {Object} Basic health status information
   */
  getHealthStatus() {
    return {
      isHealthy: this.isConfigured,
      isConfigured: this.isConfigured,
      status: this.isConfigured ? 'configured' : 'not_configured',
      message: this.isConfigured ? 'Cloudinary is configured' : 'Cloudinary not configured'
    };
  }

  /**
   * Get detailed health status of Cloudinary service (async)
   * @returns {Promise<Object>} Detailed health status information
   */
  async getDetailedHealthStatus() {
    try {
      if (!this.isConfigured) {
        return {
          status: 'unhealthy',
          message: 'Cloudinary not configured',
          configured: false,
          connected: false
        };
      }

      const isConnected = await this.testConnection();
      
      return {
        status: isConnected ? 'healthy' : 'unhealthy',
        message: isConnected ? 'Cloudinary service is operational' : 'Cloudinary connection failed',
        configured: true,
        connected: isConnected,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Health check failed: ${error.message}`,
        configured: this.isConfigured,
        connected: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Create and export singleton instance
const cloudinaryService = new CloudinaryService();

export default cloudinaryService;
export { CloudinaryService };