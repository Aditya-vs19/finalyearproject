import React, { useState } from 'react';
import './LoginPage.css';
import { FaArrowLeft, FaEnvelope, FaCheckCircle } from 'react-icons/fa';
import { authAPI } from '../services/api';

const style = document.createElement('style');
style.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&display=swap');
`;
document.head.appendChild(style);

function ForgotPasswordPage({ onNavigate }) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const response = await authAPI.requestPasswordOtp({ email: normalizedEmail });
      setSuccessMessage(response.data?.message || 'If that email exists, an OTP has been sent.');
      setEmail(normalizedEmail);
      setIsSuccess(true);
    } catch (apiError) {
      console.error('Failed to request password OTP:', apiError.response?.data || apiError.message);
      const apiMessage = apiError.response?.data?.message || 'Unable to process your request right now. Please try again later.';
      setError(apiMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    onNavigate('login');
  };

  const handleContinueToOtp = () => {
    onNavigate('otp', { email });
  };

  if (isSuccess) {
    return (
      <div className="auth-container">
        {/* Harbor Haze live background */}
        <div className="auth-bg">
          <div className="particle p1"></div>
          <div className="particle p2"></div>
          <div className="particle p3"></div>
          <div className="particle p4"></div>
        </div>

        {/* Small gradient blobs positioned away from logo */}
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
            <h2 className="auth-title" style={{ fontSize: '2.2rem', marginBottom: '2rem' }}>OTP Sent!</h2>
            <p style={{ color: '#e2e8f0', marginBottom: '1.5rem', lineHeight: '1.6', fontSize: '1.1rem' }}>{successMessage}</p>
            <p style={{ color: '#f8fafc', fontWeight: '600', background: 'rgba(92, 141, 197, 0.15)', padding: '1rem 1.5rem', borderRadius: '12px', display: 'inline-block', margin: '1.5rem 0', fontSize: '1.1rem', border: '1px solid rgba(92, 141, 197, 0.3)' }}>{email}</p>
            <p style={{ fontSize: '1rem', color: '#94a3b8', marginBottom: '3rem', lineHeight: '1.5', maxWidth: '500px', margin: '0 auto 3rem auto' }}>
              Enter the 6-digit code we just emailed you to verify your identity. Codes expire in 5 minutes.
            </p>
            <button className="auth-button" onClick={handleContinueToOtp} style={{ marginBottom: '1.5rem', maxWidth: '300px', margin: '0 auto 1.5rem auto', display: 'block', padding: '1.2rem', fontSize: '1.2rem' }}>
              Enter OTP
            </button>
            <button className="auth-link-button" onClick={handleBackToLogin} style={{ fontSize: '1rem', padding: '0.8rem 1.5rem' }}>
              <FaArrowLeft style={{ marginRight: '0.5rem' }} /> Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      {/* Harbor Haze live background */}
      <div className="auth-bg">
        <div className="particle p1"></div>
        <div className="particle p2"></div>
        <div className="particle p3"></div>
        <div className="particle p4"></div>
      </div>

      {/* Small gradient blobs positioned away from logo */}
      <div className="gradient-blob blob-2"></div>
      <div className="gradient-blob blob-3"></div>
      <div className="gradient-blob blob-4"></div>
      <div className="gradient-blob blob-5"></div>

      <div className="auth-header">
        <h1 className="brand-gradient">GP‑ConnecX</h1>
      </div>

      <form onSubmit={handleReset} className="auth-card register-card">
        <h2 className="auth-title" style={{ fontSize: '2rem', marginBottom: '2rem' }}>Forgot Password</h2>
        <p style={{ textAlign: 'center', color: '#94a3b8', marginBottom: '3rem', fontSize: '1.1rem', lineHeight: '1.5' }}>
          Enter your email address and we'll send you a one-time login code to reset your password
        </p>

        <div style={{ position: 'relative', marginBottom: '2rem', maxWidth: '500px', margin: '0 auto 2rem auto' }}>
          <FaEnvelope style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '1.2rem', zIndex: 1 }} />
          <input
            type="email"
            className={`auth-input ${error ? 'auth-input-error' : ''}`}
            placeholder="Enter your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ paddingLeft: '3.5rem', fontSize: '1.1rem', padding: '1.2rem 1.2rem 1.2rem 3.5rem' }}
          />
        </div>

        {error && <div className="auth-error" style={{ textAlign: 'center', fontSize: '1rem', marginBottom: '1.5rem' }}>{error}</div>}

        <button
          type="submit"
          className="auth-button"
          disabled={isLoading}
          style={{ maxWidth: '300px', margin: '0 auto', display: 'block', padding: '1.2rem', fontSize: '1.2rem' }}
        >
          {isLoading ? 'Sending...' : 'Send OTP'}
        </button>

        <p className="auth-footer-text" style={{ fontSize: '1rem', marginTop: '2rem' }}>
          Remember your password?
          <span className="auth-link" onClick={handleBackToLogin} style={{ marginLeft: '0.5rem' }}>
            Back to Login
          </span>
        </p>

        <div style={{ marginTop: '3rem', padding: '2rem', background: 'rgba(92, 141, 197, 0.1)', borderRadius: '16px', border: '1px solid rgba(92, 141, 197, 0.2)' }}>
          <h4 style={{ color: '#e2e8f0', marginBottom: '1.5rem', fontSize: '1.2rem', textAlign: 'center' }}>Need Help?</h4>
          <ul style={{ color: '#94a3b8', margin: '0', paddingLeft: '1.5rem', fontSize: '1rem' }}>
            <li style={{ marginBottom: '0.8rem', lineHeight: '1.5' }}>Check your spam folder if you don't see the email</li>
            <li style={{ marginBottom: '0.8rem', lineHeight: '1.5' }}>Make sure you're using the email associated with your account</li>
            <li style={{ lineHeight: '1.5' }}>Contact support if you continue to have issues</li>
          </ul>
        </div>
      </form>
    </div>
  );
}

export default ForgotPasswordPage;
