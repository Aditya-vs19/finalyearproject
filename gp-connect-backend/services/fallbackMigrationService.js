/**
 * Fallback Migration Service
 * Handles migration of fallback images to Cloudinary when service is restored
 * 
 * Requirements: 2.4, 3.3
 */

import fs from 'fs/promises';
import path from 'path';
import cloudinaryService from './cloudinaryService.js';
import imageErrorHandler from './imageErrorHandler.js';
import Post from '../models/Post.js';

/**
 * Fallback Migration Service Class
 * Manages migration of locally stored fallback images to Cloudinary
 */
export class FallbackMigrationService {
  constructor() {
    this.fallbackPath = path.join(process.cwd(), 'uploads', 'fallback');
    this.migrationInProgress = false;
    this.migrationQueue = [];
    this.migrationStats = {
      total: 0,
      successful: 0,
      failed: 0,
      inProgress: 0
    };
  }

  /**
   * Scan for fallback images that need migration
   * @returns {Promise<Array>} List of images needing migration
   */
  async scanFallbackImages() {
    try {
      // Check if fallback directory exists
      try {
        await fs.access(this.fallbackPath);
      } catch (error) {
        console.log('No fallback directory found');
        return [];
      }

      const files = await fs.readdir(this.fallbackPath);
      const imageFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
      });

      const fallbackImages = [];

      for (const filename of imageFiles) {
        const filePath = path.join(this.fallbackPath, filename);
        const stats = await fs.stat(filePath);
        
        // Find corresponding database records
        const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
        const fallbackUrl = `${baseUrl}/uploads/fallback/${filename}`;
        
        const posts = await Post.find({ image: fallbackUrl });
        
        fallbackImages.push({
          filename,
          filePath,
          fallbackUrl,
          size: stats.size,
          createdAt: stats.birthtime,
          posts: posts.map(post => ({
            id: post._id,
            title: post.title || 'Untitled',
            userId: post.userId
          }))
        });
      }

