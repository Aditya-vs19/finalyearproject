import asyncHandler from 'express-async-handler';
import User from '../models/User.js';
import Post from '../models/Post.js';
import { createNotification } from './notificationController.js';
import bcrypt from 'bcryptjs';

// @desc    Get user profile by ID
// @route   GET /api/profile/:id
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password -otp -otpExpires');
  
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Get user's posts
  const posts = await Post.find({ userId: req.params.id })
    .sort({ createdAt: -1 })
    .populate('userId', 'fullName profilePic');

  // Get user stats
  const totalPosts = await Post.countDocuments({ userId: req.params.id });
  const totalFollowers = user.followers.length;
  const totalFollowing = user.following.length;

  // Check if current user is following this user
  const currentUser = await User.findById(req.user._id).select('following');
  const isFollowing = currentUser.following.some(
    id => id.toString() === req.params.id
  );

  res.json({
    user: {
      ...user.toObject(),
      stats: {
        totalPosts,
        totalFollowers,
        totalFollowing
      },
      canMessage: isFollowing,
    },
    posts,
    isFollowing
  });
});

// @desc    Update user profile
// @route   PUT /api/profile/:id
// @access  Private
const updateUserProfile = asyncHandler(async (req, res) => {
  const { fullName, bio, department } = req.body;
  
  // Check if user exists and is the same user
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (user._id.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Not authorized to update this profile');
  }

  // Validate department if provided
  if (department && !['Computer', 'Mechanical', 'Civil', 'Metallurgy', 'IT', 'Meta'].includes(department)) {
    res.status(400);
    throw new Error('Invalid department');
  }

  // Update fields
  if (fullName) user.fullName = fullName;
  if (bio !== undefined) user.bio = bio;
  if (department) user.department = department;

  const updatedUser = await user.save();

  res.json({
    _id: updatedUser._id,
    fullName: updatedUser.fullName,
    email: updatedUser.email,
    enrollment: updatedUser.enrollment,
    bio: updatedUser.bio,
    profilePic: updatedUser.profilePic,
    department: updatedUser.department,
    isVerified: updatedUser.isVerified,
    createdAt: updatedUser.createdAt,
    updatedAt: updatedUser.updatedAt,
  });
});

// @desc    Upload profile picture
// @route   POST /api/profile/:id/upload
// @access  Private
const uploadProfilePicture = asyncHandler(async (req, res) => {
  // Check if user exists and is the same user
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (user._id.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Not authorized to update this profile');
  }

  if (!req.file) {
    res.status(400);
    throw new Error('No image file provided');
  }

  // Update profile picture path
  user.profilePic = `/uploads/${req.file.filename}`;
  await user.save();

  res.json({
    message: 'Profile picture updated successfully',
    profilePic: user.profilePic,
  });
});

// @desc    Change user password
// @route   PUT /api/profile/:id/password
// @access  Private
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // Check if user exists and is the same user
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (user._id.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Not authorized to change this password');
  }

  // Validate current password
  if (!(await user.matchPassword(currentPassword))) {
    res.status(400);
    throw new Error('Current password is incorrect');
  }

  // Validate new password
  if (!newPassword || newPassword.length < 6) {
    res.status(400);
    throw new Error('New password must be at least 6 characters long');
  }

  // Update password
  user.password = newPassword;
  await user.save();

  res.json({
    message: 'Password changed successfully',
  });
});

// @desc    Get current user profile
// @route   GET /api/profile/me
// @access  Private
const getCurrentUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('-password -otp -otpExpires');
  
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Get user's posts
  const posts = await Post.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .populate('userId', 'fullName profilePic');

  // Get user stats
  const totalPosts = await Post.countDocuments({ userId: req.user._id });
  const totalFollowers = user.followers.length;
  const totalFollowing = user.following.length;

  res.json({
    user: {
      ...user.toObject(),
      stats: {
        totalPosts,
        totalFollowers,
        totalFollowing
      }
    },
    posts,
  });
});

