import React, { useState, useEffect } from 'react';
import { FaEdit, FaArrowLeft, FaEnvelope, FaBuilding, FaCalendarAlt, FaSave, FaTimes, FaCog } from 'react-icons/fa';
import { profileAPI } from '../services/api';
import { getProfilePicUrl, handleImageError } from '../utils/imageUtils.js';
import PostsTab from './PostsTab.jsx';
import SettingsPage from './SettingsPage.jsx';
import './ProfilePage.css';

const ProfilePage = ({ userProfile, onBackToHome, onLogout, onStartChat, isMobile, showSettings, onToggleSettings }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    bio: '',
    department: '',
  });
  const [profilePic, setProfilePic] = useState(null);
  const [profilePicPreview, setProfilePicPreview] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [saving, setSaving] = useState(false);
  const [userStats, setUserStats] = useState({
    totalPosts: 0,
    totalFollowers: 0,
    totalFollowing: 0
  });
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [viewedUser, setViewedUser] = useState(userProfile || null);
  const [canMessageTarget, setCanMessageTarget] = useState(!!userProfile?.canMessage);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        setError(null);

        const currentUserResponse = await profileAPI.getCurrentUserProfile();
        const loggedInUser = currentUserResponse.data.user;
        setCurrentUser(loggedInUser);

        if (userProfile && userProfile._id !== loggedInUser._id) {
          const response = await profileAPI.getUserProfile(userProfile._id);
          const otherUser = response.data.user;
          setViewedUser(otherUser);
          setCanMessageTarget(!!otherUser?.canMessage);
          setUserStats(otherUser.stats || { totalPosts: 0, totalFollowers: 0, totalFollowing: 0 });
          setIsFollowing(response.data.isFollowing || false);
          setProfilePicPreview(null);
        } else {
          setViewedUser(loggedInUser);
          setCanMessageTarget(false);
          setUserStats(loggedInUser.stats || { totalPosts: 0, totalFollowers: 0, totalFollowing: 0 });
          setIsFollowing(false);
          setFormData({
            fullName: loggedInUser.fullName || '',
            bio: loggedInUser.bio || '',
            department: loggedInUser.department || '',
          });
          setProfilePicPreview(getProfilePicUrl(loggedInUser.profilePic));
        }
      } catch (err) {
        console.error('Profile loading error:', err);
        if (err.response?.status === 401 || err.response?.status === 404) {
          // User doesn't exist or token is invalid
          setError('User not found. Please log in again.');
          // Optionally trigger logout
          if (onLogout) {
            setTimeout(() => onLogout(), 2000);
          }
        } else {
          setError(err.message || 'Failed to load profile');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [userProfile]);

  const displayUser = viewedUser || userProfile || currentUser;
  const isOwnProfile = !userProfile || (currentUser && displayUser && currentUser._id === displayUser._id);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleProfilePicChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePic(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfilePicPreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      await profileAPI.updateProfile(currentUser._id, formData);

      if (profilePic) {
        const formDataPic = new FormData();
        formDataPic.append('profilePic', profilePic);
        await profileAPI.uploadProfilePicture(currentUser._id, formDataPic);
      }

      const updatedResponse = await profileAPI.getCurrentUserProfile();
      const updatedUser = updatedResponse.data.user;

      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setIsEditing(false);
      setCurrentUser(updatedUser);
      setViewedUser(updatedUser);
      setCanMessageTarget(false);
      setUserStats(updatedUser.stats || { totalPosts: 0, totalFollowers: 0, totalFollowing: 0 });
      setProfilePicPreview(updatedUser.profilePic ? getProfilePicUrl(updatedUser.profilePic) : null);
      setFormData({
        fullName: updatedUser.fullName || '',
        bio: updatedUser.bio || '',
        department: updatedUser.department || '',
      });
      setProfilePic(null);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to update profile. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFollowToggle = async () => {
    if (isOwnProfile || !userProfile?._id) return;

    setIsFollowLoading(true);
    try {
      if (isFollowing) {
        const response = await profileAPI.unfollowUser(userProfile._id);
        setIsFollowing(false);
        setCanMessageTarget(!!response.data?.canMessage);
        setViewedUser(prev => (prev ? { ...prev, canMessage: !!response.data?.canMessage } : prev));
        setUserStats(prev => ({
          ...prev,
          totalFollowers: Math.max(0, prev.totalFollowers - 1),
        }));
      } else {
        const response = await profileAPI.followUser(userProfile._id);
        setIsFollowing(true);
        setCanMessageTarget(!!response.data?.canMessage);
        setViewedUser(prev => (prev ? { ...prev, canMessage: !!response.data?.canMessage } : prev));
        setUserStats(prev => ({
          ...prev,
          totalFollowers: prev.totalFollowers + 1,
        }));
      }
    } catch (error) {
      console.error('Follow/unfollow error:', error);
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to update follow status. Please try again.' });
    } finally {
      setIsFollowLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="profile-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>{userProfile ? `Loading ${userProfile.fullName}'s profile...` : 'Loading your profile...'}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-page">
        <div className="error-container">
          <p>Error: {error}</p>
          <button onClick={onBackToHome} className="btn btn-primary">
            <FaArrowLeft /> Back to Home
          </button>
        </div>
      </div>
    );
  }

  // If showing settings on mobile, render SettingsPage instead
  if (isMobile && showSettings) {
    return (
      <SettingsPage 
        onLogout={onLogout}
        onBackToProfile={() => onToggleSettings()}
        isMobile={isMobile}
      />
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-content">
        <div className="profile-header">
          <h2 className="profile-title">
            {isOwnProfile ? 'My Profile' : `${displayUser?.fullName || 'User'}'s Profile`}
          </h2>
          {!isOwnProfile && (
            <div className="profile-subtitle">
              @{displayUser?.enrollment}
            </div>
          )}
          {/* Settings button for mobile */}
          {isMobile && isOwnProfile && (
            <button className="mobile-settings-btn" onClick={() => onToggleSettings()}>
              <FaCog />
            </button>
          )}
        </div>

        <div className="profile-info">
          <div className="profile-header-section">
            <div className="profile-picture-container">
              <img
                src={profilePicPreview || getProfilePicUrl(displayUser?.profilePic)}
        alt="Profile"
        className="profile-picture"
                onError={(e) => handleImageError(e, '/default-avatar.svg')}
              />
              {isOwnProfile && isEditing && (
                <div className="profile-pic-upload">
                  <input
                    type="file"
                    id="profilePic"
                    accept="image/*"
                    onChange={handleProfilePicChange}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="profilePic" className="upload-btn">
                    Change Photo
                  </label>
                </div>
              )}
            </div>
            <div className="profile-basic-info">
              <h3>{displayUser?.fullName}</h3>
              <p className="enrollment">Enrollment: {displayUser?.enrollment}</p>
              <p className="email">{displayUser?.email}</p>
              {displayUser?.department && (
                <p className="department">
                  <FaBuilding /> {displayUser.department} Department
                </p>
              )}
              <p className="join-date">
                <FaCalendarAlt /> Joined {formatDate(displayUser?.createdAt)}
              </p>
              
              {/* User Stats */}
              <div className="user-stats">
                <div className="stat-item">
                  <span className="stat-number">{userStats.totalPosts}</span>
                  <span className="stat-label">Posts</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">{userStats.totalFollowers}</span>
                  <span className="stat-label">Followers</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">{userStats.totalFollowing}</span>
                  <span className="stat-label">Following</span>
                </div>
              </div>
            </div>
            {isOwnProfile && !isEditing && (
              <button
                className="edit-profile-btn"
                onClick={() => setIsEditing(true)}
              >
                <FaEdit /> Edit Profile
              </button>
            )}
            {!isOwnProfile && userProfile && (
              <div className="profile-action-buttons">
                <button
                  className={`follow-profile-btn ${isFollowing ? 'following' : 'follow'}`}
                  onClick={handleFollowToggle}
                  disabled={isFollowLoading}
                >
                  {isFollowLoading ? 'Updating...' : (isFollowing ? 'Following' : 'Follow')}
                </button>
                {canMessageTarget && (
                  <button
                    className="message-profile-btn"
                    onClick={() => onStartChat && onStartChat(displayUser?._id || userProfile._id)}
                    disabled={!onStartChat}
                  >
                    <FaEnvelope /> Message
                  </button>
                )}
              </div>
            )}
          </div>

          {message.text && (
            <div className={`message ${message.type}`}>
              {message.text}
            </div>
          )}

          {isEditing ? (
            <form onSubmit={handleSubmit} className="profile-edit-form">
              <div className="form-group">
                <label htmlFor="fullName">Full Name</label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="bio">Bio</label>
                <textarea
                  id="bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleInputChange}
                  placeholder="Tell us about yourself..."
                  rows="4"
                />
              </div>

              <div className="form-group">
                <label htmlFor="department">Department</label>
                <select
                  id="department"
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select Department</option>
                  <option value="Computer">Computer</option>
                  <option value="Mechanical">Mechanical</option>
                  <option value="Civil">Civil</option>
                  <option value="Metallurgy">Metallurgy</option>
                  <option value="IT">IT</option>
                  <option value="Meta">Meta</option>
                </select>
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  onClick={() => setIsEditing(false)}
                  className="btn btn-secondary"
                  disabled={saving}
                >
                  <FaTimes /> Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={saving}
                >
                  <FaSave /> {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            <div className="profile-details">
              {displayUser?.bio && (
                <div className="bio-section">
                  <h4>About</h4>
                  <p>{displayUser.bio}</p>
                </div>
              )}
            </div>
          )}

          {/* Posts Section */}
          <div className="posts-section">
            <PostsTab 
              userProfile={displayUser}
              currentUser={currentUser}
              isOwnProfile={isOwnProfile}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;