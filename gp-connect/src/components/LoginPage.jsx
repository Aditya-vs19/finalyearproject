import React, { useState } from 'react';
import './LoginPage.css';
import { authAPI } from '../services/api';
import { FaEye, FaEyeSlash } from 'react-icons/fa';


const style = document.createElement('style');
style.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&display=swap');
`;
document.head.appendChild(style);

function LoginPage({ onLogin, onSwitchToRegister, onSwitchToForgotPassword }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async e => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const response = await authAPI.login({ email, password });
      localStorage.setItem('token', response.data.token);
      onLogin();
    } catch (error) {
      console.error('Login failed:', error.response?.data || error.message);
      const errorMessage = error.response?.data?.message || 'Login failed. Please check your credentials.';
      setError(errorMessage);
    }
    setIsLoading(false);
  };

  return (
    <div className="auth-container">
      {/* Live animated background */}
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

      {/* Entry hero text */}
      <div className="login-hero">
        <h1 className="hero-kicker">By Gppians, For Gppians</h1>
        <h1 className="hero-title">Connect to your friends</h1>
      </div>

      <form onSubmit={handleLogin} className="auth-card">
        <h2 className="auth-title">Welcome Back</h2>
        <input
          className="auth-input"
          type="email"
          placeholder="Email"
          value={email}
          required
          onChange={e => setEmail(e.target.value)}
        />
        <div className="password-input-wrapper">
          <input
            className="auth-input"
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            required
            onChange={e => setPassword(e.target.value)}
          />
          <button
            type="button"
            className="password-toggle-btn"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>
        <div className="forgot-password-link">
          <span className="auth-link" onClick={onSwitchToForgotPassword}>Forgot Password?</span>
        </div>
        {error && <div className="auth-error">{error}</div>}
        <button className="auth-button" type="submit" disabled={isLoading}>
          {isLoading ? 'Logging in...' : 'Login'}
        </button>
        <p className="auth-footer-text">
          Don't have an account? <span className="auth-link" onClick={onSwitchToRegister}>Register</span>
        </p>
      </form>
    </div>
  );
}

export default LoginPage;
