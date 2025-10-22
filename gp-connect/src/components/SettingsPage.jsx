import React, { useState, useEffect } from 'react';
import './SettingsPage.css';
import { FaSignOutAlt, FaArrowLeft, FaUser, FaEnvelope, FaGraduationCap, FaBuilding, FaLock, FaShieldAlt, FaCalendarAlt, FaEye, FaEyeSlash } from 'react-icons/fa';
import { profileAPI } from '../services/api';

const SettingsPage = ({ onLogout, onBackToProfile, isMobile }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        setLoading(true);
        const response = await profileAPI.getCurrentUserProfile();
        setCurrentUser(response.data.user);
      } catch (error) {
        console.error('Error fetching user:', error);
        setMessage({ type: 'error', text: 'Failed to load user data' });
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentUser();
  }, []);

  const handlePasswordInputChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'New password must be at least 6 characters long' });
      return;
    }

    try {
      await profileAPI.changePassword(currentUser._id, {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });

      setMessage({ type: 'success', text: 'Password changed successfully!' });
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });

      // Close modal after successful password change
      setTimeout(() => {
        setShowPasswordModal(false);
        setMessage({ type: '', text: '' });
      }, 2000);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to change password'
      });
    }
  };

  const handleLogout = () => {
    const confirmed = window.confirm('Are you sure you want to logout?');
    if (confirmed) {
      onLogout();
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not available';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="settings-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading your settings...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="settings-page">
        <div className="error-container">
          <p>Error loading user data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-container">
        {isMobile && (
          <button className="mobile-back-btn" onClick={onBackToProfile}>
            <FaArrowLeft />
          </button>
        )}

        {/* Settings Header */}
        <div className="settings-header">
          <div className="settings-header-content">
            <h1 className="settings-title">Account Settings</h1>
            <p className="settings-subtitle">Manage your account information and security</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="settings-content">
          {/* Profile Overview Card */}
          <div className="profile-overview-card">
            <div className="profile-avatar">
              <div className="avatar-circle">
                {currentUser.profilePic ? (
                  <img src={currentUser.profilePic} alt="Profile" />
                ) : (
                  <span className="avatar-initials">
                    {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : currentUser.email.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </div>
            <div className="profile-info">
              <h2 className="profile-name">{currentUser.fullName || 'User'}</h2>
              <p className="profile-email">{currentUser.email}</p>
              <div className="profile-status">
                <span className={`status-badge ${currentUser.isVerified ? 'verified' : 'unverified'}`}>
                  <FaShieldAlt />
                  {currentUser.isVerified ? 'Verified Account' : 'Unverified Account'}
                </span>
              </div>
            </div>
          </div>

          {/* Account Information */}
          <div className="info-section">
            <h3 className="section-title">
              <FaUser />
              Account Information
            </h3>
            <div className="info-grid">
              <div className="info-card">
                <div className="info-icon">
                  <FaEnvelope />
                </div>
                <div className="info-content">
                  <label>Email Address</label>
                  <p>{currentUser.email}</p>
                </div>
              </div>

              <div className="info-card">
                <div className="info-icon">
                  <FaGraduationCap />
                </div>
                <div className="info-content">
                  <label>Enrollment Number</label>
                  <p>{currentUser.enrollment}</p>
                </div>
              </div>

              <div className="info-card">
                <div className="info-icon">
                  <FaBuilding />
                </div>
                <div className="info-content">
                  <label>Department</label>
                  <p>{currentUser.department || 'Not specified'}</p>
                </div>
              </div>

              <div className="info-card">
                <div className="info-icon">
                  <FaCalendarAlt />
                </div>
                <div className="info-content">
                  <label>Member Since</label>
                  <p>{formatDate(currentUser.createdAt)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Security Section */}
          <div className="security-section">
            <h3 className="section-title">
              <FaLock />
              Security & Privacy
            </h3>
            <div className="security-actions">
              <button
                className="change-password-btn"
                onClick={() => setShowPasswordModal(true)}
              >
                <FaLock />
                <div className="btn-content">
                  <span className="btn-title">Change Password</span>
                  <span className="btn-subtitle">Update your account password</span>
                </div>
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="danger-section">
            <h3 className="section-title danger">
              <FaSignOutAlt />
              Account Actions
            </h3>
            <div className="danger-actions">
              <button className="logout-btn" onClick={handleLogout}>
                <FaSignOutAlt />
                <div className="btn-content">
                  <span className="btn-title">Sign Out</span>
                  <span className="btn-subtitle">Sign out of your account</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="password-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Change Password</h3>
              <button
                className="modal-close"
                onClick={() => setShowPasswordModal(false)}
              >
                ×
              </button>
            </div>

            {message.text && (
              <div className={`message ${message.type}`}>
                {message.text}
              </div>
            )}

            <form onSubmit={handlePasswordSave} className="password-form">
              <div className="form-group">
                <label>Current Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    name="currentPassword"
                    value={passwordData.currentPassword}
                    onChange={handlePasswordInputChange}
                    required
                    className="form-input"
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>New Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    name="newPassword"
                    value={passwordData.newPassword}
                    onChange={handlePasswordInputChange}
                    required
                    minLength="6"
                    className="form-input"
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Confirm New Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordInputChange}
                    required
                    minLength="6"
                    className="form-input"
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowPasswordModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="save-btn">
                  <FaLock />
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage; 