      console.log(`Found ${fallbackImages.length} fallback images for potential migration`);
      return fallbackImages;

    } catch (error) {
      console.error('Error scanning fallback images:', error);
      throw new Error(`Failed to scan fallback images: ${error.message}`);
    }
  }

  /**
   * Migrate a single fallback image to Cloudinary
   * @param {Object} imageInfo - Image information
   * @returns {Promise<Object>} Migration result
   */
  async migrateSingleImage(imageInfo) {
    try {
      console.log(`Migrating image: ${imageInfo.filename}`);
      
      // Upload to Cloudinary
      const uploadResult = await cloudinaryService.uploadImageDirect(
        imageInfo.filePath,
        {
          public_id: `migrated_${Date.now()}_${path.parse(imageInfo.filename).name}`,
          folder: 'gp-connect-posts/migrated'
        }
      );

      // Update database records
      const updateResults = [];
      for (const postInfo of imageInfo.posts) {
        try {
          const updateResult = await Post.findByIdAndUpdate(
            postInfo.id,
            { 
              image: uploadResult.url,
              $set: {
                'imageMetadata.migratedAt': new Date(),
                'imageMetadata.originalFallbackUrl': imageInfo.fallbackUrl,
                'imageMetadata.cloudinaryPublicId': uploadResult.publicId,
                'imageMetadata.migrationSource': 'fallback'
              }
            },
            { new: true }
          );
          
          updateResults.push({
            postId: postInfo.id,
            success: true,
            newUrl: uploadResult.url
          });
          
          console.log(`Updated post ${postInfo.id} with new Cloudinary URL`);
        } catch (error) {
          console.error(`Failed to update post ${postInfo.id}:`, error);
          updateResults.push({
            postId: postInfo.id,
            success: false,
            error: error.message
          });
        }
      }

      return {
        success: true,
        filename: imageInfo.filename,
        cloudinaryUrl: uploadResult.url,
        publicId: uploadResult.publicId,
        postsUpdated: updateResults.filter(r => r.success).length,
        postsFailed: updateResults.filter(r => !r.success).length,
        updateResults
      };

    } catch (error) {
      console.error(`Failed to migrate image ${imageInfo.filename}:`, error);
      return {
        success: false,
        filename: imageInfo.filename,
        error: error.message,
        postsUpdated: 0,
        postsFailed: imageInfo.posts.length
      };
    }
  }

  /**
   * Migrate all fallback images to Cloudinary
   * @param {Object} options - Migration options
   * @returns {Promise<Object>} Migration summary
   */
  async migrateAllFallbackImages(options = {}) {
    if (this.migrationInProgress) {
      throw new Error('Migration already in progress');
    }

    const {
      batchSize = 5,
      delayBetweenBatches = 2000,
      deleteAfterMigration = false,
      dryRun = false
    } = options;

    try {
      this.migrationInProgress = true;
      this.migrationStats = { total: 0, successful: 0, failed: 0, inProgress: 0 };

      // Check Cloudinary health
      const healthCheck = await imageErrorHandler.checkCloudinaryHealth(cloudinaryService);
      if (!healthCheck.healthy) {
        throw new Error(`Cloudinary is not healthy: ${healthCheck.reason}`);
      }

      // Scan for fallback images
      const fallbackImages = await this.scanFallbackImages();
      this.migrationStats.total = fallbackImages.length;

      if (fallbackImages.length === 0) {
        console.log('No fallback images found for migration');
        return {
          success: true,
          message: 'No images to migrate',
          stats: this.migrationStats
        };
      }

      console.log(`Starting migration of ${fallbackImages.length} images (dry run: ${dryRun})`);

      const results = [];
      
      // Process images in batches
      for (let i = 0; i < fallbackImages.length; i += batchSize) {
        const batch = fallbackImages.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(fallbackImages.length / batchSize)}`);

        const batchPromises = batch.map(async (imageInfo) => {
          this.migrationStats.inProgress++;
          
          try {
            if (dryRun) {
              console.log(`[DRY RUN] Would migrate: ${imageInfo.filename}`);
              return {
                success: true,
                filename: imageInfo.filename,
                dryRun: true
              };
            }

            const result = await this.migrateSingleImage(imageInfo);
            
            if (result.success) {
              this.migrationStats.successful++;
              
              // Delete original fallback file if requested
              if (deleteAfterMigration) {
                try {
                  await fs.unlink(imageInfo.filePath);
                  console.log(`Deleted fallback file: ${imageInfo.filename}`);
                } catch (deleteError) {
                  console.error(`Failed to delete fallback file ${imageInfo.filename}:`, deleteError);
                }
              }
            } else {
              this.migrationStats.failed++;
            }
            
            return result;
          } catch (error) {
            this.migrationStats.failed++;
            return {
              success: false,
              filename: imageInfo.filename,
              error: error.message
            };
          } finally {
            this.migrationStats.inProgress--;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Delay between batches to avoid overwhelming Cloudinary
        if (i + batchSize < fallbackImages.length && delayBetweenBatches > 0) {
          console.log(`Waiting ${delayBetweenBatches}ms before next batch...`);
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }

      const summary = {
        success: true,
        message: `Migration completed: ${this.migrationStats.successful} successful, ${this.migrationStats.failed} failed`,
        stats: this.migrationStats,
        results: results,
        dryRun
      };

      console.log('Migration summary:', summary.message);
      return summary;

    } catch (error) {
      console.error('Migration failed:', error);
      return {
        success: false,
        message: `Migration failed: ${error.message}`,
        stats: this.migrationStats,
        error: error.message
      };
    } finally {
      this.migrationInProgress = false;
    }
  }

  /**
   * Get migration status
   * @returns {Object} Current migration status
   */
  getMigrationStatus() {
    return {
      inProgress: this.migrationInProgress,
      stats: this.migrationStats,
      queueLength: this.migrationQueue.length
    };
  }

  /**
   * Schedule automatic migration when Cloudinary becomes available
   */
  async scheduleAutoMigration() {
    const checkInterval = 5 * 60 * 1000; // 5 minutes
    
    const checkAndMigrate = async () => {
      try {
        if (this.migrationInProgress) {
          return;
        }

        const healthCheck = await imageErrorHandler.checkCloudinaryHealth(cloudinaryService);
        if (healthCheck.healthy) {
          const fallbackImages = await this.scanFallbackImages();
          
          if (fallbackImages.length > 0) {
            console.log(`Cloudinary is healthy, starting automatic migration of ${fallbackImages.length} images`);
            await this.migrateAllFallbackImages({
              batchSize: 3,
              delayBetweenBatches: 3000,
              deleteAfterMigration: true
            });
          }
        }
      } catch (error) {
        console.error('Auto-migration check failed:', error);
      }
    };

    // Initial check
    setTimeout(checkAndMigrate, 30000); // Wait 30 seconds after startup
    
    // Periodic checks
    setInterval(checkAndMigrate, checkInterval);
    
    console.log('Automatic fallback migration scheduled');
  }

  /**
   * Clean up old fallback files that have been successfully migrated
   * @param {number} olderThanDays - Delete files older than this many days
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupMigratedFallbacks(olderThanDays = 7) {
    try {
      const fallbackImages = await this.scanFallbackImages();
      const cutoffDate = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
      
      let deletedCount = 0;
      const errors = [];

      for (const imageInfo of fallbackImages) {
        // Check if image is old enough and has been migrated
        if (imageInfo.createdAt < cutoffDate) {
          // Check if all posts using this image have been updated to Cloudinary URLs
          const stillUsingFallback = imageInfo.posts.length > 0;
          
          if (!stillUsingFallback) {
            try {
              await fs.unlink(imageInfo.filePath);
              deletedCount++;
              console.log(`Cleaned up old fallback file: ${imageInfo.filename}`);
            } catch (error) {
              errors.push({
                filename: imageInfo.filename,
                error: error.message
              });
            }
          }
        }
      }

      return {
        success: true,
        deletedCount,
        errors,
        message: `Cleaned up ${deletedCount} old fallback files`
      };

    } catch (error) {
      console.error('Cleanup failed:', error);
      return {
        success: false,
        error: error.message,
        deletedCount: 0
      };
    }
  }
}

// Create and export singleton instance
const fallbackMigrationService = new FallbackMigrationService();

export default fallbackMigrationService;