import React, { useState, useEffect } from 'react';
import { FaPlus, FaTrash, FaTimes } from 'react-icons/fa';
import { postsAPI, profileAPI } from '../services/api';
import PostImage from './PostImage.jsx';
import ImageErrorBoundary, { useImageErrorHandler } from './ImageErrorBoundary.jsx';
import { globalImageErrorHandler } from '../services/imageErrorHandler.js';
import PrivatePostsLock from './PrivatePostsLock';
import './PostsTab.css';

const PostsTab = ({ userProfile, isOwnProfile, currentUser, onFollowUpdate }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Delete functionality states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [postToDelete, setPostToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
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

  const handleDeleteClick = (post) => {
    setPostToDelete(post);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!postToDelete) return;

    try {
      setIsDeleting(true);
      await postsAPI.deletePost(postToDelete._id);
      
      // Remove the post from the local state
      setPosts(prevPosts => prevPosts.filter(post => post._id !== postToDelete._id));
      
      setMessage({ type: 'success', text: 'Post deleted successfully!' });
      setShowDeleteModal(false);
      setPostToDelete(null);
    } catch (error) {
      console.error('Error deleting post:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to delete post. Please try again.'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setPostToDelete(null);
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

      </div>

      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
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
                  
                  {/* Delete button - only show for own posts */}
                  {isOwnProfile && currentUser && post.userId._id === currentUser._id && (
                    <button
                      className="delete-post-btn"
                      onClick={() => handleDeleteClick(post)}
                      title="Delete post"
                    >
                      <FaTrash />
                    </button>
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
      {showDeleteModal && (
        <div className="delete-modal-overlay" onClick={handleDeleteCancel}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Post</h3>
              <button className="modal-close-btn" onClick={handleDeleteCancel}>
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this post? This action cannot be undone.</p>
              {postToDelete?.caption && (
                <div className="post-preview">
                  <p>"{postToDelete.caption.length > 100 ? postToDelete.caption.substring(0, 100) + '...' : postToDelete.caption}"</p>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button 
                className="btn btn-secondary" 
                onClick={handleDeleteCancel}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button 
                className="btn btn-danger" 
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Post'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PostsTab;
