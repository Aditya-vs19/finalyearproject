import { v2 as cloudinary } from 'cloudinary';

/**
 * Cloudinary Service for handling cloud image operations
 * Provides methods for uploading, deleting, and optimizing images with validation capabilities
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
      console.log(`[CloudinaryService] Starting upload for file: ${filePath}`);
      const startTime = Date.now();
      
      const result = await this.cloudinary.uploader.upload(filePath, uploadOptions);
      
      const uploadTime = Date.now() - startTime;
      console.log(`[CloudinaryService] Upload completed in ${uploadTime}ms. URL: ${result.secure_url}`);
      
      return {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes
      };
    } catch (error) {
      console.error(`[CloudinaryService] Upload failed for file: ${filePath}`, {
        error: error.message,
        stack: error.stack,
        options: uploadOptions
      });
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  }

  /**
   * Upload an image to Cloudinary with immediate validation
   * @param {string} filePath - Path to the file to upload
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result with validation status
   */
  async uploadImageWithValidation(filePath, options = {}) {
    console.log(`[CloudinaryService] Starting upload with validation for file: ${filePath}`);
    
    try {
      // Upload the image first
      const uploadResult = await this.uploadImage(filePath, options);
      
      // Validate the uploaded image is immediately accessible
      console.log(`[CloudinaryService] Validating uploaded image accessibility: ${uploadResult.url}`);
      const validationStartTime = Date.now();
      
      const isAccessible = await this.validateImageUrl(uploadResult.url);
      const validationTime = Date.now() - validationStartTime;
      
      console.log(`[CloudinaryService] Image validation completed in ${validationTime}ms. Accessible: ${isAccessible}`);
      
      if (!isAccessible) {
        console.warn(`[CloudinaryService] Uploaded image not immediately accessible: ${uploadResult.url}`);
      }
      
      return {
        ...uploadResult,
        validated: isAccessible,
        validationTime
      };
    } catch (error) {
      console.error(`[CloudinaryService] Upload with validation failed for file: ${filePath}`, {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Validate that an image URL is accessible
   * @param {string} url - The image URL to validate
   * @param {Object} options - Validation options
   * @returns {Promise<boolean>} True if image is accessible, false otherwise
   */
  async validateImageUrl(url, options = {}) {
    const { timeout = 10000, retries = 3, retryDelay = 1000 } = options;
    
    if (!url) {
      console.error('[CloudinaryService] Cannot validate empty URL');
      return false;
    }

    console.log(`[CloudinaryService] Validating image URL: ${url}`);

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          method: 'HEAD',
          signal: controller.signal,
          headers: {
            'User-Agent': 'GP-Connect-Image-Validator/1.0'
          }
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          console.log(`[CloudinaryService] Image validation successful on attempt ${attempt}. Status: ${response.status}`);
          return true;
        } else {
          console.warn(`[CloudinaryService] Image validation failed on attempt ${attempt}. Status: ${response.status}`);
          
          if (attempt < retries) {
            console.log(`[CloudinaryService] Retrying validation in ${retryDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
        }
      } catch (error) {
        console.error(`[CloudinaryService] Image validation error on attempt ${attempt}:`, {
          url,
          error: error.message,
          name: error.name
        });
        
        if (attempt < retries) {
          console.log(`[CloudinaryService] Retrying validation in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    console.error(`[CloudinaryService] Image validation failed after ${retries} attempts: ${url}`);
    return false;
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
      console.log(`[CloudinaryService] Deleting image with public ID: ${publicId}`);
      const startTime = Date.now();
      
      const result = await this.cloudinary.uploader.destroy(publicId);
      
      const deleteTime = Date.now() - startTime;
      console.log(`[CloudinaryService] Image deletion completed in ${deleteTime}ms. Result: ${result.result}`);
      
      return result;
    } catch (error) {
      console.error(`[CloudinaryService] Delete failed for public ID: ${publicId}`, {
        error: error.message,
        stack: error.stack
      });
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

  /**
   * Upload a buffer to Cloudinary (for testing purposes)
   * @param {Buffer} buffer - Buffer data to upload
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result
   */
  async uploadBuffer(buffer, options = {}) {
    if (!this.isConfigured) {
      throw new Error('Cloudinary not configured. Call configure() first.');
    }

    return new Promise((resolve, reject) => {
      this.cloudinary.uploader.upload_stream(
        options,
        (error, result) => {
          if (error) {
            reject(new Error(`Buffer upload failed: ${error.message}`));
          } else {
            resolve(result);
          }
        }
      ).end(buffer);
    });
  }

  /**
   * Test API connectivity with detailed diagnostics
   * @returns {Promise<Object>} API connectivity test result
   */
  async testApiConnectivity() {
    if (!this.isConfigured) {
      throw new Error('Cloudinary not configured. Call configure() first.');
    }

    const startTime = Date.now();
    
    try {
      const result = await this.cloudinary.api.ping();
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'success',
        responseTime,
        result: result.status,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'failed',
        responseTime,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Test image transformation capabilities
   * @returns {Promise<Object>} Transformation test result
   */
  async testTransformation() {
    if (!this.isConfigured) {
      throw new Error('Cloudinary not configured. Call configure() first.');
    }

    try {
      // Test transformation by generating a URL with transformations
      const testPublicId = 'sample'; // Cloudinary provides sample images
      const transformedUrl = this.cloudinary.url(testPublicId, {
        width: 100,
        height: 100,
        crop: 'fill',
        quality: 'auto',
        fetch_format: 'auto'
      });

      return {
        status: 'success',
        transformedUrl,
        transformations: {
          width: 100,
          height: 100,
          crop: 'fill',
          quality: 'auto',
          fetch_format: 'auto'
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'failed',
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