import fs from 'fs/promises';
import path from 'path';
import Post from '../models/Post.js';
import Community from '../models/Community.js';
import cloudinaryService from './cloudinaryService.js';

/**
 * Migration Service for migrating existing local images to Cloudinary
 * Handles batch uploads, database updates, and progress tracking
 */
class MigrationService {
  constructor() {
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    this.migrationLog = [];
    this.stats = {
      totalImages: 0,
      successful: 0,
      failed: 0,
      skipped: 0
    };
  }

  /**
   * Scan local uploads directory for existing image files (including subdirectories)
   * @returns {Promise<Array>} Array of image file objects with metadata
   */
  async scanLocalImages() {
    try {
      this.log('Starting scan of local images directory...');
      
      // Check if uploads directory exists
      try {
        await fs.access(this.uploadsDir);
      } catch (error) {
        this.log('Uploads directory not found', 'error');
        return [];
      }

      const imageFiles = [];
      await this.scanDirectory(this.uploadsDir, imageFiles);

      this.stats.totalImages = imageFiles.length;
      this.log(`Found ${imageFiles.length} image files to migrate`);
      
      return imageFiles;
    } catch (error) {
      this.log(`Error scanning local images: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Recursively scan directory for image files
   * @param {string} dirPath - Directory path to scan
   * @param {Array} imageFiles - Array to collect image files
   */
  async scanDirectory(dirPath, imageFiles) {
    const files = await fs.readdir(dirPath);
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = await fs.stat(filePath);
      
      if (stats.isDirectory()) {
        // Recursively scan subdirectories
        this.log(`Scanning subdirectory: ${file}`);
        await this.scanDirectory(filePath, imageFiles);
        continue;
      }
      
      // Check if it's an image file
      const ext = path.extname(file).toLowerCase();
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      
      if (!imageExtensions.includes(ext)) {
        this.log(`Skipping non-image file: ${file}`, 'warn');
        continue;
      }

      // Get relative path from uploads directory
      const relativePath = path.relative(this.uploadsDir, filePath);

      imageFiles.push({
        filename: file,
        filepath: filePath,
        relativePath: relativePath,
        size: stats.size,
        extension: ext,
        lastModified: stats.mtime
      });
    }
  }

  /**
   * Upload images to Cloudinary in batches
   * @param {Array} imageFiles - Array of image file objects
   * @param {Object} options - Upload options
   * @returns {Promise<Array>} Array of upload results
   */
  async uploadToCloudinary(imageFiles, options = {}) {
    const { batchSize = 5, retryAttempts = 3 } = options;
    const uploadResults = [];

    this.log(`Starting batch upload of ${imageFiles.length} images to Cloudinary...`);
    
    // Ensure Cloudinary is configured
    if (!cloudinaryService.isReady()) {
      cloudinaryService.configure();
    }

    // Process images in batches to avoid overwhelming the API
    for (let i = 0; i < imageFiles.length; i += batchSize) {
      const batch = imageFiles.slice(i, i + batchSize);
      this.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(imageFiles.length / batchSize)}`);
      
      const batchPromises = batch.map(async (imageFile) => {
        return this.uploadSingleImage(imageFile, retryAttempts);
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          uploadResults.push(result.value);
          if (result.value.success) {
            this.stats.successful++;
          } else {
            this.stats.failed++;
          }
        } else {
          this.stats.failed++;
          this.log(`Batch upload failed: ${result.reason}`, 'error');
        }
      }

      // Add small delay between batches to be respectful to the API
      if (i + batchSize < imageFiles.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    this.log(`Upload completed. Success: ${this.stats.successful}, Failed: ${this.stats.failed}`);
    return uploadResults;
  }

  /**
   * Upload a single image with retry logic
   * @param {Object} imageFile - Image file object
   * @param {number} retryAttempts - Number of retry attempts
   * @returns {Promise<Object>} Upload result
   */
  async uploadSingleImage(imageFile, retryAttempts = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        this.log(`Uploading ${imageFile.filename} (attempt ${attempt}/${retryAttempts})`);
        
        const uploadResult = await cloudinaryService.uploadImage(imageFile.filepath, {
          public_id: `migrated/${path.parse(imageFile.filename).name}`,
          folder: 'gp-connect-posts'
        });

        this.log(`Successfully uploaded ${imageFile.filename} to ${uploadResult.url}`);
        
        return {
          success: true,
          originalFile: imageFile,
          cloudinaryResult: uploadResult,
          localPath: imageFile.filename,
          cloudinaryUrl: uploadResult.url,
          publicId: uploadResult.publicId
        };
      } catch (error) {
        lastError = error;
        this.log(`Upload attempt ${attempt} failed for ${imageFile.filename}: ${error.message}`, 'error');
        
        if (attempt < retryAttempts) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    this.log(`Failed to upload ${imageFile.filename} after ${retryAttempts} attempts`, 'error');
    return {
      success: false,
      originalFile: imageFile,
      error: lastError.message,
      localPath: imageFile.filename
    };
  }

  /**
   * Update database references to point to Cloudinary URLs
   * @param {Array} uploadResults - Results from Cloudinary uploads
   * @returns {Promise<Object>} Update statistics
   */
  async updateDatabaseReferences(uploadResults) {
    this.log('Starting database reference updates...');
    
    const updateStats = {
      postsUpdated: 0,
      postsNotFound: 0,
      communityMessagesUpdated: 0,
      communityMessagesNotFound: 0,
      updateErrors: 0
    };

    const successfulUploads = uploadResults.filter(result => result.success);
    
    for (const uploadResult of successfulUploads) {
      try {
        const localImagePath = uploadResult.localPath;
        const relativePath = uploadResult.originalFile.relativePath || localImagePath;
        
        // Update Posts
        const posts = await Post.find({
          $or: [
            { image: localImagePath },
            { image: relativePath },
            { image: `uploads/${localImagePath}` },
            { image: `/uploads/${localImagePath}` },
            { image: `uploads/${relativePath}` },
            { image: `/uploads/${relativePath}` }
          ]
        });

        if (posts.length === 0) {
          this.log(`No posts found referencing image: ${localImagePath}`, 'warn');
          updateStats.postsNotFound++;
        } else {
          // Update all posts that reference this image
          for (const post of posts) {
            const oldImagePath = post.image;
            post.image = uploadResult.cloudinaryUrl;
            await post.save();
            
            this.log(`Updated post ${post._id}: ${oldImagePath} -> ${uploadResult.cloudinaryUrl}`);
            updateStats.postsUpdated++;
          }
        }

        // Update Community Messages
        const communities = await Community.find({
          'messages.image': { $in: [
            localImagePath,
            relativePath,
            `uploads/${localImagePath}`,
            `/uploads/${localImagePath}`,
            `uploads/${relativePath}`,
            `/uploads/${relativePath}`
          ]}
        });

        if (communities.length === 0) {
          this.log(`No community messages found referencing image: ${localImagePath}`, 'warn');
          updateStats.communityMessagesNotFound++;
        } else {
          for (const community of communities) {
            let communityUpdated = false;
            
            for (const message of community.messages) {
              if (message.image && (
                message.image === localImagePath ||
                message.image === relativePath ||
                message.image === `uploads/${localImagePath}` ||
                message.image === `/uploads/${localImagePath}` ||
                message.image === `uploads/${relativePath}` ||
                message.image === `/uploads/${relativePath}`
              )) {
                const oldImagePath = message.image;
                message.image = uploadResult.cloudinaryUrl;
                communityUpdated = true;
                
                this.log(`Updated community message ${message._id} in ${community.name}: ${oldImagePath} -> ${uploadResult.cloudinaryUrl}`);
                updateStats.communityMessagesUpdated++;
              }
            }
            
            if (communityUpdated) {
              await community.save();
            }
          }
        }
        
      } catch (error) {
        this.log(`Error updating database references for ${uploadResult.localPath}: ${error.message}`, 'error');
        updateStats.updateErrors++;
      }
    }

    this.log(`Database update completed. Posts updated: ${updateStats.postsUpdated}, Community messages updated: ${updateStats.communityMessagesUpdated}, Not found: ${updateStats.postsNotFound + updateStats.communityMessagesNotFound}, Errors: ${updateStats.updateErrors}`);
    return updateStats;
  }

  /**
   * Migrate all local images to Cloudinary
   * @param {Object} options - Migration options
   * @returns {Promise<Object>} Complete migration results
   */
  async migrateAllImages(options = {}) {
    const startTime = Date.now();
    this.log('=== Starting complete image migration ===');
    
    try {
      // Reset stats
      this.stats = {
        totalImages: 0,
        successful: 0,
        failed: 0,
        skipped: 0
      };

      // Step 1: Scan local images
      const imageFiles = await this.scanLocalImages();
      
      if (imageFiles.length === 0) {
        this.log('No images found to migrate');
        return {
          success: true,
          stats: this.stats,
          uploadResults: [],
          updateStats: { postsUpdated: 0, postsNotFound: 0, updateErrors: 0 },
          duration: Date.now() - startTime
        };
      }

      // Step 2: Upload to Cloudinary
      const uploadResults = await this.uploadToCloudinary(imageFiles, options);
      
      // Step 3: Update database references
      const updateStats = await this.updateDatabaseReferences(uploadResults);
      
      const duration = Date.now() - startTime;
      this.log(`=== Migration completed in ${Math.round(duration / 1000)}s ===`);
      
      return {
        success: true,
        stats: this.stats,
        uploadResults,
        updateStats,
        duration,
        migrationLog: this.migrationLog
      };
      
    } catch (error) {
      this.log(`Migration failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Get migration progress and statistics
   * @returns {Object} Current migration statistics
   */
  getProgress() {
    const progress = this.stats.totalImages > 0 
      ? Math.round(((this.stats.successful + this.stats.failed) / this.stats.totalImages) * 100)
      : 0;
      
    return {
      ...this.stats,
      progress: `${progress}%`,
      isComplete: (this.stats.successful + this.stats.failed) >= this.stats.totalImages
    };
  }

  /**
   * Log migration events with timestamps
   * @param {string} message - Log message
   * @param {string} level - Log level (info, warn, error)
   */
  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message
    };
    
    this.migrationLog.push(logEntry);
    
    // Also log to console with appropriate level
    const consoleMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    switch (level) {
      case 'error':
        console.error(consoleMessage);
        break;
      case 'warn':
        console.warn(consoleMessage);
        break;
      default:
        console.log(consoleMessage);
    }
  }

  /**
   * Get detailed migration log
   * @returns {Array} Array of log entries
   */
  getMigrationLog() {
    return this.migrationLog;
  }

  /**
   * Clear migration log and reset stats
   */
  reset() {
    this.migrationLog = [];
    this.stats = {
      totalImages: 0,
      successful: 0,
      failed: 0,
      skipped: 0
    };
  }
}

// Create and export singleton instance
const migrationService = new MigrationService();

export default migrationService;
export { MigrationService };