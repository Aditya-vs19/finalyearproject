import asyncHandler from 'express-async-handler';
import Post from '../models/Post.js';
import User from '../models/User.js';
import { createNotification } from './notificationController.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Multer storage configuration
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename(req, file, cb) {
    cb(
      null,
      `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`
    );
  },
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// @desc    Create a new post
// @route   POST /api/posts
// @access  Private
const createPost = asyncHandler(async (req, res) => {
  const { caption } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : null;

  const post = new Post({
    userId: req.user._id,
    caption,
    image,
  });

  const createdPost = await post.save();
  res.status(201).json(createdPost);
});

// @desc    Get posts from current user and followed users
// @route   GET /api/posts
// @access  Private
const getPosts = asyncHandler(async (req, res) => {
  // Get current user with following list
  const currentUser = await User.findById(req.user._id).select('following');
  
  // Create array of user IDs to fetch posts from (current user + followed users)
  const userIdsToFetch = [req.user._id, ...currentUser.following];
  
  const posts = await Post.find({ userId: { $in: userIdsToFetch } })
    .sort({ createdAt: -1 })
    .populate('userId', 'fullName profilePic enrollment')
    .populate('likes', 'fullName profilePic')
    .populate('comments.user', 'fullName profilePic');
  res.json(posts);
});

// @desc    Get posts by user
// @route   GET /api/posts/user/:id
// @access  Private
const getUserPosts = asyncHandler(async (req, res) => {
  const posts = await Post.find({ userId: req.params.id })
    .sort({ createdAt: -1 })
    .populate('userId', 'fullName profilePic enrollment');
  res.json(posts);
});

// @desc    Update a post
// @route   PUT /api/posts/:id
// @access  Private
const updatePost = asyncHandler(async (req, res) => {
  const { caption } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : undefined;

  const post = await Post.findById(req.params.id);

  if (!post) {
    res.status(404);
    throw new Error('Post not found');
  }

  if (post.userId.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Not authorized to update this post');
  }

  // Update fields
  if (caption !== undefined) post.caption = caption;
  if (image !== undefined) post.image = image;

  const updatedPost = await post.save();
  const populatedPost = await Post.findById(updatedPost._id)
    .populate('userId', 'fullName profilePic enrollment');

  res.json(populatedPost);
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

export { upload, createPost, getPosts, getUserPosts, updatePost, deletePost, toggleLike, getPostLikes, addComment, getPostComments };
