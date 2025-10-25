import asyncHandler from 'express-async-handler';
import Post from '../models/Post.js';
import User from '../models/User.js';
import { createNotification } from './notificationController.js';
import cloudinaryService from '../services/cloudinaryService.js';
import { validateUploadedImage } from '../utils/imageValidation.js';
import { 
  logImageUpload, 
  logImageValidation, 
  logImageError, 
  logImagePerformance,
  LOG_LEVELS 
} from '../utils/imageLogger.js';

// @desc    Create a new post
// @route   POST /api/posts
// @access  Private
const createPost = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const userId = req.user._id;
  const { caption } = req.body;
  
  // Comprehensive logging for image upload and validation process
  logImageUpload(LOG_LEVELS.INFO, 'Post creation started', {
    userId: userId.toString(),
    hasImage: !!req.file,
    captionLength: caption ? caption.length : 0,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });

  try {
    // Handle Cloudinary image URL - req.file.path contains the Cloudinary URL
    let image = null;
    let imageValidationResult = null;
    
    if (req.file) {
      const uploadStartTime = Date.now();
      image = req.file.path; // Cloudinary URL from multer-storage-cloudinary
      const uploadDuration = Date.now() - uploadStartTime;
      
      // Log successful upload with comprehensive context
      logImageUpload(LOG_LEVELS.INFO, 'Image uploaded to Cloudinary successfully', {
        userId: userId.toString(),
        cloudinaryUrl: image,
        filename: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        publicId: req.file.public_id || 'unknown',
        duration: uploadDuration
      });

      // Add immediate image accessibility check after Cloudinary upload
      logImageValidation(LOG_LEVELS.INFO, 'Starting post-upload image validation', {
        url: image,
        userId: userId.toString(),
        validationType: 'post_upload',
        originalFilename: req.file.originalname
      });

      const validationStartTime = Date.now();
      imageValidationResult = await validateUploadedImage(image, {
        userId: userId.toString(),
        operation: 'post_creation',
        originalFilename: req.file.originalname,
        fileSize: req.file.size
      });
      const validationDuration = Date.now() - validationStartTime;

      // Log validation results with comprehensive context
      logImageValidation(
        imageValidationResult?.isAccessible ? LOG_LEVELS.INFO : LOG_LEVELS.WARN,
        `Image validation ${imageValidationResult?.isAccessible ? 'succeeded' : 'failed'}`,
        {
          url: image,
          userId: userId.toString(),
          isAccessible: imageValidationResult?.isAccessible,
          attempts: imageValidationResult?.attempts,
          responseTime: validationDuration,
          validationType: 'post_upload',
          error: imageValidationResult?.lastError?.message
        }
      );

      // Handle cases where uploaded images are not immediately accessible
      if (!imageValidationResult?.isAccessible) {
        logImageError(new Error('Uploaded image not immediately accessible'), {
          operation: 'post_upload_validation',
          userId: userId.toString(),
          url: image,
          attempts: imageValidationResult?.attempts,
          additionalData: {
            originalFilename: req.file.originalname,
            fileSize: req.file.size,
            publicId: req.file.public_id
          }
        });

        // Continue with post creation but log the issue for monitoring
        // In production, you might want to implement different strategies:
        // 1. Retry the validation after a delay
        // 2. Queue the post for later processing
        // 3. Return an error to the user
        // For now, we'll continue but add a warning flag
      }
    }

    // Check if user is super admin to make post globally visible
    const user = await User.findById(userId);
    const isSuperAdmin = user && user.isAdmin && user.adminLevel === 'super';

    console.info('Creating post in database:', {
      userId,
      hasImage: !!image,
      isSuperAdmin,
      imageValidated: imageValidationResult?.isAccessible,
      timestamp: new Date().toISOString()
    });

    const post = new Post({
      userId,
      caption,
      image,
      isGlobalPost: isSuperAdmin, // Super admin posts are globally visible
      postType: isSuperAdmin ? 'admin_announcement' : 'regular'
    });

    const createdPost = await post.save();
    
    const processingTime = Date.now() - startTime;
    
    console.info('Post created successfully:', {
      userId,
      postId: createdPost._id,
      hasImage: !!image,
      imageValidated: imageValidationResult?.isAccessible,
      processingTimeMs: processingTime,
      timestamp: new Date().toISOString()
    });
    
    // Maintain existing API response format for backward compatibility
    // Add validation info for debugging purposes (can be removed in production)
    const postData = createdPost.toObject ? createdPost.toObject() : createdPost;
    const response = {
      ...postData,
      _debug: {
        imageValidation: imageValidationResult ? {
          isAccessible: imageValidationResult.isAccessible,
          attempts: imageValidationResult.attempts,
          hasError: !!imageValidationResult.lastError
        } : null,
        processingTimeMs: processingTime
      }
    };
    
    res.status(201).json(response);
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    console.error('Error creating post:', {
      userId,
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack
      },
      hasImage: !!req.file,
      imageUrl: req.file?.path,
      processingTimeMs: processingTime,
      timestamp: new Date().toISOString()
    });
    
    // Enhanced error handling for cases where uploaded images are not immediately accessible
    if (error.message && error.message.includes('Cloudinary')) {
      console.error('Cloudinary-specific error during post creation:', {
        userId,
        error: error.message,
        imageUrl: req.file?.path,
        timestamp: new Date().toISOString()
      });
      
      res.status(500);
      throw new Error('Image upload failed. Please try again.');
    }

    // Handle image validation failures specifically
    if (error.message && error.message.includes('image validation')) {
      console.error('Image validation error during post creation:', {
        userId,
        error: error.message,
        imageUrl: req.file?.path,
        timestamp: new Date().toISOString()
      });
      
      res.status(500);
      throw new Error('Image validation failed. The uploaded image may not be accessible. Please try again.');
    }
    
    // Re-throw other errors to be handled by error middleware
    throw error;
  }
});

