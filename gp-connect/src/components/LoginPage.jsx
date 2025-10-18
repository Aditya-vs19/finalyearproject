import React, { useState } from 'react';
import './LoginPage.css';
import { authAPI } from '../services/api';


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
      <div className="auth-header">
        <h1 className="brand-gradient">GP‑ConnecX</h1>
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
        <input
          className="auth-input"
          type="password"
          placeholder="Password"
          value={password}
          required
          onChange={e => setPassword(e.target.value)}
        />
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
