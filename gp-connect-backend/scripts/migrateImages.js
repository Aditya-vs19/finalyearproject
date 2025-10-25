#!/usr/bin/env node

import { program } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import migrationService from '../services/migrationService.js';
import cloudinaryService from '../services/cloudinaryService.js';
import Post from '../models/Post.js';

// Load environment variables
dotenv.config();

/**
 * Migration Script for Local Images to Cloudinary
 * 
 * This script provides a command-line interface for migrating existing local images
 * to Cloudinary cloud storage with validation and rollback capabilities.
 */

class MigrationScript {
  constructor() {
    this.backupFile = path.join(process.cwd(), 'migration-backup.json');
    this.logFile = path.join(process.cwd(), 'migration-log.json');
  }

  /**
   * Connect to MongoDB database
   */
  async connectDatabase() {
    try {
      if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI environment variable is required');
      }

      await mongoose.connect(process.env.MONGODB_URI);
      console.log('✅ Connected to MongoDB');
    } catch (error) {
      console.error('❌ Failed to connect to MongoDB:', error.message);
      process.exit(1);
    }
  }

  /**
   * Disconnect from MongoDB database
   */
  async disconnectDatabase() {
    try {
      await mongoose.disconnect();
      console.log('✅ Disconnected from MongoDB');
    } catch (error) {
      console.error('⚠️  Error disconnecting from MongoDB:', error.message);
    }
  }

  /**
   * Validate environment and prerequisites
   */
  async validateEnvironment() {
    console.log('🔍 Validating environment...');

    // Check required environment variables
    const requiredEnvVars = [
      'MONGODB_URI',
      'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      console.error('❌ Missing required environment variables:', missingVars.join(', '));
      return false;
    }

    // Test Cloudinary connection
    try {
      cloudinaryService.configure();
      const isConnected = await cloudinaryService.testConnection();
      if (!isConnected) {
        console.error('❌ Failed to connect to Cloudinary');
        return false;
      }
      console.log('✅ Cloudinary connection verified');
    } catch (error) {
      console.error('❌ Cloudinary configuration error:', error.message);
      return false;
    }

    // Check uploads directory
    const uploadsDir = path.join(process.cwd(), 'uploads');
    try {
      await fs.access(uploadsDir);
      console.log('✅ Uploads directory found');
    } catch (error) {
      console.log('⚠️  No uploads directory found - migration may not be needed');
    }

    return true;
  }

  /**
   * Create backup of current database state
   */
  async createBackup() {
    console.log('💾 Creating database backup...');

    try {
      // Get all posts with images
      const postsWithImages = await Post.find({ 
        image: { $exists: true, $ne: null, $ne: '' } 
      }).select('_id image').lean();

      const backup = {
        timestamp: new Date().toISOString(),
        totalPosts: postsWithImages.length,
        posts: postsWithImages
      };

      await fs.writeFile(this.backupFile, JSON.stringify(backup, null, 2));
      console.log(`✅ Backup created: ${this.backupFile} (${postsWithImages.length} posts)`);
      
      return backup;
    } catch (error) {
      console.error('❌ Failed to create backup:', error.message);
      throw error;
    }
  }

  /**
   * Perform the migration
   */
  async performMigration(options = {}) {
    console.log('🚀 Starting image migration...');

    try {
      const migrationResult = await migrationService.migrateAllImages({
        batchSize: options.batchSize || 5,
        retryAttempts: options.retryAttempts || 3
      });

      // Save migration log
      await this.saveMigrationLog(migrationResult);

      return migrationResult;
    } catch (error) {
      console.error('❌ Migration failed:', error.message);
      throw error;
    }
  }

  /**
   * Save migration log to file
   */
  async saveMigrationLog(migrationResult) {
    try {
      const logData = {
        timestamp: new Date().toISOString(),
        ...migrationResult
      };

      await fs.writeFile(this.logFile, JSON.stringify(logData, null, 2));
      console.log(`📝 Migration log saved: ${this.logFile}`);
    } catch (error) {
      console.error('⚠️  Failed to save migration log:', error.message);
    }
  }

  /**
   * Validate migration results
   */
  async validateMigration(migrationResult) {
    console.log('🔍 Validating migration results...');

    const validation = {
      success: true,
      issues: [],
      stats: {
        totalProcessed: 0,
        successfulUploads: 0,
        failedUploads: 0,
        postsUpdated: 0,
        cloudinaryUrlsFound: 0,
        brokenLinks: 0
      }
    };

    try {
      // Validate upload results
      const { uploadResults, updateStats } = migrationResult;
      
      validation.stats.totalProcessed = uploadResults.length;
      validation.stats.successfulUploads = uploadResults.filter(r => r.success).length;
      validation.stats.failedUploads = uploadResults.filter(r => !r.success).length;
      validation.stats.postsUpdated = updateStats.postsUpdated;

      // Check for failed uploads
      const failedUploads = uploadResults.filter(r => !r.success);
      if (failedUploads.length > 0) {
        validation.issues.push(`${failedUploads.length} images failed to upload to Cloudinary`);
        failedUploads.forEach(failed => {
          validation.issues.push(`  - ${failed.localPath}: ${failed.error}`);
        });
      }

      // Validate database updates
      if (updateStats.updateErrors > 0) {
        validation.issues.push(`${updateStats.updateErrors} database update errors occurred`);
      }

      if (updateStats.postsNotFound > 0) {
        validation.issues.push(`${updateStats.postsNotFound} images had no corresponding posts in database`);
      }

      // Check posts with Cloudinary URLs
      const postsWithCloudinaryUrls = await Post.countDocuments({
        image: { $regex: /cloudinary\.com/ }
      });
      validation.stats.cloudinaryUrlsFound = postsWithCloudinaryUrls;

      // Sample check for broken links (check first 10 Cloudinary URLs)
      const samplePosts = await Post.find({
        image: { $regex: /cloudinary\.com/ }
      }).limit(10).select('image');

      let brokenLinks = 0;
      for (const post of samplePosts) {
        try {
          const response = await fetch(post.image, { method: 'HEAD' });
          if (!response.ok) {
            brokenLinks++;
          }
        } catch (error) {
          brokenLinks++;
        }
      }
      validation.stats.brokenLinks = brokenLinks;

      if (brokenLinks > 0) {
        validation.issues.push(`${brokenLinks} out of ${samplePosts.length} sampled images appear to be broken`);
      }

      // Overall success determination
      validation.success = validation.issues.length === 0 || 
        (validation.stats.successfulUploads > 0 && validation.stats.brokenLinks === 0);

      return validation;
    } catch (error) {
      console.error('❌ Validation failed:', error.message);
      validation.success = false;
      validation.issues.push(`Validation error: ${error.message}`);
      return validation;
    }
  }

  /**
   * Rollback migration using backup
   */
  async rollbackMigration() {
    console.log('🔄 Rolling back migration...');

    try {
      // Check if backup exists
      try {
        await fs.access(this.backupFile);
      } catch (error) {
        throw new Error(`Backup file not found: ${this.backupFile}`);
      }

      // Load backup
      const backupData = JSON.parse(await fs.readFile(this.backupFile, 'utf8'));
      console.log(`📂 Loading backup from ${backupData.timestamp} (${backupData.totalPosts} posts)`);

      let restored = 0;
      let errors = 0;

      // Restore each post's image field
      for (const postData of backupData.posts) {
        try {
          await Post.findByIdAndUpdate(postData._id, { image: postData.image });
          restored++;
        } catch (error) {
          console.error(`❌ Failed to restore post ${postData._id}:`, error.message);
          errors++;
        }
      }

      console.log(`✅ Rollback completed: ${restored} posts restored, ${errors} errors`);
      
      return { restored, errors };
    } catch (error) {
      console.error('❌ Rollback failed:', error.message);
      throw error;
    }
  }

  /**
   * Display migration status and statistics
   */
  async showStatus() {
    console.log('📊 Migration Status Report');
    console.log('========================');

    try {
      // Count posts with different image types
      const totalPosts = await Post.countDocuments({ 
        image: { $exists: true, $ne: null, $ne: '' } 
      });
      
      const cloudinaryPosts = await Post.countDocuments({
        image: { $regex: /cloudinary\.com/ }
      });
      
      const localPosts = await Post.countDocuments({
        image: { $exists: true, $ne: null, $ne: '', $not: /cloudinary\.com/ }
      });

      console.log(`Total posts with images: ${totalPosts}`);
      console.log(`Posts using Cloudinary: ${cloudinaryPosts}`);
      console.log(`Posts using local storage: ${localPosts}`);

      // Check for migration log
      try {
        await fs.access(this.logFile);
        const logData = JSON.parse(await fs.readFile(this.logFile, 'utf8'));
        console.log(`\nLast migration: ${logData.timestamp}`);
        console.log(`Migration success: ${logData.success ? '✅' : '❌'}`);
        if (logData.stats) {
          console.log(`Images processed: ${logData.stats.successful}/${logData.stats.totalImages}`);
        }
      } catch (error) {
        console.log('\nNo previous migration found');
      }

      // Check for backup
      try {
        await fs.access(this.backupFile);
        const backupData = JSON.parse(await fs.readFile(this.backupFile, 'utf8'));
        console.log(`\nBackup available: ${backupData.timestamp} (${backupData.totalPosts} posts)`);
      } catch (error) {
        console.log('\nNo backup file found');
      }

    } catch (error) {
      console.error('❌ Failed to get status:', error.message);
    }
  }
}