const getFollowingList = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('following', 'fullName profilePic enrollment department');

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  const formatted = (user.following || []).map((follow) => ({
    _id: follow._id,
    fullName: follow.fullName,
    profilePic: follow.profilePic || null,
    enrollment: follow.enrollment || '',
    department: follow.department || '',
  }));

  res.json(formatted);
});

// @desc    Search users by name or enrollment
// @route   GET /api/profile/search?query=...
// @access  Private
const searchUsers = asyncHandler(async (req, res) => {
  const query = req.query.query || req.query.q;
  
  if (!query || query.trim().length < 2) {
    res.status(400);
    throw new Error('Search query must be at least 2 characters long');
  }

  const users = await User.find({
    $and: [
      { _id: { $ne: req.user._id } }, // Exclude current user
      {
        $or: [
          { fullName: { $regex: query, $options: 'i' } },
          { enrollment: { $regex: query, $options: 'i' } }
        ]
      }
    ]
  })
  .select('fullName enrollment profilePic department')
  .limit(20);

  // Add follow status for each user
  const currentUser = await User.findById(req.user._id).select('following');
  const followingIds = currentUser.following.map(id => id.toString());

  const usersWithFollowStatus = users.map(user => {
    const isFollowing = followingIds.includes(user._id.toString());
    return {
      ...user.toObject(),
      isFollowing,
      canMessage: isFollowing,
    };
  });

  res.json(usersWithFollowStatus);
});

// @desc    Test endpoint to check if users exist in database
// @route   GET /api/profile/test-users
// @access  Private
const testUsers = asyncHandler(async (req, res) => {
  const totalUsers = await User.countDocuments();
  const sampleUsers = await User.find({}).select('fullName enrollment email').limit(5);
  
  console.log('Total users in database:', totalUsers);
  console.log('Sample users:', sampleUsers);
  
  res.json({
    totalUsers,
    sampleUsers
  });
});

// @desc    Follow a user
// @route   POST /api/profile/:id/follow
// @access  Private
const followUser = asyncHandler(async (req, res) => {
  const targetUserId = req.params.id;
  
  if (targetUserId === req.user._id.toString()) {
    res.status(400);
    throw new Error('Cannot follow yourself');
  }

  const targetUser = await User.findById(targetUserId);
  if (!targetUser) {
    res.status(404);
    throw new Error('User not found');
  }

  const currentUser = await User.findById(req.user._id);

  // Check if already following
  if (currentUser.following.includes(targetUserId)) {
    res.status(400);
    throw new Error('Already following this user');
  }

  // Use updateOne to bypass validation issues with admin accounts
  await User.updateOne(
    { _id: req.user._id },
    { $addToSet: { following: targetUserId } }
  );
  
  await User.updateOne(
    { _id: targetUserId },
    { $addToSet: { followers: req.user._id } }
  );

  // Create notification for the followed user
  await createNotification(
    targetUserId,
    req.user._id,
    'follow',
    'started following you'
  );

  res.json({
    message: 'Successfully followed user',
    isFollowing: true,
    canMessage: true
  });
});

// @desc    Unfollow a user
// @route   POST /api/profile/:id/unfollow
// @access  Private
const unfollowUser = asyncHandler(async (req, res) => {
  const targetUserId = req.params.id;
  
  const targetUser = await User.findById(targetUserId);
  if (!targetUser) {
    res.status(404);
    throw new Error('User not found');
  }

  const currentUser = await User.findById(req.user._id);

  // Check if currently following
  if (!currentUser.following.includes(targetUserId)) {
    res.status(400);
    throw new Error('Not following this user');
  }

  // Use updateOne to bypass validation issues with admin accounts
  await User.updateOne(
    { _id: req.user._id },
    { $pull: { following: targetUserId } }
  );
  
  await User.updateOne(
    { _id: targetUserId },
    { $pull: { followers: req.user._id } }
  );

  res.json({
    message: 'Successfully unfollowed user',
    isFollowing: false,
    canMessage: false
  });
});

export { 
  getUserProfile, 
  updateUserProfile, 
  uploadProfilePicture, 
  changePassword, 
  getCurrentUserProfile,
  getFollowingList,
  searchUsers,
  followUser,
  unfollowUser,
  testUsers
};
