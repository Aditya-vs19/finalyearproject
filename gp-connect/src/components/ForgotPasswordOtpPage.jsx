import React, { useEffect, useState } from 'react';
import './LoginPage.css';
import { authAPI } from '../services/api';

const ensureFontLoaded = () => {
  if (!document.head.querySelector('#dancing-script-font')) {
    const fontStyleTag = document.createElement('style');
    fontStyleTag.id = 'dancing-script-font';
    fontStyleTag.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&display=swap');
    `;
    document.head.appendChild(fontStyleTag);
  }
};

ensureFontLoaded();

function ForgotPasswordOtpPage({ email, onOtpVerified, onBackToForgot }) {
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [timeLeft, setTimeLeft] = useState(300);
  const [timerResetKey, setTimerResetKey] = useState(0);

  useEffect(() => {
    if (!email) {
      return;
    }

    setOtp('');
    setError('');
    setInfo('');
    setTimeLeft(300);
    setTimerResetKey((prev) => prev + 1);
  }, [email]);

  useEffect(() => {
    if (!email) {
      return undefined;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [email, timerResetKey]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleOtpChange = (event) => {
    const onlyDigits = event.target.value.replace(/\D/g, '');
    if (onlyDigits.length <= 6) {
      setOtp(onlyDigits);
      setError('');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setInfo('');

    if (otp.length !== 6) {
      setError('Please enter the 6-digit code.');
      return;
    }

    try {
      setIsLoading(true);
      const response = await authAPI.verifyPasswordOtp({ email: email.trim().toLowerCase(), otp });
      const token = response.data?.token;

      if (token) {
        localStorage.setItem('token', token);
      }

      onOtpVerified(response.data?.user);
    } catch (verifyError) {
      console.error('OTP verification failed:', verifyError.response?.data || verifyError.message);
      const message = verifyError.response?.data?.message || 'Invalid or expired OTP. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setInfo('');

    try {
      await authAPI.resendPasswordOtp({ email: email.trim().toLowerCase() });
      setInfo('If that email exists, a new OTP has been sent.');
      setTimeLeft(300);
      setTimerResetKey((prev) => prev + 1);
    } catch (resendError) {
      console.error('Failed to resend OTP:', resendError.response?.data || resendError.message);
      const message = resendError.response?.data?.message || 'Unable to resend OTP right now. Please try later.';
      setError(message);
    }
  };

  if (!email) {
    return (
      <div className="auth-container">
        <div className="auth-card register-card">
          <h2 className="auth-title">We need your email</h2>
          <p className="auth-subtitle">Return to the previous step and enter your email to request an OTP.</p>
          <button className="auth-button" onClick={onBackToForgot}>
            Back to Forgot Password
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-header">
        <h1 className="brand-gradient">GP‑ConnecX</h1>
      </div>
      <form onSubmit={handleSubmit} className="auth-card register-card">
        <h2 className="auth-title">Enter OTP</h2>
        <p className="auth-subtitle">We sent a 6-digit code to <strong>{email}</strong>. The code expires in 5 minutes.</p>

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

        {timeLeft > 0 ? (
          <p className="timer-text">
            OTP expires in: <span style={{ color: '#007bff', fontWeight: 'bold' }}>{formatTime(timeLeft)}</span>
          </p>
        ) : (
          <p className="timer-text">OTP expired. Request a new code below.</p>
        )}

        {error && <div className="auth-error">{error}</div>}
        {info && <div className="auth-success">{info}</div>}

        <button
          className="auth-button"
          type="submit"
          disabled={isLoading || otp.length !== 6}
        >
          {isLoading ? 'Verifying...' : 'Verify OTP'}
        </button>

        <button
          type="button"
          className="auth-link-button"
          onClick={handleResend}
          disabled={isLoading || timeLeft > 0}
        >
          Resend OTP
        </button>

        <p className="auth-footer-text">
          Need to try a different email?{' '}
          <span className="auth-link" onClick={onBackToForgot}>Go back</span>
        </p>
      </form>
    </div>
  );
}

export default ForgotPasswordOtpPage;
