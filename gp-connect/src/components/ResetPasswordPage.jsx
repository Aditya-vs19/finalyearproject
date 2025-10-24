import React, { useState } from 'react';
import './LoginPage.css';
import { FaLock, FaEye, FaEyeSlash, FaCheckCircle } from 'react-icons/fa';
import { authAPI } from '../services/api';

const style = document.createElement('style');
style.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&display=swap');
`;
document.head.appendChild(style);

function ResetPasswordPage({ email, resetToken, onPasswordReset }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const validatePassword = (password) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (password.length < minLength) {
      return 'Password must be at least 8 characters long';
    }
    if (!hasUpperCase || !hasLowerCase) {
      return 'Password must contain both uppercase and lowercase letters';
    }
    if (!hasNumber) {
      return 'Password must contain at least one number';
    }
    if (!hasSpecialChar) {
      return 'Password must contain at least one special character';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const response = await authAPI.resetPassword({
        email: email.trim().toLowerCase(),
        newPassword,
        token: resetToken,
      });

      setIsSuccess(true);
      
      // Auto-redirect to login after 3 seconds
      setTimeout(() => {
        onPasswordReset();
      }, 3000);
    } catch (apiError) {
      console.error('Failed to reset password:', apiError.response?.data || apiError.message);
      const apiMessage = apiError.response?.data?.message || 'Failed to reset password. Please try again.';
      setError(apiMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="auth-container">
        <div className="auth-bg">
          <div className="particle p1"></div>
          <div className="particle p2"></div>
          <div className="particle p3"></div>
          <div className="particle p4"></div>
        </div>

        <div className="gradient-blob blob-2"></div>
        <div className="gradient-blob blob-3"></div>
        <div className="gradient-blob blob-4"></div>
        <div className="gradient-blob blob-5"></div>

        <div className="auth-header">
          <h1 className="brand-gradient">GP‑ConnecX</h1>
        </div>

        <div className="auth-card register-card">
          <div style={{ textAlign: 'center' }}>
            <FaCheckCircle style={{ fontSize: '5rem', color: '#22c55e', marginBottom: '2rem' }} />
            <h2 className="auth-title" style={{ fontSize: '2.2rem', marginBottom: '2rem' }}>
              Password Reset Successful!
            </h2>
            <p style={{ color: '#e2e8f0', marginBottom: '1.5rem', lineHeight: '1.6', fontSize: '1.1rem' }}>
              Your password has been successfully reset.
            </p>
            <p style={{ color: '#94a3b8', marginBottom: '3rem', fontSize: '1rem' }}>
              Redirecting you to login page...
            </p>
            <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-bg">
        <div className="particle p1"></div>
        <div className="particle p2"></div>
        <div className="particle p3"></div>
        <div className="particle p4"></div>
      </div>

      <div className="gradient-blob blob-2"></div>
      <div className="gradient-blob blob-3"></div>
      <div className="gradient-blob blob-4"></div>
      <div className="gradient-blob blob-5"></div>

      <div className="auth-header">
        <h1 className="brand-gradient">GP‑ConnecX</h1>
      </div>

      <form onSubmit={handleSubmit} className="auth-card register-card">
        <h2 className="auth-title" style={{ fontSize: '2rem', marginBottom: '1rem' }}>
          Reset Your Password
        </h2>
        <p style={{ textAlign: 'center', color: '#94a3b8', marginBottom: '2.5rem', fontSize: '1rem', lineHeight: '1.5' }}>
          Create a strong password for your account: <strong style={{ color: '#f8fafc' }}>{email}</strong>
        </p>

        {/* New Password */}
        <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
          <FaLock
            style={{
              position: 'absolute',
              left: '1.2rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8',
              fontSize: '1.2rem',
              zIndex: 1,
            }}
          />
          <input
            type={showPassword ? 'text' : 'password'}
            className={`auth-input ${error && error.includes('Password') ? 'auth-input-error' : ''}`}
            placeholder="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            style={{ paddingLeft: '3.5rem', paddingRight: '3.5rem', fontSize: '1rem' }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: '1.2rem',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '1.2rem',
              padding: '0.5rem',
            }}
          >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>

        {/* Confirm Password */}
        <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
          <FaLock
            style={{
              position: 'absolute',
              left: '1.2rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8',
              fontSize: '1.2rem',
              zIndex: 1,
            }}
          />
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            className={`auth-input ${error && error.includes('match') ? 'auth-input-error' : ''}`}
            placeholder="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            style={{ paddingLeft: '3.5rem', paddingRight: '3.5rem', fontSize: '1rem' }}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            style={{
              position: 'absolute',
              right: '1.2rem',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '1.2rem',
              padding: '0.5rem',
            }}
          >
            {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>

        {/* Password Requirements */}
        <div
          style={{
            background: 'rgba(92, 141, 197, 0.1)',
            border: '1px solid rgba(92, 141, 197, 0.3)',
            borderRadius: '12px',
            padding: '1.2rem',
            marginBottom: '1.5rem',
          }}
        >
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.8rem', fontWeight: '600' }}>
            Password Requirements:
          </p>
          <ul style={{ color: '#cbd5e1', fontSize: '0.85rem', paddingLeft: '1.5rem', margin: 0, lineHeight: '1.8' }}>
            <li>At least 8 characters long</li>
            <li>Contains uppercase and lowercase letters</li>
            <li>Contains at least one number</li>
            <li>Contains at least one special character (!@#$%^&*)</li>
          </ul>
        </div>

        {error && <div className="auth-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}

        <button
          type="submit"
          className="auth-button"
          disabled={isLoading}
          style={{ padding: '1.2rem', fontSize: '1.1rem', marginBottom: '1rem' }}
        >
          {isLoading ? 'Resetting Password...' : 'Reset Password'}
        </button>
      </form>
    </div>
  );
}

export default ResetPasswordPage;
