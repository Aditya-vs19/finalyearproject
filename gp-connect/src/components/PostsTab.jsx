import React, { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash, FaImage, FaTimes } from 'react-icons/fa';
import { postsAPI } from '../services/api';
import './PostsTab.css';

const PostsTab = ({ userProfile, currentUser, isOwnProfile }) => {
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

  useEffect(() => {
    fetchPosts();
  }, [userProfile]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const response = await postsAPI.getUserPosts(userProfile._id);
      setPosts(response.data);
    } catch (error) {
      console.error('Error fetching posts:', error);
      setMessage({ type: 'error', text: 'Failed to load posts' });
    } finally {
      setLoading(false);
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

  const handleDelete = async (postId) => {
    if (window.confirm('Are you sure you want to delete this post?')) {
      try {
        await postsAPI.deletePost(postId);
        setMessage({ type: 'success', text: 'Post deleted successfully!' });
        fetchPosts();
      } catch (error) {
        setMessage({ 
          type: 'error', 
          text: error.response?.data?.message || 'Failed to delete post' 
        });
      }
    }
  };

  const handleCancel = () => {
    setShowCreateForm(false);
    setEditingPost(null);
    setFormData({ caption: '', image: null });
    setImagePreview(null);
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
                    src={post.userId.profilePic || '/default-avatar.svg'}
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
                {isOwnProfile && (
                  <div className="post-actions">
                    <button 
                      onClick={() => handleEdit(post)}
                      className="action-btn edit-btn"
                      title="Edit post"
                    >
                      <FaEdit />
                    </button>
                    <button 
                      onClick={() => handleDelete(post._id)}
                      className="action-btn delete-btn"
                      title="Delete post"
                    >
                      <FaTrash />
                    </button>
                  </div>
                )}
              </div>
              
              <div className="post-content">
                <p>{post.caption}</p>
                {post.image && (
                  <div className="post-image">
                    <img 
                      src={`http://localhost:5000${post.image}`} 
                      alt="Post" 
                    />
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PostsTab;
