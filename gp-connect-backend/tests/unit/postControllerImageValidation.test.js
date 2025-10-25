import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('Post Controller - Image Validation Enhancement', () => {
  let createPost;
  let mockValidateUploadedImage;
  let mockPost;
  let mockUser;
  let mockCreateNotification;
  let mockCloudinaryService;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Mock image validation utility
    mockValidateUploadedImage = vi.fn();
    
    // Mock Post model
    mockPost = vi.fn().mockImplementation(function(data) {
      Object.assign(this, data);
      this.save = vi.fn().mockResolvedValue({
        _id: 'post123',
        ...data,
        toObject: () => ({ _id: 'post123', ...data })
      });
      return this;
    });

    // Mock User model
    mockUser = {
      findById: vi.fn().mockResolvedValue({ 
        _id: 'user123', 
        isAdmin: false,
        adminLevel: null
      })
    };

    // Mock notification controller
    mockCreateNotification = vi.fn().mockResolvedValue();

    // Mock Cloudinary service
    mockCloudinaryService = {
      isReady: vi.fn().mockReturnValue(true),
      deleteImage: vi.fn().mockResolvedValue({ result: 'ok' })
    };

    // Setup module mocks
    vi.doMock('../../utils/imageValidation.js', () => ({
      validateUploadedImage: mockValidateUploadedImage
    }));

    vi.doMock('../../models/Post.js', () => ({ 
      default: mockPost 
    }));
    
    vi.doMock('../../models/User.js', () => ({ 
      default: mockUser 
    }));
    
    vi.doMock('../../controllers/notificationController.js', () => ({
      createNotification: mockCreateNotification
    }));

    vi.doMock('../../services/cloudinaryService.js', () => ({
      default: mockCloudinaryService
    }));

    // Import the controller after mocking
    const module = await import('../../controllers/postController.js');
    createPost = module.createPost;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should validate image accessibility after Cloudinary upload', async () => {
    const imageUrl = 'https://res.cloudinary.com/test/image/upload/v123/test-image.jpg';
    
    mockValidateUploadedImage.mockResolvedValue({
      isAccessible: true,
      attempts: 1,
      lastError: null
    });

    const req = {
      body: { caption: 'Test post with image' },
      user: { _id: 'user123' },
      file: {
        path: imageUrl,
        originalname: 'test-image.jpg',
        size: 1024000
      }
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    await createPost(req, res);

    // Verify image validation was called with correct parameters
    expect(mockValidateUploadedImage).toHaveBeenCalledWith(imageUrl, {
      userId: 'user123',
      operation: 'post_creation',
      originalFilename: 'test-image.jpg',
      fileSize: 1024000
    });

    // Verify post was created successfully
    expect(mockPost).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user123',
      image: imageUrl
    }));

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      _debug: expect.objectContaining({
        imageValidation: {
          isAccessible: true,
          attempts: 1,
          hasError: false
        }
      })
    }));
  });

  it('should handle image validation failure gracefully', async () => {
    const imageUrl = 'https://res.cloudinary.com/test/image/upload/v123/test-image.jpg';
    
    mockValidateUploadedImage.mockResolvedValue({
      isAccessible: false,
      attempts: 3,
      lastError: new Error('Network timeout')
    });

    const req = {
      body: { caption: 'Test post with inaccessible image' },
      user: { _id: 'user123' },
      file: {
        path: imageUrl,
        originalname: 'test-image.jpg',
        size: 1024000
      }
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    await createPost(req, res);

    // Verify image validation was called
    expect(mockValidateUploadedImage).toHaveBeenCalled();

    // Verify post was still created despite validation failure
    expect(mockPost).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user123',
      image: imageUrl
    }));

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      _debug: expect.objectContaining({
        imageValidation: {
          isAccessible: false,
          attempts: 3,
          hasError: true
        }
      })
    }));
  });

  it('should create post without image validation when no image is uploaded', async () => {
    const req = {
      body: { caption: 'Text only post' },
      user: { _id: 'user123' },
      file: null
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    await createPost(req, res);

    // Verify image validation was not called
    expect(mockValidateUploadedImage).not.toHaveBeenCalled();

    // Verify post was created without image
    expect(mockPost).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user123',
      image: null
    }));

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      _debug: expect.objectContaining({
        imageValidation: null
      })
    }));
  });

  it('should handle super admin posts correctly with image validation', async () => {
    const imageUrl = 'https://res.cloudinary.com/test/image/upload/v123/admin-post.jpg';
    
    mockValidateUploadedImage.mockResolvedValue({
      isAccessible: true,
      attempts: 1,
      lastError: null
    });

    // Mock super admin user
    mockUser.findById.mockResolvedValue({
      _id: 'admin123',
      isAdmin: true,
      adminLevel: 'super'
    });

    const req = {
      body: { caption: 'Admin announcement with image' },
      user: { _id: 'admin123' },
      file: {
        path: imageUrl,
        originalname: 'admin-post.jpg',
        size: 2048000
      }
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    await createPost(req, res);

    // Verify image validation was called
    expect(mockValidateUploadedImage).toHaveBeenCalledWith(imageUrl, {
      userId: 'admin123',
      operation: 'post_creation',
      originalFilename: 'admin-post.jpg',
      fileSize: 2048000
    });

    // Verify post was created as global post
    expect(mockPost).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'admin123',
      image: imageUrl,
      isGlobalPost: true,
      postType: 'admin_announcement'
    }));

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('should include processing time in debug information', async () => {
    const req = {
      body: { caption: 'Test post' },
      user: { _id: 'user123' },
      file: null
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    await createPost(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      _debug: expect.objectContaining({
        processingTimeMs: expect.any(Number)
      })
    }));
  });

  it('should log comprehensive information during post creation process', async () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    
    const imageUrl = 'https://res.cloudinary.com/test/image/upload/v123/test-image.jpg';
    
    mockValidateUploadedImage.mockResolvedValue({
      isAccessible: true,
      attempts: 1,
      lastError: null
    });

    const req = {
      body: { caption: 'Test post with logging' },
      user: { _id: 'user123' },
      file: {
        path: imageUrl,
        originalname: 'test-image.jpg',
        size: 1024000
      }
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    await createPost(req, res);

    // Verify comprehensive logging occurred
    expect(consoleSpy).toHaveBeenCalledWith('Post creation started:', expect.any(Object));
    expect(consoleSpy).toHaveBeenCalledWith('Image uploaded to Cloudinary:', expect.any(Object));
    expect(consoleSpy).toHaveBeenCalledWith('Starting image accessibility validation:', expect.any(Object));
    expect(consoleSpy).toHaveBeenCalledWith('Image validation completed:', expect.any(Object));
    expect(consoleSpy).toHaveBeenCalledWith('Creating post in database:', expect.any(Object));
    expect(consoleSpy).toHaveBeenCalledWith('Post created successfully:', expect.any(Object));

    consoleSpy.mockRestore();
  });

  it('should handle errors during post creation with proper logging', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const req = {
      body: { caption: 'Test post' },
      user: { _id: 'user123' },
      file: null
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    // Mock database error
    const dbError = new Error('Database connection failed');
    mockPost.mockImplementation(function() {
      this.save = vi.fn().mockRejectedValue(dbError);
      return this;
    });

    await expect(createPost(req, res)).rejects.toThrow('Database connection failed');

    // Verify error logging occurred
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error creating post:', expect.any(Object));

    consoleErrorSpy.mockRestore();
  });

  it('should handle Cloudinary-specific errors with appropriate error messages', async () => {
    const req = {
      body: { caption: 'Test post' },
      user: { _id: 'user123' },
      file: {
        path: 'https://res.cloudinary.com/test/image/upload/v123/test-image.jpg',
        originalname: 'test-image.jpg',
        size: 1024000
      }
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    // Mock Cloudinary error
    const cloudinaryError = new Error('Cloudinary upload failed');
    mockPost.mockImplementation(function() {
      this.save = vi.fn().mockRejectedValue(cloudinaryError);
      return this;
    });

    await expect(createPost(req, res)).rejects.toThrow('Image upload failed. Please try again.');
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('should handle image validation specific errors with appropriate error messages', async () => {
    const req = {
      body: { caption: 'Test post' },
      user: { _id: 'user123' },
      file: {
        path: 'https://res.cloudinary.com/test/image/upload/v123/test-image.jpg',
        originalname: 'test-image.jpg',
        size: 1024000
      }
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    // Mock image validation error
    const validationError = new Error('image validation failed');
    mockPost.mockImplementation(function() {
      this.save = vi.fn().mockRejectedValue(validationError);
      return this;
    });

    await expect(createPost(req, res)).rejects.toThrow('Image validation failed. The uploaded image may not be accessible. Please try again.');
    expect(res.status).toHaveBeenCalledWith(500);
  });
});