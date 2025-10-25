import React, { useState, useEffect } from 'react';
import LoginPage from './components/LoginPage';
import RegistrationPage from './components/RegisterPage';
import ForgotPasswordPage from './components/ForgotPasswordPage';
import ForgotPasswordOtpPage from './components/ForgotPasswordOtpPage';
import OtpVerificationPage from './components/OtpVerificationPage';
import ResetPasswordPage from './components/ResetPasswordPage';
import HomePage from './components/HomePage';

import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/theme.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [showForgotPasswordOtp, setShowForgotPasswordOtp] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [resetToken, setResetToken] = useState('');

  // Check for existing token on app load
  useEffect(() => {
    const token = localStorage.getItem('token');
    console.log('App loading - token exists:', !!token);
    
    if (token) {
      // Verify token is valid by making a test API call
      const verifyToken = async () => {
        try {
          console.log('Verifying token...');
          
          // Use the API service instead of direct fetch
          const response = await fetch('http://localhost:5000/api/profile/me', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            timeout: 10000
          });
          
          console.log('Token verification response status:', response.status);
          
          if (response.ok) {
            const userData = await response.json();
            console.log('User data received:', userData);
            
            // Check if user data exists and is valid
            if (userData && userData.user && userData.user._id) {
              console.log('Valid user data, logging in');
              setIsLoggedIn(true);
            } else {
              // User data is missing or invalid, remove token
              console.log('User data missing or invalid, logging out');
              localStorage.removeItem('token');
            }
          } else {
            // Token is invalid or user doesn't exist, remove it
            console.log('Token verification failed, status:', response.status);
            localStorage.removeItem('token');
          }
        } catch (error) {
          console.error('Token verification failed:', error);
          // Don't remove token on network errors, only on auth errors
          if (error.name !== 'TypeError' && !error.message.includes('fetch')) {
            localStorage.removeItem('token');
          }
        } finally {
          console.log('Setting loading to false');
          setIsLoading(false);
        }
      };
      
      verifyToken();
    } else {
      console.log('No token found, setting loading to false');
      setIsLoading(false);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    setShowRegister(false);
    setShowForgotPassword(false);
    setShowOtpVerification(false);
    setShowForgotPasswordOtp(false);
    setShowResetPassword(false);
    setResetToken('');
  };

  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  const handleRegisterSuccess = (email) => {
    setUserEmail(email);
    setShowOtpVerification(true);
    setShowRegister(false);
  };

  const handleOtpVerificationSuccess = () => {
    setIsLoggedIn(true);
    setShowOtpVerification(false);
  };

  const handleBackToRegister = () => {
    setShowOtpVerification(false);
    setShowRegister(true);
  };

  const handleForgotPasswordOtpSuccess = (userData) => {
    // Instead of logging in, show reset password page
    const token = localStorage.getItem('token');
    setResetToken(token);
    setShowForgotPasswordOtp(false);
    setShowResetPassword(true);
  };

  const handlePasswordResetSuccess = () => {
    // After successful password reset, go back to login
    localStorage.removeItem('token'); // Remove the temporary OTP token
    setShowResetPassword(false);
    setShowForgotPassword(false);
    setShowForgotPasswordOtp(false);
    setForgotPasswordEmail('');
    setResetToken('');
  };

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 25%, #334155 50%, #1e293b 75%, #0f172a 100%)',
        backgroundSize: '400% 400%',
        animation: 'gradientShift 20s ease infinite',
        color: '#f8fafc',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ 
          textAlign: 'center',
          position: 'relative',
          zIndex: 2
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            border: '4px solid rgba(92, 141, 197, 0.2)',
            borderTop: '4px solid #5C8DC5',
            borderRight: '4px solid #909EAE',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite, pulse 2s ease-in-out infinite',
            margin: '0 auto 30px',
            boxShadow: '0 0 30px rgba(92, 141, 197, 0.4)'
          }}></div>
          <h2 style={{
            background: 'linear-gradient(45deg, #5C8DC5, #909EAE, #cbd5e1, #94a3b8)',
            backgroundSize: '300% 300%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: 'gradientText 4s ease-in-out infinite',
            fontFamily: 'Dancing Script, cursive',
            fontSize: '2.5rem',
            margin: '0 0 10px 0'
          }}>GP‑ConnecX</h2>
          <p style={{ 
            fontSize: '1.1rem',
            opacity: 0.8,
            animation: 'fadeInOut 2s ease-in-out infinite'
          }}>Loading your harbor experience...</p>
        </div>
        
        {/* Floating orbs */}
        <div style={{
          position: 'absolute',
          top: '10%',
          left: '10%',
          width: '100px',
          height: '100px',
          background: 'radial-gradient(circle, rgba(92, 141, 197, 0.25), transparent)',
          borderRadius: '50%',
          animation: 'float 8s ease-in-out infinite',
          filter: 'blur(30px)'
        }}></div>
        <div style={{
          position: 'absolute',
          top: '60%',
          right: '15%',
          width: '80px',
          height: '80px',
          background: 'radial-gradient(circle, rgba(144, 158, 174, 0.25), transparent)',
          borderRadius: '50%',
          animation: 'float 10s ease-in-out infinite reverse',
          filter: 'blur(30px)'
        }}></div>
        <div style={{
          position: 'absolute',
          bottom: '20%',
          left: '50%',
          width: '60px',
          height: '60px',
          background: 'radial-gradient(circle, rgba(203, 213, 225, 0.25), transparent)',
          borderRadius: '50%',
          animation: 'float 9s ease-in-out infinite',
          filter: 'blur(30px)'
        }}></div>
        
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
          }
          @keyframes gradientShift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          @keyframes gradientText {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
          @keyframes fadeInOut {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
          }
          @keyframes float {
            0%, 100% { transform: translateY(0px) scale(1); }
            50% { transform: translateY(-12px) scale(1.03); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <>
      {isLoggedIn ? (
        <HomePage onLogout={handleLogout} />
      ) : showResetPassword ? (
        <ResetPasswordPage
          email={forgotPasswordEmail}
          resetToken={resetToken}
          onPasswordReset={handlePasswordResetSuccess}
        />
      ) : showOtpVerification ? (
        <OtpVerificationPage
          email={userEmail}
          onVerificationSuccess={handleOtpVerificationSuccess}
          onBackToRegister={handleBackToRegister}
        />
      ) : showForgotPasswordOtp ? (
        <ForgotPasswordOtpPage
          email={forgotPasswordEmail}
          onOtpVerified={handleForgotPasswordOtpSuccess}
          onBackToForgot={() => {
            setShowForgotPasswordOtp(false);
            setShowForgotPassword(true);
            setForgotPasswordEmail('');
          }}
        />
      ) : showForgotPassword ? (
        <ForgotPasswordPage
          onNavigate={(page, payload) => {
            if (page === 'login') {
              setShowForgotPassword(false);
              setShowRegister(false);
              setShowForgotPasswordOtp(false);
              setShowResetPassword(false);
              setForgotPasswordEmail('');
              setResetToken('');
            }
            if (page === 'otp') {
              const emailFromPayload = payload?.email || '';
              setForgotPasswordEmail(emailFromPayload.trim().toLowerCase());
              setShowForgotPassword(false);
              setShowForgotPasswordOtp(true);
            }
          }}
        />
      ) : showRegister ? (
        <RegistrationPage
          onRegister={handleRegisterSuccess}
          onSwitchToLogin={() => setShowRegister(false)}
        />
      ) : (
        <LoginPage
          onLogin={handleLogin}
          onSwitchToRegister={() => {
            setShowRegister(true);
            setShowForgotPassword(false);
            setShowForgotPasswordOtp(false);
            setShowResetPassword(false);
            setForgotPasswordEmail('');
            setResetToken('');
          }}
          onSwitchToForgotPassword={() => {
            setShowForgotPassword(true);
            setShowRegister(false);
            setShowForgotPasswordOtp(false);
            setShowResetPassword(false);
            setForgotPasswordEmail('');
            setResetToken('');
          }}
        />
      )}
    </>
  );
}

export default App;
