import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPost } from '../../controllers/postController.js';

describe('Post Controller - Image Validation Integration', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
  });

  it('should handle post creation without image successfully', async () => {
    mockReq = {
      body: { caption: 'Test post without image' },
      user: { _id: 'test-user-id' },
      file: null
    };

    await createPost(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        caption: 'Test post without image',
        userId: 'test-user-id',
        image: null,
        _debug: expect.objectContaining({
          imageValidation: null,
          processingTimeMs: expect.any(Number)
        })
      })
    );
  });

  it('should handle post creation with image and include validation debug info', async () => {
    const testImageUrl = 'https://res.cloudinary.com/test/image/upload/v123/test-image.jpg';
    
    mockReq = {
      body: { caption: 'Test post with image' },
      user: { _id: 'test-user-id' },
      file: {
        path: testImageUrl,
        originalname: 'test-image.jpg',
        size: 1024000
      }
    };

    await createPost(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        caption: 'Test post with image',
        userId: 'test-user-id',
        image: testImageUrl,
        _debug: expect.objectContaining({
          imageValidation: expect.objectContaining({
            isAccessible: expect.any(Boolean),
            attempts: expect.any(Number),
            hasError: expect.any(Boolean)
          }),
          processingTimeMs: expect.any(Number)
        })
      })
    );
  });

  it('should include comprehensive logging information', async () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    
    mockReq = {
      body: { caption: 'Test logging' },
      user: { _id: 'test-user-id' },
      file: null
    };

    await createPost(mockReq, mockRes);

    // Verify that logging occurred
    expect(consoleSpy).toHaveBeenCalledWith(
      'Post creation started:',
      expect.objectContaining({
        userId: 'test-user-id',
        hasImage: false,
        captionLength: 12
      })
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      'Creating post in database:',
      expect.any(Object)
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      'Post created successfully:',
      expect.any(Object)
    );

    consoleSpy.mockRestore();
  });

  it('should log image upload and validation process when image is present', async () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const testImageUrl = 'https://res.cloudinary.com/test/image/upload/v123/test-image.jpg';
    
    mockReq = {
      body: { caption: 'Test with image logging' },
      user: { _id: 'test-user-id' },
      file: {
        path: testImageUrl,
        originalname: 'test-image.jpg',
        size: 1024000
      }
    };

    await createPost(mockReq, mockRes);

    // Verify image-specific logging occurred
    expect(consoleSpy).toHaveBeenCalledWith(
      'Image uploaded to Cloudinary:',
      expect.objectContaining({
        userId: 'test-user-id',
        imageUrl: testImageUrl,
        originalName: 'test-image.jpg',
        size: 1024000
      })
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      'Starting image accessibility validation:',
      expect.objectContaining({
        userId: 'test-user-id',
        imageUrl: testImageUrl
      })
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      'Image validation completed:',
      expect.any(Object)
    );

    consoleSpy.mockRestore();
  });

  it('should handle errors with proper error logging', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Create a request that will cause an error (invalid user ID)
    mockReq = {
      body: { caption: 'Test error handling' },
      user: { _id: null }, // This should cause an error
      file: null
    };

    await expect(createPost(mockReq, mockRes)).rejects.toThrow();

    // Verify error logging occurred
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error creating post:',
      expect.any(Object)
    );

    consoleErrorSpy.mockRestore();
  });

  it('should measure and include processing time in response', async () => {
    mockReq = {
      body: { caption: 'Test processing time' },
      user: { _id: 'test-user-id' },
      file: null
    };

    const startTime = Date.now();
    await createPost(mockReq, mockRes);
    const endTime = Date.now();

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        _debug: expect.objectContaining({
          processingTimeMs: expect.any(Number)
        })
      })
    );

    // Get the actual processing time from the response
    const response = mockRes.json.mock.calls[0][0];
    const processingTime = response._debug.processingTimeMs;
    
    // Verify processing time is reasonable (should be less than total test time)
    expect(processingTime).toBeGreaterThan(0);
    expect(processingTime).toBeLessThan(endTime - startTime + 100); // Add some buffer
  });
});