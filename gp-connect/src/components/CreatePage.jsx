import React, { useState } from 'react';
import './CreatePage.css';
import { FaImage } from 'react-icons/fa';
import { postsAPI } from '../services/api';

export default function CreatePage() {
  const [postText, setPostText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isPosting, setIsPosting] = useState(false);
  const [postMessage, setPostMessage] = useState({ type: '', text: '' });

  const handleImageSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handlePost = async () => {
    if (!postText.trim() && !selectedImage) {
      setPostMessage({ type: 'error', text: 'Please add some text or an image to your post' });
      return;
    }

    setIsPosting(true);
    setPostMessage({ type: '', text: '' });
    
    const formData = new FormData();
    formData.append('caption', postText);
    if (selectedImage) {
      formData.append('image', selectedImage);
    }

    try {
      const response = await postsAPI.createPost(formData);
      console.log('Post created:', response.data);
      
      // Reset form
      setPostText('');
      setSelectedImage(null);
      setImagePreview(null);
      setIsPosting(false);
      
      setPostMessage({ type: 'success', text: 'Post created successfully!' });
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setPostMessage({ type: '', text: '' });
      }, 3000);

      // Refresh the page to show the new post in the feed
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error creating post:', error);
      setPostMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to create post. Please try again.' 
      });
      setIsPosting(false);
    }
  };



  return (
    <div className="create-page">
      <div className="create-container">
        <div className="create-header">
          <h2>Create Post</h2>
          <p>Share what's on your mind</p>
        </div>

        <div className="create-form">
          {postMessage.text && (
            <div className={`post-message ${postMessage.type}`}>
              {postMessage.text}
            </div>
          )}
          
          <div className="post-input-section">
            <textarea
              className="post-textarea"
              placeholder="What's happening?"
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              maxLength={500}
            />
            <div className="char-count">
              {postText.length}/500
            </div>
          </div>

          {imagePreview && (
            <div className="image-preview-section">
              <img src={imagePreview} alt="Preview" className="image-preview" />
              <button className="remove-image-btn" onClick={handleRemoveImage}>
                ×
              </button>
            </div>
          )}

          <div className="create-actions">
            <div className="action-buttons">
              <label className="action-btn image-btn">
                <FaImage />
                <span>Add Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>

          <div className="post-button-section">
            <button
              className={`post-btn ${(!postText.trim() && !selectedImage) || isPosting ? 'disabled' : ''}`}
              onClick={handlePost}
              disabled={(!postText.trim() && !selectedImage) || isPosting}
            >
              {isPosting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>

        <div className="create-tips">
          <h4>Tips for better posts:</h4>
          <ul>
            <li>Share your thoughts and experiences</li>
            <li>Add relevant images to make your post engaging</li>
            <li>Use appropriate privacy settings</li>
            <li>Be respectful and positive</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 