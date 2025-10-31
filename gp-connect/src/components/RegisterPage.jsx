import React, { useEffect, useMemo, useState } from 'react';
import './LoginPage.css';
import { authAPI } from '../services/api';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import {
  ADMISSION_YEARS,
  DEPARTMENTS,
  getDepartmentByCode,
  getEnrollmentPrefix,
  validateEnrollmentNumber,
} from '../utils/registrationOptions.js';

const FONT_IMPORT = `
  @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&display=swap');
`;

const INITIAL_FORM = {
  fullName: '',
  email: '',
  admissionYear: '',
  departmentCode: '',
  enrollment: '',
  password: '',
  confirmPassword: '',
};

const INITIAL_ERRORS = {
  fullName: '',
  email: '',
  admissionYear: '',
  departmentCode: '',
  enrollment: '',
  password: '',
  confirmPassword: '',
};

const validateField = (field, value, values) => {
  switch (field) {
    case 'fullName': {
      const trimmed = value.trim();
      if (!trimmed) return 'Full name is required';
      if (trimmed.length < 3) return 'Full name must be at least 3 characters';
      return '';
    }
    case 'email': {
      const trimmed = value.trim();
      if (!trimmed) return 'Email is required';
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(trimmed)) return 'Enter a valid email address';
      return '';
    }
    case 'admissionYear':
      return value ? '' : 'Select admission year';
    case 'departmentCode':
      return value && getDepartmentByCode(value) ? '' : 'Select department';
    case 'enrollment': {
      if (!values.admissionYear || !values.departmentCode) {
        return '';
      }
      const { valid, message } = validateEnrollmentNumber(
        value,
        values.admissionYear,
        values.departmentCode,
      );
      return valid ? '' : message;
    }
    case 'password': {
      if (!value) return 'Password is required';
      if (value.length < 8) return 'Password must be at least 8 characters';
      if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
        return 'Password must include letters and numbers';
      }
      return '';
    }
    case 'confirmPassword':
      if (!value) return 'Confirm your password';
      if (value !== values.password) return 'Passwords must match';
      return '';
    default:
      return '';
  }
};

const validateAllFields = (values) => {
  const nextErrors = { ...INITIAL_ERRORS };
  Object.keys(INITIAL_ERRORS).forEach((field) => {
    nextErrors[field] = validateField(field, values[field], values);
  });
  return nextErrors;
};