// @desc    Get posts from current user and followed users (including global posts)
// @route   GET /api/posts
// @access  Private
const getPosts = asyncHandler(async (req, res) => {
  // Get current user with following list
  const currentUser = await User.findById(req.user._id).select('following');
  
  // Create array of user IDs to fetch posts from (current user + followed users)
  const userIdsToFetch = [req.user._id, ...currentUser.following];
  
  // Get posts from followed users AND global posts (super admin posts)
  const posts = await Post.find({
    $or: [
      { userId: { $in: userIdsToFetch } }, // Posts from followed users
      { isGlobalPost: true } // Global posts (super admin posts visible to everyone)
    ]
  })
    .sort({ createdAt: -1 })
    .populate('userId', 'fullName profilePic enrollment isAdmin adminLevel')
    .populate('likes', 'fullName profilePic')
    .populate('comments.user', 'fullName profilePic');
  
  res.json(posts);
});

// @desc    Get posts by user
// @route   GET /api/posts/user/:id
// @access  Private
const getUserPosts = asyncHandler(async (req, res) => {
  const targetUserId = req.params.id;
  const currentUserId = req.user._id;
  
  // Check if viewing own profile - always allow access
  if (targetUserId === currentUserId.toString()) {
    const posts = await Post.find({ userId: targetUserId })
      .sort({ createdAt: -1 })
      .populate('userId', 'fullName profilePic enrollment isAdmin adminLevel');
    return res.json(posts);
  }
  
  // Check if target user is super admin - their posts are always public
  const targetUser = await User.findById(targetUserId);
  const isSuperAdmin = targetUser && targetUser.isAdmin && targetUser.adminLevel === 'super';
  
  if (isSuperAdmin) {
    // Super admin posts are always visible to everyone
    const posts = await Post.find({ userId: targetUserId })
      .sort({ createdAt: -1 })
      .populate('userId', 'fullName profilePic enrollment isAdmin adminLevel');
    return res.json(posts);
  }
  
  // Check follow relationship for regular users' profiles
  const currentUser = await User.findById(currentUserId);
  const isFollowing = currentUser.following.includes(targetUserId);
  
  if (!isFollowing) {
    return res.status(403).json({
      message: 'Follow user to see posts',
      requiresFollow: true,
      code: 'FOLLOW_REQUIRED'
    });
  }
  
  // Return posts if following
  const posts = await Post.find({ userId: targetUserId })
    .sort({ createdAt: -1 })
    .populate('userId', 'fullName profilePic enrollment isAdmin adminLevel');
  res.json(posts);
});

// @desc    Get global/admin posts only
// @route   GET /api/posts/global
// @access  Private
const getGlobalPosts = asyncHandler(async (req, res) => {
  const posts = await Post.find({ isGlobalPost: true })
    .sort({ createdAt: -1 })
    .populate('userId', 'fullName profilePic enrollment isAdmin adminLevel')
    .populate('likes', 'fullName profilePic')
    .populate('comments.user', 'fullName profilePic');
  res.json(posts);
});

// @desc    Update a post
// @route   PUT /api/posts/:id
// @access  Private
const updatePost = asyncHandler(async (req, res) => {
  try {
    const { caption } = req.body;
    let newImage = undefined;
    
    // Handle Cloudinary image URL if new image is uploaded
    if (req.file) {
      newImage = req.file.path; // Cloudinary URL from multer-storage-cloudinary
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
      res.status(404);
      throw new Error('Post not found');
    }

    if (post.userId.toString() !== req.user._id.toString()) {
      res.status(401);
      throw new Error('Not authorized to update this post');
    }

    // Store old image info for cleanup
    const oldImageUrl = post.image;
    let oldImagePublicId = null;
    
    // Extract public ID from old Cloudinary URL for cleanup
    if (oldImageUrl && oldImageUrl.includes('cloudinary.com')) {
      try {
        // Extract public ID from Cloudinary URL
        // URL format: https://res.cloudinary.com/cloud-name/image/upload/v123456/folder/public-id.ext
        const urlParts = oldImageUrl.split('/');
        const fileWithExt = urlParts[urlParts.length - 1];
        const publicIdWithFolder = urlParts.slice(-2).join('/');
        oldImagePublicId = publicIdWithFolder.split('.')[0]; // Remove file extension
      } catch (error) {
        console.warn('Could not extract public ID from old image URL:', oldImageUrl);
      }
    }

    // Update fields
    if (caption !== undefined) post.caption = caption;
    if (newImage !== undefined) {
      post.image = newImage;
      
      // Cleanup old image from Cloudinary if it exists and we have a new image
      if (oldImagePublicId && cloudinaryService.isReady()) {
        try {
          await cloudinaryService.deleteImage(oldImagePublicId);
          console.log('Successfully deleted old image from Cloudinary:', oldImagePublicId);
        } catch (error) {
          // Log error but don't fail the update - cleanup is not critical
          console.warn('Failed to delete old image from Cloudinary:', error.message);
        }
      }
    }

    const updatedPost = await post.save();
    const populatedPost = await Post.findById(updatedPost._id)
      .populate('userId', 'fullName profilePic enrollment');

    // Maintain existing API contract for frontend compatibility
    res.json(populatedPost);
  } catch (error) {
    console.error('Error updating post:', error);
    
    // Handle cloud upload failures gracefully
    if (error.message && error.message.includes('Cloudinary')) {
      res.status(500);
      throw new Error('Image upload failed. Please try again.');
    }
    
    // Re-throw other errors to be handled by error middleware
    throw error;
  }
});

