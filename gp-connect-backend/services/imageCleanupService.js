import { v2 as cloudinary } from 'cloudinary';
import Post from '../models/Post.js';
import cloudinaryService from './cloudinaryService.js';

/**
 * Image Cleanup Service for managing Cloudinary storage
 * Provides methods for identifying and removing unused images
 */
class ImageCleanupService {
  constructor() {
    this.cloudinary = cloudinary;
    this.dryRun = true; // Safety flag to prevent accidental deletions
  }

  /**
   * Get all images from Cloudinary in the gp-connect-posts folder
   * @returns {Promise<Array>} Array of image resources
   */
  async getAllCloudinaryImages() {
    try {
      if (!cloudinaryService.isReady()) {
        throw new Error('Cloudinary not configured');
      }

      const images = [];
      let nextCursor = null;

      do {
        const result = await this.cloudinary.api.resources({
          type: 'upload',
          prefix: 'gp-connect-posts/',
          max_results: 500,
          next_cursor: nextCursor
        });

        images.push(...result.resources);
        nextCursor = result.next_cursor;
      } while (nextCursor);

      return images;
    } catch (error) {
      console.error('Error fetching Cloudinary images:', error);
      throw new Error(`Failed to fetch Cloudinary images: ${error.message}`);
    }
  }

  /**
   * Get all image URLs from database posts
   * @returns {Promise<Set>} Set of image URLs used in posts
   */
  async getUsedImageUrls() {
    try {
      const posts = await Post.find({ image: { $exists: true, $ne: null } }, 'image');
      const imageUrls = new Set();

      posts.forEach(post => {
        if (post.image && post.image.trim()) {
          imageUrls.add(post.image);
        }
      });

      return imageUrls;
    } catch (error) {
      console.error('Error fetching used image URLs:', error);
      throw new Error(`Failed to fetch used image URLs: ${error.message}`);
    }
  }

  /**
   * Extract public ID from Cloudinary URL
   * @param {string} url - Cloudinary image URL
   * @returns {string|null} Public ID or null if not a valid Cloudinary URL
   */
  extractPublicIdFromUrl(url) {
    try {
      // Match Cloudinary URL pattern and extract public ID
      const match = url.match(/\/v\d+\/(.+?)(?:\.[^.]+)?$/);
      return match ? match[1] : null;
    } catch (error) {
      console.error('Error extracting public ID from URL:', url, error);
      return null;
    }
  }

  /**
   * Identify orphaned images in Cloudinary
   * @returns {Promise<Object>} Analysis results with orphaned and used images
   */
  async identifyOrphanedImages() {
    try {
      console.log('Starting orphaned image analysis...');

      const [cloudinaryImages, usedImageUrls] = await Promise.all([
        this.getAllCloudinaryImages(),
        this.getUsedImageUrls()
      ]);

      // Extract public IDs from used URLs
      const usedPublicIds = new Set();
      usedImageUrls.forEach(url => {
        const publicId = this.extractPublicIdFromUrl(url);
        if (publicId) {
          usedPublicIds.add(publicId);
        }
      });

      // Identify orphaned images
      const orphanedImages = cloudinaryImages.filter(image => 
        !usedPublicIds.has(image.public_id)
      );

      const usedImages = cloudinaryImages.filter(image => 
        usedPublicIds.has(image.public_id)
      );

      const analysis = {
        totalCloudinaryImages: cloudinaryImages.length,
        totalUsedImages: usedImages.length,
        totalOrphanedImages: orphanedImages.length,
        orphanedImages: orphanedImages.map(img => ({
          publicId: img.public_id,
          url: img.secure_url,
          bytes: img.bytes,
          createdAt: img.created_at,
          format: img.format
        })),
        usedImages: usedImages.map(img => ({
          publicId: img.public_id,
          url: img.secure_url,
          bytes: img.bytes
        })),
        totalOrphanedSize: orphanedImages.reduce((sum, img) => sum + (img.bytes || 0), 0),
        totalUsedSize: usedImages.reduce((sum, img) => sum + (img.bytes || 0), 0)
      };

      console.log(`Analysis complete: ${analysis.totalOrphanedImages} orphaned images found`);
      return analysis;
    } catch (error) {
      console.error('Error identifying orphaned images:', error);
      throw new Error(`Failed to identify orphaned images: ${error.message}`);
    }
  }

  /**
   * Create backup verification before cleanup
   * @param {Array} imagesToDelete - Array of image objects to delete
   * @returns {Promise<Object>} Backup verification results
   */
  async createBackupVerification(imagesToDelete) {
    try {
      const backupData = {
        timestamp: new Date().toISOString(),
        totalImages: imagesToDelete.length,
        totalSize: imagesToDelete.reduce((sum, img) => sum + (img.bytes || 0), 0),
        images: imagesToDelete.map(img => ({
          publicId: img.publicId,
          url: img.url,
          bytes: img.bytes,
          createdAt: img.createdAt,
          format: img.format
        }))
      };

      // Save backup data to file
      const fs = await import('fs/promises');
      const backupFileName = `image-cleanup-backup-${Date.now()}.json`;
      const backupPath = `./backups/${backupFileName}`;

      // Ensure backups directory exists
      try {
        await fs.mkdir('./backups', { recursive: true });
      } catch (error) {
        // Directory might already exist
      }

      await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2));