function RegistrationPage({ onRegister, onSwitchToLogin }) {
  const [formValues, setFormValues] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState(INITIAL_ERRORS);
  const [touched, setTouched] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = FONT_IMPORT;
    document.head.appendChild(styleElement);
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  const selectedDepartment = useMemo(
    () => getDepartmentByCode(formValues.departmentCode),
    [formValues.departmentCode],
  );

  const enrollmentEnabled = Boolean(formValues.admissionYear && formValues.departmentCode);

  const enrollmentPrefix = useMemo(
    () => getEnrollmentPrefix(formValues.admissionYear, formValues.departmentCode),
    [formValues.admissionYear, formValues.departmentCode],
  );

  const isFieldInvalid = (field) => Boolean((touched[field] || submitAttempted) && errors[field]);

  const handleBlur = (field) => () => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleChange = (field) => (event) => {
    const value = event.target.value;

    setFormValues((prevValues) => {
      const nextValues = { ...prevValues, [field]: value };

      if ((field === 'admissionYear' || field === 'departmentCode') && prevValues.enrollment) {
        nextValues.enrollment = '';
      }

      setErrors((prevErrors) => {
        const nextErrors = { ...prevErrors };
        nextErrors[field] = validateField(field, nextValues[field], nextValues);

        if (field === 'password' || field === 'confirmPassword') {
          nextErrors.password = validateField('password', nextValues.password, nextValues);
          nextErrors.confirmPassword = validateField('confirmPassword', nextValues.confirmPassword, nextValues);
        }

        if (field === 'enrollment' || field === 'admissionYear' || field === 'departmentCode') {
          nextErrors.enrollment = validateField('enrollment', nextValues.enrollment, nextValues);
        }

        return nextErrors;
      });

      if (field === 'admissionYear' || field === 'departmentCode') {
        setTouched((prev) => ({ ...prev, enrollment: false }));
      }

      return nextValues;
    });
  };

  const formHasErrors = useMemo(
    () => Object.values(errors).some((message) => Boolean(message)),
    [errors],
  );

  const requiredFieldsFilled = useMemo(() => {
    const values = formValues;
    return (
      values.fullName &&
      values.email &&
      values.admissionYear &&
      values.departmentCode &&
      values.enrollment &&
      values.password &&
      values.confirmPassword
    );
  }, [formValues]);

  const canSubmit = requiredFieldsFilled && !formHasErrors && !isLoading;

  const handleRegister = async (event) => {
    event.preventDefault();
    setSubmitAttempted(true);
    setServerError('');

    const nextErrors = validateAllFields(formValues);
    setErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        fullName: formValues.fullName.trim(),
        email: formValues.email.trim().toLowerCase(),
        admissionYear: Number(formValues.admissionYear),
        departmentCode: formValues.departmentCode,
        department: selectedDepartment?.name,
        enrollment: formValues.enrollment,
        password: formValues.password,
        confirmPassword: formValues.confirmPassword,
      };

      const response = await authAPI.register(payload);
      onRegister(response.data?.email || payload.email);
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Registration failed. Please try again.';
      setServerError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const renderError = (field, id) =>
    isFieldInvalid(field) ? (
      <div className="auth-error" id={id} role="alert" aria-live="polite">
        {errors[field]}
      </div>
    ) : null;

  return (
    <div className="auth-container">
      {/* Harbor Haze live background */}
      <div className="auth-bg">
        {/* Floating particles */}
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
      <form className="auth-card register-card" onSubmit={handleRegister} noValidate>
        <h2 className="auth-title">Register on GP‑ConnecX</h2>

        <div className="register-form-grid">
          <div className="auth-field">
            <label className="auth-label" htmlFor="fullName">Full Name</label>
            <input
              id="fullName"
              className={`auth-input${isFieldInvalid('fullName') ? ' auth-input-error' : ''}`}
              type="text"
              name="fullName"
              value={formValues.fullName}
              onChange={handleChange('fullName')}
              onBlur={handleBlur('fullName')}
              aria-invalid={isFieldInvalid('fullName')}
              aria-describedby="fullName-error"
              autoComplete="name"
            />
            {renderError('fullName', 'fullName-error')}
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="email">Email</label>
            <input
              id="email"
              className={`auth-input${isFieldInvalid('email') ? ' auth-input-error' : ''}`}
              type="email"
              name="email"
              value={formValues.email}
              onChange={handleChange('email')}
              onBlur={handleBlur('email')}
              aria-invalid={isFieldInvalid('email')}
              aria-describedby="email-error"
              autoComplete="email"
            />
            {renderError('email', 'email-error')}
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="admissionYear">Admission Year</label>
            <select
              id="admissionYear"
              className={`auth-input${isFieldInvalid('admissionYear') ? ' auth-input-error' : ''}`}
              name="admissionYear"
              value={formValues.admissionYear}
              onChange={handleChange('admissionYear')}
              onBlur={handleBlur('admissionYear')}
              aria-invalid={isFieldInvalid('admissionYear')}
              aria-describedby="admissionYear-error"
            >
              <option value="">Select admission year</option>
              {ADMISSION_YEARS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            {renderError('admissionYear', 'admissionYear-error')}
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="department">Department</label>
            <select
              id="department"
              className={`auth-input${isFieldInvalid('departmentCode') ? ' auth-input-error' : ''}`}
              name="department"
              value={formValues.departmentCode}
              onChange={handleChange('departmentCode')}
              onBlur={handleBlur('departmentCode')}
              aria-invalid={isFieldInvalid('departmentCode')}
              aria-describedby="department-error"
            >
              <option value="">Select department</option>
              {DEPARTMENTS.map((department) => (
                <option key={department.code} value={department.code}>
                  {department.code} — {department.name}
                </option>
              ))}
            </select>
            {renderError('departmentCode', 'department-error')}
          </div>

          <div className="auth-field register-full-width">
            <label className="auth-label" htmlFor="enrollment">Enrollment Number</label>
            <input
              id="enrollment"
              className={`auth-input${isFieldInvalid('enrollment') ? ' auth-input-error' : ''}`}
              type="text"
              name="enrollment"
              value={formValues.enrollment}
              onChange={handleChange('enrollment')}
              onBlur={handleBlur('enrollment')}
              aria-invalid={isFieldInvalid('enrollment')}
              aria-describedby="enrollment-helper enrollment-error"
              inputMode="numeric"
              maxLength={7}
              pattern="\d{7}"
              placeholder={enrollmentEnabled ? `Starts with ${enrollmentPrefix}` : 'Select year and department first'}
              disabled={!enrollmentEnabled}
            />
            <span className="auth-helper" id="enrollment-helper">
              {enrollmentEnabled
                ? `Format: ${enrollmentPrefix}XXX (roll number 001-999)`
                : 'Select admission year and department to unlock'}
            </span>
            {renderError('enrollment', 'enrollment-error')}
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="password">Password</label>
            <div className="password-input-wrapper">
              <input
                id="password"
                className={`auth-input${isFieldInvalid('password') ? ' auth-input-error' : ''}`}
                type={showPassword ? "text" : "password"}
                name="password"
                value={formValues.password}
                onChange={handleChange('password')}
                onBlur={handleBlur('password')}
                aria-invalid={isFieldInvalid('password')}
                aria-describedby="password-error"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            {renderError('password', 'password-error')}
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="confirmPassword">Confirm Password</label>
            <div className="password-input-wrapper">
              <input
                id="confirmPassword"
                className={`auth-input${isFieldInvalid('confirmPassword') ? ' auth-input-error' : ''}`}
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                value={formValues.confirmPassword}
                onChange={handleChange('confirmPassword')}
                onBlur={handleBlur('confirmPassword')}
                aria-invalid={isFieldInvalid('confirmPassword')}
                aria-describedby="confirmPassword-error"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            {renderError('confirmPassword', 'confirmPassword-error')}
          </div>
        </div>

        {serverError && (
          <div className="auth-error" role="alert" aria-live="polite">
            {serverError}
          </div>
        )}

        <button className="auth-button" type="submit" disabled={!canSubmit}>
          {isLoading ? 'Registering…' : 'Register'}
        </button>
        <p className="auth-footer-text">
          Already have an account?{' '}
          <button type="button" className="auth-link-button" onClick={onSwitchToLogin}>
            Login
          </button>
        </p>
      </form>
      
      {/* Support Footer */}
      <div className="auth-support-footer">
        <p>Support : <a href="mailto:gpconnex@gmail.com" className="support-email">gpconnex@gmail.com</a></p>
      </div>
    </div>
  );
}

export default RegistrationPage;
