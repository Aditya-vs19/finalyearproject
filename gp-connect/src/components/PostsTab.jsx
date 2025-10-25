import React, { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash, FaImage, FaTimes, FaExclamationTriangle } from 'react-icons/fa';
import { postsAPI, profileAPI } from '../services/api';
import PostImage from './PostImage.jsx';
import ImageErrorBoundary, { useImageErrorHandler } from './ImageErrorBoundary.jsx';
import { globalImageErrorHandler } from '../services/imageErrorHandler.js';
import PrivatePostsLock from './PrivatePostsLock';
import './PostsTab.css';

const PostsTab = ({ userProfile, isOwnProfile, currentUser, onFollowUpdate }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [formData, setFormData] = useState({
    caption: '',
    image: null
  });
  const [imagePreview, setImagePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, postId: null, postCaption: '' });
  const [deleting, setDeleting] = useState(null);
  
  // Privacy control states
  const [isFollowing, setIsFollowing] = useState(false);
  const [showLockedState, setShowLockedState] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  
  // Image error handling
  const imageErrorHandler = useImageErrorHandler({
    componentName: 'PostsTab',
    onError: (error, context) => {
      console.error('PostsTab image error:', error, context);
      setMessage({ 
        type: 'warning', 
        text: 'Some images failed to load. They will be retried automatically.' 
      });
    }
  });


  useEffect(() => {
    if (userProfile && currentUser) {
      checkFollowStatusAndFetchPosts();
    }
  }, [userProfile, currentUser]);

  const checkFollowStatusAndFetchPosts = async () => {
    try {
      setLoading(true);
      setMessage({ type: '', text: '' });

      // Check if userProfile exists
      if (!userProfile || !userProfile._id) {
        setMessage({ type: 'error', text: 'User profile not found' });
        return;
      }

      // If viewing own profile, always show posts
      if (isOwnProfile) {
        setShowLockedState(false);
        await fetchPosts();
        return;
      }

      // If viewing super admin profile, always show posts (they are public)
      const isSuperAdmin = userProfile.isAdmin === true && userProfile.adminLevel === 'super';
      if (isSuperAdmin) {
        setShowLockedState(false);
        await fetchPosts();
        return;
      }

      // Check follow status for regular users
      if (currentUser && currentUser.following) {
        const following = currentUser.following.includes(userProfile._id);
        setIsFollowing(following);
        
        if (following) {
          setShowLockedState(false);
          await fetchPosts();
        } else {
          setShowLockedState(true);
          setPosts([]);
        }
      } else {
        // If no current user context, try to fetch posts and handle 403
        await fetchPosts();
      }

    } catch (error) {
      console.error('Error checking follow status:', error);
      setMessage({ type: 'error', text: 'Failed to load profile data' });
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async () => {
    try {
      // Check if userProfile exists
      if (!userProfile || !userProfile._id) {
        setMessage({ type: 'error', text: 'User profile not found' });
        return;
      }

      const response = await postsAPI.getUserPosts(userProfile._id);
      const fetchedPosts = response.data || [];
      setPosts(fetchedPosts);
      setShowLockedState(false);

    } catch (error) {
      console.error('Error fetching posts:', error);
      
      // Handle 403 error - user needs to follow to see posts
      if (error.response?.status === 403) {
        setShowLockedState(true);
        setPosts([]);
        setMessage({ type: '', text: '' }); // Clear any error messages for privacy state
      } else if (error.response?.status === 404) {
        setMessage({ type: 'error', text: 'User not found' });
      } else if (error.response?.status === 401) {
        setMessage({ type: 'error', text: 'Please log in again' });
      } else {
        setMessage({ type: 'error', text: 'Failed to load posts' });
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData(prev => ({
        ...prev,
        image: file
      }));

      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const submitData = new FormData();
      submitData.append('caption', formData.caption);
      if (formData.image) {
        submitData.append('image', formData.image);
      }

      if (editingPost) {
        await postsAPI.updatePost(editingPost._id, submitData);
        setMessage({ type: 'success', text: 'Post updated successfully!' });
      } else {
        await postsAPI.createPost(submitData);
        setMessage({ type: 'success', text: 'Post created successfully!' });
      }

      setFormData({ caption: '', image: null });
      setImagePreview(null);
      setShowCreateForm(false);
      setEditingPost(null);
      fetchPosts();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to save post'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (post) => {
    setEditingPost(post);
    setFormData({
      caption: post.caption || '',
      image: null
    });
    setImagePreview(post.image || null);
    setShowCreateForm(true);
  };

  const handleDeleteClick = (post) => {
    setDeleteConfirm({
      show: true,
      postId: post._id,
      postCaption: post.caption
    });
  };

  const handleDeleteConfirm = async () => {
    const postId = deleteConfirm.postId;
    setDeleting(postId);

    try {
      await postsAPI.deletePost(postId);
      setMessage({ type: 'success', text: 'Post deleted successfully!' });
      fetchPosts();
      setDeleteConfirm({ show: false, postId: null, postCaption: '' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to delete post'
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ show: false, postId: null, postCaption: '' });
  };

  const handleCancel = () => {
    setShowCreateForm(false);
    setEditingPost(null);
    setFormData({ caption: '', image: null });
    setImagePreview(null);
  };

  const handleFollowClick = async () => {
    if (!userProfile || !currentUser) return;

    try {
      setIsFollowLoading(true);
      setMessage({ type: '', text: '' });

      await profileAPI.followUser(userProfile._id);
      
      // Update follow status
      setIsFollowing(true);
      
      // Notify parent component about follow update
      if (onFollowUpdate) {
        onFollowUpdate(true);
      }
      
      // Immediately fetch posts after successful follow
      await fetchPosts();
      
      setMessage({ type: 'success', text: `You are now following ${userProfile.fullName}` });

    } catch (error) {
      console.error('Error following user:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to follow user'
      });
    } finally {
      setIsFollowLoading(false);
    }
  };



  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="posts-tab">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading posts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="posts-tab">
      <div className="posts-header">
        <h3>
          {isOwnProfile ? 'My Posts' : `${userProfile.fullName}'s Posts`}
        </h3>
        {isOwnProfile && (
          <button
            className="create-post-btn"
            onClick={() => setShowCreateForm(true)}
          >
            <FaPlus /> Create Post
          </button>
        )}
      </div>

      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      {showCreateForm && (
        <div className="create-post-form">
          <div className="form-header">
            <h4>{editingPost ? 'Edit Post' : 'Create New Post'}</h4>
            <button onClick={handleCancel} className="close-btn">
              <FaTimes />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <textarea
                name="caption"
                value={formData.caption}
                onChange={handleInputChange}
                placeholder="What's on your mind?"
                rows="4"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="image" className="file-input-label">
                <FaImage /> Add Image (Optional)
              </label>
              <input
                type="file"
                id="image"
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: 'none' }}
              />
              {imagePreview && (
                <div className="image-preview">
                  <img src={imagePreview} alt="Preview" />
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      setFormData(prev => ({ ...prev, image: null }));
                    }}
                    className="remove-image-btn"
                  >
                    <FaTimes />
                  </button>
                </div>
              )}
            </div>

            <div className="form-actions">
              <button
                type="button"
                onClick={handleCancel}
                className="btn btn-secondary"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? 'Saving...' : (editingPost ? 'Update Post' : 'Create Post')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Show locked state for private posts */}
      {showLockedState && !isOwnProfile && (
        <PrivatePostsLock
          targetUser={userProfile}
          onFollowClick={handleFollowClick}
          isFollowLoading={isFollowLoading}
        />
      )}

      {/* Show posts list when not locked */}
      {!showLockedState && (
        <div className="posts-list">
          {posts.length === 0 ? (
            <div className="no-posts">
              <p>{isOwnProfile ? "You haven't created any posts yet." : "No posts yet."}</p>
              {isOwnProfile && (
                <button
                  className="btn btn-primary"
                  onClick={() => setShowCreateForm(true)}
                >
                  <FaPlus /> Create Your First Post
                </button>
              )}
            </div>
          ) : (
            posts.map(post => (
              <div key={post._id} className="post-item">
                <div className="post-header">
                  <div className="post-user-info">
                    <img
                      src={post.userId.profilePic ? `${post.userId.profilePic}?t=${Date.now()}` : '/default-avatar.svg'}
                      alt="Profile"
                      className="post-user-avatar"
                      onError={(e) => {
                        e.target.src = '/default-avatar.svg';
                      }}
                    />
                    <div>
                      <h5>{post.userId.fullName}</h5>
                      <p className="post-time">{formatDate(post.createdAt)}</p>
                    </div>
                  </div>
                  {/* Only show edit/delete buttons if this is the current user's post */}
                  {currentUser && post.userId && post.userId._id === currentUser._id && (
                    <div className="post-actions">
                      <button
                        onClick={() => handleEdit(post)}
                        className="action-btn edit-btn"
                        title="Edit post"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(post)}
                        className="action-btn delete-btn"
                        title="Delete post"
                        disabled={deleting === post._id}
                      >
                        {deleting === post._id ? (
                          <div className="mini-spinner"></div>
                        ) : (
                          <FaTrash />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <div className="post-content">
                  <p>{post.caption}</p>
                  {post.image && (
                    <div className="post-image">
                      <ImageErrorBoundary
                        imageUrl={post.image}
                        componentName="PostsTab-PostImage"
                        imageType="post"
                        onError={(error) => {
                          imageErrorHandler.handleError(error, {
                            postId: post._id,
                            imageUrl: post.image,
                            userId: post.userId._id
                          });
                        }}
                      >
                        <PostImage
                          src={post.image}
                          alt={`Post by ${post.userId.fullName}`}
                          className="post-img"
                          maxRetries={3}
                          retryDelay={1000}
                          showRetryButton={true}
                          onLoad={() => {
                            console.log(`Image loaded successfully for post ${post._id}`);
                            imageErrorHandler.clearError();
                          }}
                          onError={(error) => {
                            console.error(`Image failed to load for post ${post._id}:`, error);
                            imageErrorHandler.handleError(error, {
                              postId: post._id,
                              imageUrl: post.image,
                              userId: post.userId._id
                            });
                          }}
                        />
                      </ImageErrorBoundary>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && (
        <div className="modal-overlay">
          <div className="delete-modal">
            <div className="modal-header">
              <div className="modal-title">
                <FaExclamationTriangle className="warning-icon" />
                <h3>Delete Post</h3>
              </div>
              <button onClick={handleDeleteCancel} className="modal-close">
                <FaTimes />
              </button>
            </div>

            <div className="modal-body">
              <p>Are you sure you want to delete this post? This action cannot be undone.</p>
              {deleteConfirm.postCaption && (
                <div className="post-preview">
                  <strong>Post:</strong> "{deleteConfirm.postCaption.length > 100
                    ? deleteConfirm.postCaption.substring(0, 100) + '...'
                    : deleteConfirm.postCaption}"
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button
                onClick={handleDeleteCancel}
                className="btn btn-secondary"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="btn btn-danger"
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <div className="mini-spinner"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <FaTrash />
                    Delete Post
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostsTab;
