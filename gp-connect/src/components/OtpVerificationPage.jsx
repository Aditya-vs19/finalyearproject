import React, { useState, useEffect } from 'react';
import './LoginPage.css';
import { authAPI } from '../services/api';

// Add Dancing Script font import
const style = document.createElement('style');
style.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&display=swap');
`;

function OtpVerificationPage({ email, onVerificationSuccess, onBackToRegister }) {
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleOtpChange = (e) => {
    const value = e.target.value.replace(/\D/g, ''); // Only allow digits
    if (value.length <= 6) {
      setOtp(value);
      setError('');
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      setIsLoading(false);
      return;
    }

    try {
      const response = await authAPI.verifyOtp({ email, otp });
      console.log('OTP verification successful:', response.data);
      localStorage.setItem('token', response.data.token);
      onVerificationSuccess();
    } catch (error) {
      console.error('OTP verification failed:', error.response?.data || error.message);
      const errorMessage = error.response?.data?.message || 'OTP verification failed. Please try again.';
      setError(errorMessage);
    }
    setIsLoading(false);
  };

  const handleResendOtp = async () => {
    setError('');
    setIsLoading(true);
    
    try {
      
      alert('Please register again to receive a new OTP.');
      onBackToRegister();
    } catch (error) {
      setError('Failed to resend OTP. Please try again.');
    }
    setIsLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-header">
        <h1 className="brand-gradient">GP‑ConnecX</h1>
      </div>
      <form onSubmit={handleVerifyOtp} className="auth-card register-card">
        <h2 className="auth-title">Verify Your Email</h2>
        <p className="auth-subtitle">
          We've sent a 6-digit verification code to <strong>{email}</strong>
        </p>
        
        <div className="otp-input-container">
          <input
            className="auth-input otp-input"
            type="text"
            placeholder="Enter 6-digit OTP"
            value={otp}
            onChange={handleOtpChange}
            maxLength={6}
            style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '8px' }}
          />
        </div>

        {timeLeft > 0 && (
          <p className="timer-text">
            OTP expires in: <span style={{ color: '#007bff', fontWeight: 'bold' }}>{formatTime(timeLeft)}</span>
          </p>
        )}

        {error && <div className="auth-error">{error}</div>}
        
        <button 
          className="auth-button" 
          type="submit" 
          disabled={isLoading || otp.length !== 6}
        >
          {isLoading ? 'Verifying...' : 'Verify OTP'}
        </button>

        {canResend && (
          <button 
            type="button" 
            className="auth-link-button" 
            onClick={handleResendOtp}
            disabled={isLoading}
          >
            Resend OTP
          </button>
        )}

        <p className="auth-footer-text">
          Didn't receive the email? Check your spam folder or{' '}
          <span className="auth-link" onClick={onBackToRegister}>try again</span>
        </p>
      </form>
    </div>
  );
}

export default OtpVerificationPage;