// @desc    Delete a post
// @route   DELETE /api/posts/:id
// @access  Private
const deletePost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);

  if (post) {
    if (post.userId.toString() !== req.user._id.toString()) {
      res.status(401);
      throw new Error('Not authorized to delete this post');
    }
    await post.deleteOne();
    res.json({ message: 'Post removed' });
  } else {
    res.status(404);
    throw new Error('Post not found');
  }
});

// @desc    Like/Unlike a post
// @route   POST /api/posts/:id/like
// @access  Private
const toggleLike = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);
  
  if (!post) {
    res.status(404);
    throw new Error('Post not found');
  }

  const userId = req.user._id;
  const isLiked = post.likes.includes(userId);

  if (isLiked) {
    // Unlike the post
    post.likes.pull(userId);
    post.likesCount = Math.max(0, post.likesCount - 1);
  } else {
    // Like the post
    post.likes.push(userId);
    post.likesCount += 1;
    
    // Create notification for post owner (if not liking own post)
    if (post.userId.toString() !== userId.toString()) {
      await createNotification(
        post.userId,
        userId,
        'like',
        'liked your post',
        post._id
      );
    }
  }

  await post.save();
  
  // Populate the likes array with user details
  await post.populate('likes', 'fullName profilePic');
  
  // Emit Socket.IO event for real-time updates
  const io = req.app.get('io');
  if (io) {
    io.emit('post:likeUpdate', {
      postId: post._id,
      userId: userId,
      liked: !isLiked,
      likesCount: post.likesCount,
      likes: post.likes
    });
  }
  
  res.json({
    success: true,
    liked: !isLiked,
    likesCount: post.likesCount,
    likes: post.likes
  });
});

// @desc    Get who liked a post
// @route   GET /api/posts/:id/likes
// @access  Private
const getPostLikes = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id)
    .populate('likes', 'fullName profilePic');
  
  if (!post) {
    res.status(404);
    throw new Error('Post not found');
  }

  res.json({
    likesCount: post.likesCount,
    likes: post.likes
  });
});

// @desc    Add comment to a post
// @route   POST /api/posts/:id/comments
// @access  Private
const addComment = asyncHandler(async (req, res) => {
  const { text } = req.body;
  const postId = req.params.id;
  const userId = req.user._id;

  const post = await Post.findById(postId);
  
  if (!post) {
    res.status(404);
    throw new Error('Post not found');
  }

  const newComment = {
    user: userId,
    text: text.trim()
  };

  post.comments.push(newComment);
  post.commentsCount += 1;
  
  await post.save();
  
  // Create notification for post owner (if not commenting on own post)
  if (post.userId.toString() !== userId.toString()) {
    await createNotification(
      post.userId,
      userId,
      'comment',
      `commented: "${text.length > 30 ? text.substring(0, 30) + '...' : text}"`,
      post._id,
      newComment._id
    );
  }
  
  // Populate the comment with user details
  await post.populate('comments.user', 'fullName profilePic');
  
  // Get the newly added comment
  const addedComment = post.comments[post.comments.length - 1];
  
  // Emit Socket.IO event for real-time updates
  const io = req.app.get('io');
  if (io) {
    io.emit('post:commentUpdate', {
      postId: post._id,
      comment: addedComment,
      commentsCount: post.commentsCount
    });
  }
  
  res.status(201).json({
    success: true,
    comment: addedComment,
    commentsCount: post.commentsCount
  });
});

// @desc    Get comments for a post
// @route   GET /api/posts/:id/comments
// @access  Private
const getPostComments = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id)
    .populate('comments.user', 'fullName profilePic');
  
  if (!post) {
    res.status(404);
    throw new Error('Post not found');
  }

  res.json({
    comments: post.comments,
    commentsCount: post.commentsCount
  });
});

export { createPost, getPosts, getUserPosts, getGlobalPosts, updatePost, deletePost, toggleLike, getPostLikes, addComment, getPostComments };
