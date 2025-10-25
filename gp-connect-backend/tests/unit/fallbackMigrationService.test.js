/**
 * Fallback Migration Service Tests
 * Tests for migration of fallback images to Cloudinary
 * 
 * Requirements: 2.4, 3.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import fallbackMigrationService, { FallbackMigrationService } from '../../services/fallbackMigrationService.js';

// Mock dependencies
vi.mock('../models/Post.js', () => ({
  default: {
    find: vi.fn(),
    findByIdAndUpdate: vi.fn()
  }
}));

vi.mock('../services/cloudinaryService.js', () => ({
  default: {
    uploadImageDirect: vi.fn(),
    getHealthStatus: vi.fn()
  }
}));

vi.mock('../services/imageErrorHandler.js', () => ({
  default: {
    checkCloudinaryHealth: vi.fn()
  }
}));

import Post from '../../models/Post.js';
import cloudinaryService from '../../services/cloudinaryService.js';
import imageErrorHandler from '../../services/imageErrorHandler.js';

describe('FallbackMigrationService', () => {
  let service;
  let mockPost;
  let mockCloudinaryService;
  let mockImageErrorHandler;

  beforeEach(() => {
    service = new FallbackMigrationService();
    
    // Reset mocks
    vi.clearAllMocks();
    
    // Setup mock implementations
    mockPost = Post;
    mockCloudinaryService = cloudinaryService;
    mockImageErrorHandler = imageErrorHandler;

    // Default mock implementations
    mockImageErrorHandler.checkCloudinaryHealth.mockResolvedValue({
      healthy: true,
      reason: 'Service healthy'
    });

    mockCloudinaryService.uploadImageDirect.mockResolvedValue({
      url: 'https://cloudinary.com/migrated/image.jpg',
      publicId: 'migrated_123_image'
    });

    mockPost.find.mockResolvedValue([]);
    mockPost.findByIdAndUpdate.mockResolvedValue({});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Scanning Fallback Images', () => {
    it('should return empty array when no fallback directory exists', async () => {
      const mockAccess = vi.spyOn(fs, 'access').mockRejectedValue(new Error('ENOENT'));

      const result = await service.scanFallbackImages();

      expect(result).toEqual([]);
      expect(mockAccess).toHaveBeenCalled();

      mockAccess.mockRestore();
    });

    it('should scan and return fallback images with metadata', async () => {
      const mockAccess = vi.spyOn(fs, 'access').mockResolvedValue();
      const mockReaddir = vi.spyOn(fs, 'readdir').mockResolvedValue([
        'fallback_123_image1.jpg',
        'fallback_456_image2.png',
        'not_an_image.txt'
      ]);
      const mockStat = vi.spyOn(fs, 'stat').mockResolvedValue({
        size: 1024,
        birthtime: new Date('2023-01-01')
      });

      mockPost.find.mockResolvedValue([
        { _id: 'post1', title: 'Test Post', userId: 'user1' }
      ]);

      const result = await service.scanFallbackImages();

      expect(result).toHaveLength(2); // Only image files
      expect(result[0].filename).toBe('fallback_123_image1.jpg');
      expect(result[0].size).toBe(1024);
      expect(result[0].posts).toHaveLength(1);
      expect(result[0].posts[0].id).toBe('post1');

      mockAccess.mockRestore();
      mockReaddir.mockRestore();
      mockStat.mockRestore();
    });

    it('should handle scanning errors gracefully', async () => {
      const mockAccess = vi.spyOn(fs, 'access').mockResolvedValue();
      const mockReaddir = vi.spyOn(fs, 'readdir').mockRejectedValue(new Error('Permission denied'));

      await expect(service.scanFallbackImages()).rejects.toThrow('Failed to scan fallback images');

      mockAccess.mockRestore();
      mockReaddir.mockRestore();
    });
  });

  describe('Single Image Migration', () => {
    it('should successfully migrate a single image', async () => {
      const imageInfo = {
        filename: 'fallback_123_test.jpg',
        filePath: '/path/to/fallback_123_test.jpg',
        fallbackUrl: 'http://localhost:5000/uploads/fallback/fallback_123_test.jpg',
        posts: [
          { id: 'post1', title: 'Test Post', userId: 'user1' }
        ]
      };

      mockPost.findByIdAndUpdate.mockResolvedValue({
        _id: 'post1',
        image: 'https://cloudinary.com/migrated/image.jpg'
      });

      const result = await service.migrateSingleImage(imageInfo);

      expect(result.success).toBe(true);
      expect(result.filename).toBe('fallback_123_test.jpg');
      expect(result.cloudinaryUrl).toBe('https://cloudinary.com/migrated/image.jpg');
      expect(result.postsUpdated).toBe(1);
      expect(result.postsFailed).toBe(0);

      expect(mockCloudinaryService.uploadImageDirect).toHaveBeenCalledWith(
        '/path/to/fallback_123_test.jpg',
        expect.objectContaining({
          folder: 'gp-connect-posts/migrated'
        })
      );

      expect(mockPost.findByIdAndUpdate).toHaveBeenCalledWith(
        'post1',
        expect.objectContaining({
          image: 'https://cloudinary.com/migrated/image.jpg'
        }),
        { new: true }
      );
    });

    it('should handle Cloudinary upload failure', async () => {
      const imageInfo = {
        filename: 'fallback_123_test.jpg',
        filePath: '/path/to/fallback_123_test.jpg',
        posts: []
      };

      mockCloudinaryService.uploadImageDirect.mockRejectedValue(new Error('Upload failed'));

      const result = await service.migrateSingleImage(imageInfo);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Upload failed');
      expect(result.postsUpdated).toBe(0);
    });

    it('should handle database update failures', async () => {
      const imageInfo = {
        filename: 'fallback_123_test.jpg',
        filePath: '/path/to/fallback_123_test.jpg',
        posts: [
          { id: 'post1', title: 'Test Post', userId: 'user1' }
        ]
      };

      mockPost.findByIdAndUpdate.mockRejectedValue(new Error('Database error'));

      const result = await service.migrateSingleImage(imageInfo);

      expect(result.success).toBe(true); // Upload succeeded
      expect(result.postsUpdated).toBe(0);
      expect(result.postsFailed).toBe(1);
      expect(result.updateResults[0].success).toBe(false);
      expect(result.updateResults[0].error).toBe('Database error');
    });
  });

  describe('Batch Migration', () => {
    it('should migrate all fallback images successfully', async () => {
      // Mock scanning
      const mockScanFallbackImages = vi.spyOn(service, 'scanFallbackImages')
        .mockResolvedValue([
          {
            filename: 'image1.jpg',
            filePath: '/path/to/image1.jpg',
            posts: [{ id: 'post1', title: 'Post 1', userId: 'user1' }]
          },
          {
            filename: 'image2.jpg',
            filePath: '/path/to/image2.jpg',
            posts: [{ id: 'post2', title: 'Post 2', userId: 'user2' }]
          }
        ]);

      // Mock single migration
      const mockMigrateSingleImage = vi.spyOn(service, 'migrateSingleImage')
        .mockResolvedValue({
          success: true,
          filename: 'test.jpg',
          postsUpdated: 1,
          postsFailed: 0
        });

      const result = await service.migrateAllFallbackImages({
        batchSize: 2,
        delayBetweenBatches: 0,
        deleteAfterMigration: false,
        dryRun: false
      });

      expect(result.success).toBe(true);
      expect(result.stats.total).toBe(2);
      expect(result.stats.successful).toBe(2);
      expect(result.stats.failed).toBe(0);
      expect(mockMigrateSingleImage).toHaveBeenCalledTimes(2);

      mockScanFallbackImages.mockRestore();
      mockMigrateSingleImage.mockRestore();
    });

    it('should handle dry run mode', async () => {
      const mockScanFallbackImages = vi.spyOn(service, 'scanFallbackImages')
        .mockResolvedValue([
          { filename: 'image1.jpg', filePath: '/path/to/image1.jpg', posts: [] }
        ]);

      const result = await service.migrateAllFallbackImages({
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.results[0].dryRun).toBe(true);
      expect(mockCloudinaryService.uploadImageDirect).not.toHaveBeenCalled();

      mockScanFallbackImages.mockRestore();
    });

    it('should handle migration already in progress', async () => {
      service.migrationInProgress = true;

      await expect(service.migrateAllFallbackImages()).rejects.toThrow('Migration already in progress');
    });

    it('should handle Cloudinary unhealthy state', async () => {
      mockImageErrorHandler.checkCloudinaryHealth.mockResolvedValue({
        healthy: false,
        reason: 'Service unavailable'
      });

      await expect(service.migrateAllFallbackImages()).rejects.toThrow('Cloudinary is not healthy');
    });

    it('should process images in batches with delays', async () => {
      const mockScanFallbackImages = vi.spyOn(service, 'scanFallbackImages')
        .mockResolvedValue([
          { filename: 'image1.jpg', posts: [] },
          { filename: 'image2.jpg', posts: [] },
          { filename: 'image3.jpg', posts: [] }
        ]);

      const mockMigrateSingleImage = vi.spyOn(service, 'migrateSingleImage')
        .mockResolvedValue({ success: true, postsUpdated: 0, postsFailed: 0 });

      const startTime = Date.now();
      await service.migrateAllFallbackImages({
        batchSize: 2,
        delayBetweenBatches: 100
      });
      const endTime = Date.now();

      // Should have waited for at least one delay between batches
      expect(endTime - startTime).toBeGreaterThan(90);
      expect(mockMigrateSingleImage).toHaveBeenCalledTimes(3);

      mockScanFallbackImages.mockRestore();
      mockMigrateSingleImage.mockRestore();
    });

    it('should delete files after successful migration when requested', async () => {
      const mockUnlink = vi.spyOn(fs, 'unlink').mockResolvedValue();
      const mockScanFallbackImages = vi.spyOn(service, 'scanFallbackImages')
        .mockResolvedValue([
          { filename: 'image1.jpg', filePath: '/path/to/image1.jpg', posts: [] }
        ]);

      const mockMigrateSingleImage = vi.spyOn(service, 'migrateSingleImage')
        .mockResolvedValue({ success: true, postsUpdated: 0, postsFailed: 0 });

      await service.migrateAllFallbackImages({
        deleteAfterMigration: true
      });

      expect(mockUnlink).toHaveBeenCalledWith('/path/to/image1.jpg');

      mockUnlink.mockRestore();
      mockScanFallbackImages.mockRestore();
      mockMigrateSingleImage.mockRestore();
    });
  });

  describe('Migration Status', () => {
    it('should return current migration status', () => {
      service.migrationInProgress = true;
      service.migrationStats = { total: 10, successful: 5, failed: 1, inProgress: 4 };

      const status = service.getMigrationStatus();

      expect(status.inProgress).toBe(true);
      expect(status.stats.total).toBe(10);
      expect(status.stats.successful).toBe(5);
      expect(status.stats.failed).toBe(1);
      expect(status.stats.inProgress).toBe(4);
    });
  });

  describe('Cleanup', () => {
    it('should clean up old migrated fallback files', async () => {
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const mockUnlink = vi.spyOn(fs, 'unlink').mockResolvedValue();
      
      const mockScanFallbackImages = vi.spyOn(service, 'scanFallbackImages')
        .mockResolvedValue([
          {
            filename: 'old_image.jpg',
            filePath: '/path/to/old_image.jpg',
            createdAt: oldDate,
            posts: [] // No posts using this image
          },
          {
            filename: 'recent_image.jpg',
            filePath: '/path/to/recent_image.jpg',
            createdAt: new Date(), // Recent
            posts: []
          }
        ]);

      const result = await service.cleanupMigratedFallbacks(7);

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(1);
      expect(mockUnlink).toHaveBeenCalledWith('/path/to/old_image.jpg');
      expect(mockUnlink).not.toHaveBeenCalledWith('/path/to/recent_image.jpg');

      mockUnlink.mockRestore();
      mockScanFallbackImages.mockRestore();
    });

    it('should not delete files still in use', async () => {
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const mockUnlink = vi.spyOn(fs, 'unlink').mockResolvedValue();
      
      const mockScanFallbackImages = vi.spyOn(service, 'scanFallbackImages')
        .mockResolvedValue([
          {
            filename: 'old_but_used.jpg',
            filePath: '/path/to/old_but_used.jpg',
            createdAt: oldDate,
            posts: [{ id: 'post1' }] // Still in use
          }
        ]);

      const result = await service.cleanupMigratedFallbacks(7);

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(0);
      expect(mockUnlink).not.toHaveBeenCalled();

      mockUnlink.mockRestore();
      mockScanFallbackImages.mockRestore();
    });

    it('should handle cleanup errors gracefully', async () => {
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const mockUnlink = vi.spyOn(fs, 'unlink').mockRejectedValue(new Error('Permission denied'));
      
      const mockScanFallbackImages = vi.spyOn(service, 'scanFallbackImages')
        .mockResolvedValue([
          {
            filename: 'old_image.jpg',
            filePath: '/path/to/old_image.jpg',
            createdAt: oldDate,
            posts: []
          }
        ]);

      const result = await service.cleanupMigratedFallbacks(7);

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].filename).toBe('old_image.jpg');
      expect(result.errors[0].error).toBe('Permission denied');

      mockUnlink.mockRestore();
      mockScanFallbackImages.mockRestore();
    });
  });

  describe('Auto Migration Scheduling', () => {
    it('should schedule automatic migration', async () => {
      const mockSetTimeout = vi.spyOn(global, 'setTimeout').mockImplementation((fn) => fn());
      const mockSetInterval = vi.spyOn(global, 'setInterval').mockImplementation(() => 123);

      const mockScanFallbackImages = vi.spyOn(service, 'scanFallbackImages')
        .mockResolvedValue([]);

      await service.scheduleAutoMigration();

      expect(mockSetTimeout).toHaveBeenCalled();
      expect(mockSetInterval).toHaveBeenCalled();

      mockSetTimeout.mockRestore();
      mockSetInterval.mockRestore();
      mockScanFallbackImages.mockRestore();
    });
  });
});

describe('Singleton Instance', () => {
  it('should export a singleton instance', () => {
    expect(fallbackMigrationService).toBeInstanceOf(FallbackMigrationService);
    expect(fallbackMigrationService.fallbackPath).toBeDefined();
  });

  it('should maintain state across imports', () => {
    fallbackMigrationService.migrationInProgress = true;
    expect(fallbackMigrationService.migrationInProgress).toBe(true);
  });
});