      console.log(`Backup verification created: ${backupPath}`);
      return {
        success: true,
        backupPath,
        backupData
      };
    } catch (error) {
      console.error('Error creating backup verification:', error);
      throw new Error(`Failed to create backup verification: ${error.message}`);
    }
  }

  /**
   * Clean up orphaned images from Cloudinary
   * @param {Object} options - Cleanup options
   * @returns {Promise<Object>} Cleanup results
   */
  async cleanupOrphanedImages(options = {}) {
    const {
      dryRun = true,
      maxImages = 50,
      olderThanDays = 7,
      createBackup = true
    } = options;

    try {
      console.log(`Starting cleanup (dry run: ${dryRun})...`);

      const analysis = await this.identifyOrphanedImages();
      
      if (analysis.totalOrphanedImages === 0) {
        return {
          success: true,
          message: 'No orphaned images found',
          deletedCount: 0,
          analysis
        };
      }

      // Filter images by age if specified
      let imagesToDelete = analysis.orphanedImages;
      if (olderThanDays > 0) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
        
        imagesToDelete = imagesToDelete.filter(img => 
          new Date(img.createdAt) < cutoffDate
        );
      }

      // Limit number of images to delete
      imagesToDelete = imagesToDelete.slice(0, maxImages);

      if (imagesToDelete.length === 0) {
        return {
          success: true,
          message: 'No images meet deletion criteria',
          deletedCount: 0,
          analysis
        };
      }

      // Create backup if requested and not dry run
      let backupResult = null;
      if (createBackup && !dryRun) {
        backupResult = await this.createBackupVerification(imagesToDelete);
      }

      const results = {
        success: true,
        dryRun,
        totalCandidates: imagesToDelete.length,
        deletedCount: 0,
        errors: [],
        deletedImages: [],
        backup: backupResult,
        analysis
      };

      if (dryRun) {
        results.message = `Dry run: Would delete ${imagesToDelete.length} images`;
        results.wouldDelete = imagesToDelete;
        return results;
      }

      // Perform actual deletion
      console.log(`Deleting ${imagesToDelete.length} orphaned images...`);
      
      for (const image of imagesToDelete) {
        try {
          await cloudinaryService.deleteImage(image.publicId);
          results.deletedCount++;
          results.deletedImages.push(image);
          console.log(`Deleted: ${image.publicId}`);
        } catch (error) {
          console.error(`Failed to delete ${image.publicId}:`, error);
          results.errors.push({
            publicId: image.publicId,
            error: error.message
          });
        }
      }

      results.message = `Successfully deleted ${results.deletedCount} of ${imagesToDelete.length} images`;
      console.log(results.message);

      return results;
    } catch (error) {
      console.error('Error during cleanup:', error);
      throw new Error(`Cleanup failed: ${error.message}`);
    }
  }

  /**
   * Get Cloudinary usage statistics
   * @returns {Promise<Object>} Usage statistics
   */
  async getUsageStatistics() {
    try {
      if (!cloudinaryService.isReady()) {
        throw new Error('Cloudinary not configured');
      }

      const [usage, images] = await Promise.all([
        this.cloudinary.api.usage(),
        this.getAllCloudinaryImages()
      ]);

      const totalSize = images.reduce((sum, img) => sum + (img.bytes || 0), 0);
      const averageSize = images.length > 0 ? totalSize / images.length : 0;

      return {
        plan: usage.plan,
        credits: {
          used: usage.credits?.used || 0,
          limit: usage.credits?.limit || 0,
          remaining: (usage.credits?.limit || 0) - (usage.credits?.used || 0)
        },
        storage: {
          used: usage.storage?.used || 0,
          limit: usage.storage?.limit || 0,
          remaining: (usage.storage?.limit || 0) - (usage.storage?.used || 0)
        },
        bandwidth: {
          used: usage.bandwidth?.used || 0,
          limit: usage.bandwidth?.limit || 0,
          remaining: (usage.bandwidth?.limit || 0) - (usage.bandwidth?.used || 0)
        },
        transformations: {
          used: usage.transformations?.used || 0,
          limit: usage.transformations?.limit || 0,
          remaining: (usage.transformations?.limit || 0) - (usage.transformations?.used || 0)
        },
        images: {
          total: images.length,
          totalSize,
          averageSize,
          totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100
        },
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting usage statistics:', error);
      throw new Error(`Failed to get usage statistics: ${error.message}`);
    }
  }

  /**
   * Schedule cleanup job (placeholder for cron job integration)
   * @param {Object} schedule - Schedule configuration
   * @returns {Object} Schedule configuration
   */
  scheduleCleanup(schedule = {}) {
    const defaultSchedule = {
      enabled: false,
      cron: '0 2 * * 0', // Weekly at 2 AM on Sunday
      options: {
        dryRun: false,
        maxImages: 100,
        olderThanDays: 30,
        createBackup: true
      }
    };

    const config = { ...defaultSchedule, ...schedule };
    
    console.log('Cleanup schedule configured:', config);
    
    // In a real implementation, this would integrate with a job scheduler
    // like node-cron, bull queue, or similar
    return config;
  }
}

// Create and export singleton instance
const imageCleanupService = new ImageCleanupService();

export default imageCleanupService;
export { ImageCleanupService };