import { vi } from 'vitest';
import { ImageCleanupService } from '../../services/imageCleanupService.js';
import Post from '../../models/Post.js';
import cloudinaryService from '../../services/cloudinaryService.js';

// Mock dependencies
vi.mock('../../models/Post.js');
vi.mock('../../services/cloudinaryService.js');
vi.mock('fs/promises');

describe('ImageCleanupService', () => {
  let cleanupService;
  let mockCloudinary;

  beforeEach(() => {
    cleanupService = new ImageCleanupService();
    
    // Mock cloudinary instance
    mockCloudinary = {
      api: {
        resources: vi.fn(),
        usage: vi.fn()
      }
    };
    cleanupService.cloudinary = mockCloudinary;

    // Reset mocks
    vi.clearAllMocks();
    
    // Mock cloudinaryService
    cloudinaryService.isReady = vi.fn().mockReturnValue(true);
    cloudinaryService.deleteImage = vi.fn().mockResolvedValue({ result: 'ok' });
  });

  describe('getAllCloudinaryImages', () => {
    it('should fetch all images from Cloudinary', async () => {
      const mockImages = [
        { public_id: 'gp-connect-posts/image1', secure_url: 'https://cloudinary.com/image1.jpg', bytes: 1000 },
        { public_id: 'gp-connect-posts/image2', secure_url: 'https://cloudinary.com/image2.jpg', bytes: 2000 }
      ];

      mockCloudinary.api.resources.mockResolvedValue({
        resources: mockImages,
        next_cursor: null
      });

      const result = await cleanupService.getAllCloudinaryImages();

      expect(result).toEqual(mockImages);
      expect(mockCloudinary.api.resources).toHaveBeenCalledWith({
        type: 'upload',
        prefix: 'gp-connect-posts/',
        max_results: 500,
        next_cursor: null
      });
    });

    it('should handle pagination', async () => {
      const firstBatch = [
        { public_id: 'gp-connect-posts/image1', secure_url: 'https://cloudinary.com/image1.jpg' }
      ];
      const secondBatch = [
        { public_id: 'gp-connect-posts/image2', secure_url: 'https://cloudinary.com/image2.jpg' }
      ];

      mockCloudinary.api.resources
        .mockResolvedValueOnce({
          resources: firstBatch,
          next_cursor: 'cursor123'
        })
        .mockResolvedValueOnce({
          resources: secondBatch,
          next_cursor: null
        });

      const result = await cleanupService.getAllCloudinaryImages();

      expect(result).toEqual([...firstBatch, ...secondBatch]);
      expect(mockCloudinary.api.resources).toHaveBeenCalledTimes(2);
    });

    it('should throw error when Cloudinary not configured', async () => {
      cloudinaryService.isReady.mockReturnValue(false);

      await expect(cleanupService.getAllCloudinaryImages()).rejects.toThrow('Cloudinary not configured');
    });

    it('should handle API errors', async () => {
      mockCloudinary.api.resources.mockRejectedValue(new Error('API Error'));

      await expect(cleanupService.getAllCloudinaryImages()).rejects.toThrow('Failed to fetch Cloudinary images: API Error');
    });
  });

  describe('getUsedImageUrls', () => {
    it('should fetch used image URLs from database', async () => {
      const mockPosts = [
        { image: 'https://cloudinary.com/image1.jpg' },
        { image: 'https://cloudinary.com/image2.jpg' },
        { image: null },
        { image: '' }
      ];

      Post.find.mockResolvedValue(mockPosts);

      const result = await cleanupService.getUsedImageUrls();

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(2);
      expect(result.has('https://cloudinary.com/image1.jpg')).toBe(true);
      expect(result.has('https://cloudinary.com/image2.jpg')).toBe(true);
      expect(Post.find).toHaveBeenCalledWith({ image: { $exists: true, $ne: null } }, 'image');
    });

    it('should handle database errors', async () => {
      Post.find.mockRejectedValue(new Error('Database Error'));

      await expect(cleanupService.getUsedImageUrls()).rejects.toThrow('Failed to fetch used image URLs: Database Error');
    });
  });

  describe('extractPublicIdFromUrl', () => {
    it('should extract public ID from Cloudinary URL', () => {
      const url = 'https://res.cloudinary.com/demo/image/upload/v1234567890/gp-connect-posts/sample.jpg';
      const result = cleanupService.extractPublicIdFromUrl(url);
      expect(result).toBe('gp-connect-posts/sample');
    });

    it('should handle URLs without file extension', () => {
      const url = 'https://res.cloudinary.com/demo/image/upload/v1234567890/gp-connect-posts/sample';
      const result = cleanupService.extractPublicIdFromUrl(url);
      expect(result).toBe('gp-connect-posts/sample');
    });

    it('should return null for invalid URLs', () => {
      const url = 'https://example.com/invalid-url.jpg';
      const result = cleanupService.extractPublicIdFromUrl(url);
      expect(result).toBe(null);
    });

    it('should handle errors gracefully', () => {
      const result = cleanupService.extractPublicIdFromUrl(null);
      expect(result).toBe(null);
    });
  });

  describe('identifyOrphanedImages', () => {
    it('should identify orphaned images correctly', async () => {
      const cloudinaryImages = [
        { public_id: 'gp-connect-posts/image1', secure_url: 'https://cloudinary.com/image1.jpg', bytes: 1000, created_at: '2023-01-01', format: 'jpg' },
        { public_id: 'gp-connect-posts/image2', secure_url: 'https://cloudinary.com/image2.jpg', bytes: 2000, created_at: '2023-01-02', format: 'jpg' },
        { public_id: 'gp-connect-posts/image3', secure_url: 'https://cloudinary.com/image3.jpg', bytes: 1500, created_at: '2023-01-03', format: 'jpg' }
      ];

      const usedUrls = new Set(['https://cloudinary.com/image1.jpg']);

      mockCloudinary.api.resources.mockResolvedValue({
        resources: cloudinaryImages,
        next_cursor: null
      });

      Post.find.mockResolvedValue([
        { image: 'https://cloudinary.com/image1.jpg' }
      ]);

      const result = await cleanupService.identifyOrphanedImages();

      expect(result.totalCloudinaryImages).toBe(3);
      expect(result.totalUsedImages).toBe(1);
      expect(result.totalOrphanedImages).toBe(2);
      expect(result.orphanedImages).toHaveLength(2);
      expect(result.orphanedImages[0].publicId).toBe('gp-connect-posts/image2');
      expect(result.orphanedImages[1].publicId).toBe('gp-connect-posts/image3');
    });

    it('should calculate size statistics correctly', async () => {
      const cloudinaryImages = [
        { public_id: 'gp-connect-posts/image1', secure_url: 'https://cloudinary.com/image1.jpg', bytes: 1000 },
        { public_id: 'gp-connect-posts/image2', secure_url: 'https://cloudinary.com/image2.jpg', bytes: 2000 }
      ];

      mockCloudinary.api.resources.mockResolvedValue({
        resources: cloudinaryImages,
        next_cursor: null
      });

      Post.find.mockResolvedValue([]);

      const result = await cleanupService.identifyOrphanedImages();

      expect(result.totalOrphanedSize).toBe(3000);
      expect(result.totalUsedSize).toBe(0);
    });
  });

  describe('cleanupOrphanedImages', () => {
    beforeEach(() => {
      // Mock fs/promises
      const mockFs = {
        mkdir: vi.fn().mockResolvedValue(),
        writeFile: vi.fn().mockResolvedValue()
      };
      vi.doMock('fs/promises', () => mockFs);
    });

    it('should perform dry run by default', async () => {
      const mockAnalysis = {
        totalOrphanedImages: 2,
        orphanedImages: [
          { publicId: 'gp-connect-posts/image1', url: 'https://cloudinary.com/image1.jpg', bytes: 1000, createdAt: '2023-01-01', format: 'jpg' },
          { publicId: 'gp-connect-posts/image2', url: 'https://cloudinary.com/image2.jpg', bytes: 2000, createdAt: '2023-01-02', format: 'jpg' }
        ]
      };

      jest.spyOn(cleanupService, 'identifyOrphanedImages').mockResolvedValue(mockAnalysis);

      const result = await cleanupService.cleanupOrphanedImages();

      expect(result.dryRun).toBe(true);
      expect(result.deletedCount).toBe(0);
      expect(result.wouldDelete).toHaveLength(2);
      expect(cloudinaryService.deleteImage).not.toHaveBeenCalled();
    });

    it('should delete images when dry run is false', async () => {
      const mockAnalysis = {
        totalOrphanedImages: 1,
        orphanedImages: [
          { publicId: 'gp-connect-posts/image1', url: 'https://cloudinary.com/image1.jpg', bytes: 1000, createdAt: '2023-01-01', format: 'jpg' }
        ]
      };

      jest.spyOn(cleanupService, 'identifyOrphanedImages').mockResolvedValue(mockAnalysis);
      jest.spyOn(cleanupService, 'createBackupVerification').mockResolvedValue({
        success: true,
        backupPath: './backups/test-backup.json'
      });

      const result = await cleanupService.cleanupOrphanedImages({ dryRun: false });

      expect(result.dryRun).toBe(false);
      expect(result.deletedCount).toBe(1);
      expect(cloudinaryService.deleteImage).toHaveBeenCalledWith('gp-connect-posts/image1');
    });

    it('should handle deletion errors', async () => {
      const mockAnalysis = {
        totalOrphanedImages: 1,
        orphanedImages: [
          { publicId: 'gp-connect-posts/image1', url: 'https://cloudinary.com/image1.jpg', bytes: 1000, createdAt: '2023-01-01', format: 'jpg' }
        ]
      };

      jest.spyOn(cleanupService, 'identifyOrphanedImages').mockResolvedValue(mockAnalysis);
      jest.spyOn(cleanupService, 'createBackupVerification').mockResolvedValue({
        success: true,
        backupPath: './backups/test-backup.json'
      });

      cloudinaryService.deleteImage.mockRejectedValue(new Error('Delete failed'));

      const result = await cleanupService.cleanupOrphanedImages({ dryRun: false });

      expect(result.deletedCount).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].publicId).toBe('gp-connect-posts/image1');
      expect(result.errors[0].error).toBe('Delete failed');
    });

    it('should filter images by age', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 5);

      const mockAnalysis = {
        totalOrphanedImages: 2,
        orphanedImages: [
          { publicId: 'gp-connect-posts/old', url: 'https://cloudinary.com/old.jpg', createdAt: oldDate.toISOString() },
          { publicId: 'gp-connect-posts/recent', url: 'https://cloudinary.com/recent.jpg', createdAt: recentDate.toISOString() }
        ]
      };

      jest.spyOn(cleanupService, 'identifyOrphanedImages').mockResolvedValue(mockAnalysis);

      const result = await cleanupService.cleanupOrphanedImages({ 
        dryRun: true, 
        olderThanDays: 7 
      });

      expect(result.wouldDelete).toHaveLength(1);
      expect(result.wouldDelete[0].publicId).toBe('gp-connect-posts/old');
    });

    it('should limit number of images to delete', async () => {
      const mockAnalysis = {
        totalOrphanedImages: 5,
        orphanedImages: Array.from({ length: 5 }, (_, i) => ({
          publicId: `gp-connect-posts/image${i}`,
          url: `https://cloudinary.com/image${i}.jpg`,
          createdAt: '2023-01-01'
        }))
      };

      jest.spyOn(cleanupService, 'identifyOrphanedImages').mockResolvedValue(mockAnalysis);

      const result = await cleanupService.cleanupOrphanedImages({ 
        dryRun: true, 
        maxImages: 3 
      });

      expect(result.wouldDelete).toHaveLength(3);
    });
  });

  describe('getUsageStatistics', () => {
    it('should return usage statistics', async () => {
      const mockUsage = {
        plan: 'Free',
        credits: { used: 100, limit: 1000 },
        storage: { used: 50000000, limit: 1000000000 },
        bandwidth: { used: 10000000, limit: 100000000 },
        transformations: { used: 500, limit: 25000 }
      };

      const mockImages = [
        { bytes: 1000000 },
        { bytes: 2000000 }
      ];

      mockCloudinary.api.usage.mockResolvedValue(mockUsage);
      jest.spyOn(cleanupService, 'getAllCloudinaryImages').mockResolvedValue(mockImages);

      const result = await cleanupService.getUsageStatistics();

      expect(result.plan).toBe('Free');
      expect(result.credits.used).toBe(100);
      expect(result.credits.remaining).toBe(900);
      expect(result.images.total).toBe(2);
      expect(result.images.totalSize).toBe(3000000);
      expect(result.images.averageSize).toBe(1500000);
    });

    it('should handle missing usage data', async () => {
      mockCloudinary.api.usage.mockResolvedValue({});
      jest.spyOn(cleanupService, 'getAllCloudinaryImages').mockResolvedValue([]);

      const result = await cleanupService.getUsageStatistics();

      expect(result.credits.used).toBe(0);
      expect(result.storage.used).toBe(0);
      expect(result.images.total).toBe(0);
    });
  });

  describe('scheduleCleanup', () => {
    it('should return default schedule configuration', () => {
      const result = cleanupService.scheduleCleanup();

      expect(result.enabled).toBe(false);
      expect(result.cron).toBe('0 2 * * 0');
      expect(result.options.dryRun).toBe(false);
      expect(result.options.maxImages).toBe(100);
      expect(result.options.olderThanDays).toBe(30);
    });

    it('should merge custom configuration', () => {
      const customConfig = {
        enabled: true,
        cron: '0 3 * * 1',
        options: { maxImages: 50 }
      };

      const result = cleanupService.scheduleCleanup(customConfig);

      expect(result.enabled).toBe(true);
      expect(result.cron).toBe('0 3 * * 1');
      expect(result.options.maxImages).toBe(50);
      expect(result.options.olderThanDays).toBe(30); // Should keep default
    });
  });
});