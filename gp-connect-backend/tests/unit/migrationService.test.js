import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('../../models/Post.js');
vi.mock('../../services/cloudinaryService.js');

import { MigrationService } from '../../services/migrationService.js';
import Post from '../../models/Post.js';
import cloudinaryService from '../../services/cloudinaryService.js';

describe('MigrationService', () => {
  let migrationService;

  beforeEach(() => {
    migrationService = new MigrationService();
    vi.clearAllMocks();
  });

  describe('scanLocalImages', () => {
    it('should scan and return image files from uploads directory', async () => {
      // Mock fs operations
      fs.access.mockResolvedValue();
      fs.readdir.mockResolvedValue(['image1.jpg', 'image2.png', 'document.txt', 'subfolder']);
      fs.stat
        .mockResolvedValueOnce({ isDirectory: () => false, size: 1024, mtime: new Date() })
        .mockResolvedValueOnce({ isDirectory: () => false, size: 2048, mtime: new Date() })
        .mockResolvedValueOnce({ isDirectory: () => false, size: 512, mtime: new Date() })
        .mockResolvedValueOnce({ isDirectory: () => true });

      const result = await migrationService.scanLocalImages();

      expect(result).toHaveLength(2);
      expect(result[0].filename).toBe('image1.jpg');
      expect(result[1].filename).toBe('image2.png');
      expect(migrationService.stats.totalImages).toBe(2);
    });

    it('should return empty array if uploads directory does not exist', async () => {
      fs.access.mockRejectedValue(new Error('Directory not found'));

      const result = await migrationService.scanLocalImages();

      expect(result).toEqual([]);
    });

    it('should skip non-image files', async () => {
      fs.access.mockResolvedValue();
      fs.readdir.mockResolvedValue(['image.jpg', 'document.pdf', 'video.mp4']);
      fs.stat
        .mockResolvedValueOnce({ isDirectory: () => false, size: 1024, mtime: new Date() })
        .mockResolvedValueOnce({ isDirectory: () => false, size: 2048, mtime: new Date() })
        .mockResolvedValueOnce({ isDirectory: () => false, size: 3072, mtime: new Date() });

      const result = await migrationService.scanLocalImages();

      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe('image.jpg');
    });
  });

  describe('uploadSingleImage', () => {
    const mockImageFile = {
      filename: 'test.jpg',
      filepath: '/uploads/test.jpg',
      size: 1024,
      extension: '.jpg'
    };

    it('should successfully upload image on first attempt', async () => {
      const mockUploadResult = {
        url: 'https://cloudinary.com/test.jpg',
        publicId: 'test_id',
        width: 800,
        height: 600
      };

      cloudinaryService.uploadImage.mockResolvedValue(mockUploadResult);

      const result = await migrationService.uploadSingleImage(mockImageFile);

      expect(result.success).toBe(true);
      expect(result.cloudinaryUrl).toBe(mockUploadResult.url);
      expect(result.publicId).toBe(mockUploadResult.publicId);
    });

    it('should retry on failure and eventually succeed', async () => {
      const mockUploadResult = {
        url: 'https://cloudinary.com/test.jpg',
        publicId: 'test_id'
      };

      cloudinaryService.uploadImage
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce(mockUploadResult);

      // Mock setTimeout to avoid actual delays in tests
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = vi.fn((fn) => fn());

      const result = await migrationService.uploadSingleImage(mockImageFile, 3);

      expect(result.success).toBe(true);
      expect(cloudinaryService.uploadImage).toHaveBeenCalledTimes(3);

      // Restore setTimeout
      global.setTimeout = originalSetTimeout;
    }, 10000);

    it('should fail after exhausting retry attempts', async () => {
      cloudinaryService.uploadImage.mockRejectedValue(new Error('Persistent error'));

      // Mock setTimeout to avoid actual delays in tests
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = vi.fn((fn) => fn());

      const result = await migrationService.uploadSingleImage(mockImageFile, 2);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Persistent error');
      expect(cloudinaryService.uploadImage).toHaveBeenCalledTimes(2);

      // Restore setTimeout
      global.setTimeout = originalSetTimeout;
    });
  });

  describe('uploadToCloudinary', () => {
    const mockImageFiles = [
      { filename: 'image1.jpg', filepath: '/uploads/image1.jpg' },
      { filename: 'image2.png', filepath: '/uploads/image2.png' }
    ];

    beforeEach(() => {
      cloudinaryService.isReady.mockReturnValue(true);
    });

    it('should upload all images successfully', async () => {
      const mockUploadResult = {
        url: 'https://cloudinary.com/image.jpg',
        publicId: 'test_id'
      };

      cloudinaryService.uploadImage.mockResolvedValue(mockUploadResult);

      const results = await migrationService.uploadToCloudinary(mockImageFiles);

      expect(results).toHaveLength(2);
      expect(migrationService.stats.successful).toBe(2);
      expect(migrationService.stats.failed).toBe(0);
    });

    it('should configure Cloudinary if not ready', async () => {
      cloudinaryService.isReady.mockReturnValue(false);
      cloudinaryService.configure.mockImplementation(() => {});
      cloudinaryService.uploadImage.mockResolvedValue({
        url: 'https://cloudinary.com/image.jpg',
        publicId: 'test_id'
      });

      await migrationService.uploadToCloudinary(mockImageFiles);

      expect(cloudinaryService.configure).toHaveBeenCalled();
    });
  });

  describe('updateDatabaseReferences', () => {
    const mockUploadResults = [
      {
        success: true,
        localPath: 'image1.jpg',
        cloudinaryUrl: 'https://cloudinary.com/image1.jpg'
      },
      {
        success: true,
        localPath: 'image2.png',
        cloudinaryUrl: 'https://cloudinary.com/image2.png'
      },
      {
        success: false,
        localPath: 'image3.gif',
        error: 'Upload failed'
      }
    ];

    it('should update posts with new Cloudinary URLs', async () => {
      const mockPost1 = { _id: 'post1', image: 'image1.jpg', save: vi.fn() };
      const mockPost2 = { _id: 'post2', image: 'uploads/image2.png', save: vi.fn() };

      Post.find
        .mockResolvedValueOnce([mockPost1])
        .mockResolvedValueOnce([mockPost2]);

      const result = await migrationService.updateDatabaseReferences(mockUploadResults);

      expect(mockPost1.image).toBe('https://cloudinary.com/image1.jpg');
      expect(mockPost2.image).toBe('https://cloudinary.com/image2.png');
      expect(mockPost1.save).toHaveBeenCalled();
      expect(mockPost2.save).toHaveBeenCalled();
      expect(result.postsUpdated).toBe(2);
    });

    it('should handle posts not found for images', async () => {
      Post.find.mockResolvedValue([]);

      const result = await migrationService.updateDatabaseReferences(mockUploadResults);

      expect(result.postsNotFound).toBe(2); // Only successful uploads are processed
      expect(result.postsUpdated).toBe(0);
    });

    it('should handle database update errors', async () => {
      const mockPost = { 
        _id: 'post1', 
        image: 'image1.jpg', 
        save: vi.fn().mockRejectedValue(new Error('Database error'))
      };

      Post.find.mockResolvedValue([mockPost]);

      const result = await migrationService.updateDatabaseReferences(mockUploadResults.slice(0, 1));

      expect(result.updateErrors).toBe(1);
    });

    it('should skip failed uploads', async () => {
      const result = await migrationService.updateDatabaseReferences(mockUploadResults);

      // Should only process successful uploads (2 out of 3)
      expect(Post.find).toHaveBeenCalledTimes(2);
    });
  });

  describe('migrateAllImages', () => {
    beforeEach(() => {
      // Mock all the methods used in migrateAllImages
      migrationService.scanLocalImages = vi.fn();
      migrationService.uploadToCloudinary = vi.fn();
      migrationService.updateDatabaseReferences = vi.fn();
    });

    it('should complete full migration successfully', async () => {
      const mockImageFiles = [{ filename: 'test.jpg' }];
      const mockUploadResults = [{ success: true, localPath: 'test.jpg' }];
      const mockUpdateStats = { postsUpdated: 1, postsNotFound: 0, updateErrors: 0 };

      migrationService.scanLocalImages.mockResolvedValue(mockImageFiles);
      migrationService.uploadToCloudinary.mockResolvedValue(mockUploadResults);
      migrationService.updateDatabaseReferences.mockResolvedValue(mockUpdateStats);

      const result = await migrationService.migrateAllImages();

      expect(result.success).toBe(true);
      expect(result.uploadResults).toBe(mockUploadResults);
      expect(result.updateStats).toBe(mockUpdateStats);
      expect(typeof result.duration).toBe('number');
    });

    it('should handle case with no images to migrate', async () => {
      migrationService.scanLocalImages.mockResolvedValue([]);

      const result = await migrationService.migrateAllImages();

      expect(result.success).toBe(true);
      expect(result.uploadResults).toEqual([]);
      expect(migrationService.uploadToCloudinary).not.toHaveBeenCalled();
    });

    it('should propagate errors from sub-methods', async () => {
      migrationService.scanLocalImages.mockRejectedValue(new Error('Scan failed'));

      await expect(migrationService.migrateAllImages()).rejects.toThrow('Scan failed');
    });
  });

  describe('getProgress', () => {
    it('should calculate progress correctly', () => {
      migrationService.stats = {
        totalImages: 10,
        successful: 7,
        failed: 2,
        skipped: 0
      };

      const progress = migrationService.getProgress();

      expect(progress.progress).toBe('90%');
      expect(progress.isComplete).toBe(false);
    });

    it('should handle zero total images', () => {
      migrationService.stats = {
        totalImages: 0,
        successful: 0,
        failed: 0,
        skipped: 0
      };

      const progress = migrationService.getProgress();

      expect(progress.progress).toBe('0%');
      expect(progress.isComplete).toBe(true);
    });
  });

  describe('logging', () => {
    it('should log messages with timestamps', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      migrationService.log('Test message', 'info');

      expect(migrationService.migrationLog).toHaveLength(1);
      expect(migrationService.migrationLog[0].message).toBe('Test message');
      expect(migrationService.migrationLog[0].level).toBe('info');
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should reset log and stats', () => {
      migrationService.log('Test message');
      migrationService.stats.totalImages = 5;

      migrationService.reset();

      expect(migrationService.migrationLog).toHaveLength(0);
      expect(migrationService.stats.totalImages).toBe(0);
    });
  });
});