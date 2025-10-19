import React, { useState } from 'react';
import './LoginPage.css';
import { authAPI } from '../services/api';

// Add Dancing Script font import
const style = document.createElement('style');
style.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&display=swap');
`;
document.head.appendChild(style);

function RegistrationPage({ onRegister, onSwitchToLogin }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [enrollmentNumber, setEnrollmentNumber] = useState('');
  const [department, setDepartment] = useState('');
  const [enrollmentError, setEnrollmentError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const validateEnrollment = (value) => {
    if (!value) {
      setEnrollmentError('Enrollment number is required');
      return false;
    }
    if (!/^\d{7}$/.test(value)) {
      setEnrollmentError('Enrollment number must be exactly 7 digits');
      return false;
    }
    setEnrollmentError('');
    return true;
  };

  const validatePassword = (password, confirmPassword) => {
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return false;
    }
    if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const handleEnrollmentChange = (e) => {
    const value = e.target.value;
    setEnrollmentNumber(value);
    if (enrollmentError) {
      validateEnrollment(value);
    }
  };

  const handlePasswordChange = (e) => {
    const value = e.target.value;
    setPassword(value);
    if (passwordError && confirmPassword) {
      validatePassword(value, confirmPassword);
    }
  };

  const handleConfirmPasswordChange = (e) => {
    const value = e.target.value;
    setConfirmPassword(value);
    if (password) {
      validatePassword(password, value);
    }
  };

  const handleRegister = async e => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    const isEnrollmentValid = validateEnrollment(enrollmentNumber);
    const isPasswordValid = validatePassword(password, confirmPassword);
    
    if (isEnrollmentValid && isPasswordValid) {
      try {
        const response = await authAPI.register({ 
          fullName, 
          email, 
          enrollment: enrollmentNumber, 
          password,
          department
        });
        console.log('Registration successful:', response.data);
        // Pass email to parent component for OTP verification
        onRegister(email);
      } catch (error) {
        console.error('Registration failed:', error.response?.data || error.message);
        const errorMessage = error.response?.data?.message || 'Registration failed. Please try again.';
        setError(errorMessage);
      }
    }
    setIsLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-header">
        <h1 className="brand-gradient">GP‑ConnecX</h1>
      </div>
      <form onSubmit={handleRegister} className="auth-card register-card">
        <h2 className="auth-title">Register on GP‑ConnecX</h2>
        <input
          className="auth-input"
          type="text"
          placeholder="Full Name"
          value={fullName}
          required
          onChange={e => setFullName(e.target.value)}
        />
        <input
          className="auth-input"
          type="email"
          placeholder="Email"
          value={email}
          required
          onChange={e => setEmail(e.target.value)}
        />
        <input
          className={`auth-input${enrollmentError ? ' auth-input-error' : ''}`}
          type="text"
          placeholder="Enrollment Number (7 digits)"
          value={enrollmentNumber}
          required
          onChange={handleEnrollmentChange}
          maxLength={7}
        />
        {enrollmentError && <div className="auth-error">{enrollmentError}</div>}
        <select
          className="auth-input"
          value={department}
          required
          onChange={e => setDepartment(e.target.value)}
        >
          <option value="">Select Department</option>
          <option value="Computer">Computer Engineering</option>
          <option value="IT">Information Technology</option>
          <option value="Mechanical">Mechanical Engineering</option>
          <option value="Civil">Civil Engineering</option>
          <option value="Electrical">Electrical Engineering</option>
          <option value="ENTC">Electronics and Telecommunication (ENTC)</option>
          <option value="DDGM">DDGM</option>
          <option value="Metallurgy">Metallurgy</option>
        </select>
        <input
          className={`auth-input${passwordError ? ' auth-input-error' : ''}`}
          type="password"
          placeholder="Password"
          value={password}
          required
          onChange={handlePasswordChange}
        />
        <input
          className={`auth-input${passwordError ? ' auth-input-error' : ''}`}
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          required
          onChange={handleConfirmPasswordChange}
        />
        {passwordError && <div className="auth-error">{passwordError}</div>}
        {error && <div className="auth-error">{error}</div>}
        <button className="auth-button" type="submit" disabled={isLoading}>
          {isLoading ? 'Registering...' : 'Register'}
        </button>
        <p className="auth-footer-text">
          Already have an account? <span className="auth-link" onClick={onSwitchToLogin}>Login</span>
        </p>
      </form>
    </div>
  );
}

export default RegistrationPage;