// CLI Command Definitions
const migrationScript = new MigrationScript();

program
  .name('migrate-images')
  .description('Migrate local images to Cloudinary cloud storage')
  .version('1.0.0');

program
  .command('validate')
  .description('Validate environment and prerequisites')
  .action(async () => {
    const isValid = await migrationScript.validateEnvironment();
    process.exit(isValid ? 0 : 1);
  });

program
  .command('status')
  .description('Show current migration status')
  .action(async () => {
    await migrationScript.connectDatabase();
    await migrationScript.showStatus();
    await migrationScript.disconnectDatabase();
  });

program
  .command('backup')
  .description('Create backup of current database state')
  .action(async () => {
    await migrationScript.connectDatabase();
    try {
      await migrationScript.createBackup();
      console.log('✅ Backup completed successfully');
    } catch (error) {
      console.error('❌ Backup failed:', error.message);
      process.exit(1);
    } finally {
      await migrationScript.disconnectDatabase();
    }
  });

program
  .command('migrate')
  .description('Perform the image migration')
  .option('-b, --batch-size <size>', 'Number of images to process in each batch', '5')
  .option('-r, --retry-attempts <attempts>', 'Number of retry attempts for failed uploads', '3')
  .option('--dry-run', 'Perform a dry run without making changes')
  .option('--skip-backup', 'Skip creating backup before migration')
  .action(async (options) => {
    console.log('🚀 Starting Image Migration Process');
    console.log('==================================');

    await migrationScript.connectDatabase();

    try {
      // Validate environment
      const isValid = await migrationScript.validateEnvironment();
      if (!isValid) {
        console.error('❌ Environment validation failed');
        process.exit(1);
      }

      // Create backup unless skipped
      if (!options.skipBackup) {
        await migrationScript.createBackup();
      }

      // Perform migration
      if (options.dryRun) {
        console.log('🔍 DRY RUN MODE - No changes will be made');
        const imageFiles = await migrationService.scanLocalImages();
        console.log(`Would migrate ${imageFiles.length} images`);
      } else {
        const migrationResult = await migrationScript.performMigration({
          batchSize: parseInt(options.batchSize),
          retryAttempts: parseInt(options.retryAttempts)
        });

        // Validate results
        const validation = await migrationScript.validateMigration(migrationResult);
        
        console.log('\n📊 Migration Results');
        console.log('===================');
        console.log(`Total images processed: ${validation.stats.totalProcessed}`);
        console.log(`Successful uploads: ${validation.stats.successfulUploads}`);
        console.log(`Failed uploads: ${validation.stats.failedUploads}`);
        console.log(`Posts updated: ${validation.stats.postsUpdated}`);
        console.log(`Cloudinary URLs found: ${validation.stats.cloudinaryUrlsFound}`);

        if (validation.issues.length > 0) {
          console.log('\n⚠️  Issues found:');
          validation.issues.forEach(issue => console.log(`  - ${issue}`));
        }

        console.log(`\nMigration ${validation.success ? '✅ SUCCESSFUL' : '❌ FAILED'}`);
        
        if (!validation.success) {
          console.log('\n💡 You can rollback using: npm run migrate:rollback');
          process.exit(1);
        }
      }

    } catch (error) {
      console.error('❌ Migration process failed:', error.message);
      console.log('\n💡 You can rollback using: npm run migrate:rollback');
      process.exit(1);
    } finally {
      await migrationScript.disconnectDatabase();
    }
  });

program
  .command('rollback')
  .description('Rollback migration using backup')
  .action(async () => {
    console.log('🔄 Starting Migration Rollback');
    console.log('==============================');

    await migrationScript.connectDatabase();

    try {
      const result = await migrationScript.rollbackMigration();
      console.log(`✅ Rollback completed: ${result.restored} posts restored`);
      
      if (result.errors > 0) {
        console.log(`⚠️  ${result.errors} errors occurred during rollback`);
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Rollback failed:', error.message);
      process.exit(1);
    } finally {
      await migrationScript.disconnectDatabase();
    }
  });

program
  .command('cleanup')
  .description('Clean up migration files and logs')
  .action(async () => {
    try {
      const filesToClean = [migrationScript.backupFile, migrationScript.logFile];
      
      for (const file of filesToClean) {
        try {
          await fs.unlink(file);
          console.log(`✅ Deleted: ${file}`);
        } catch (error) {
          if (error.code !== 'ENOENT') {
            console.log(`⚠️  Could not delete ${file}: ${error.message}`);
          }
        }
      }
      
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.error('❌ Cleanup failed:', error.message);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();