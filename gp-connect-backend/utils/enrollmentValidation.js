const START_YEAR = 2010;
const END_YEAR = 2025;

export const ADMISSION_YEAR_RANGE = { start: START_YEAR, end: END_YEAR };

export const DEPARTMENTS = [
  { code: '01', name: 'Civil Engineering' },
  { code: '02', name: 'Electrical Engineering' },
  { code: '03', name: 'Electronics and Telecommunications Engineering' },
  { code: '04', name: 'Mechanical Engineering' },
  { code: '05', name: 'Metallurgy Engineering' },
  { code: '06', name: 'Computer Engineering' },
  { code: '07', name: 'IT Engineering' },
  { code: '08', name: 'Dress Design and Garment Manufacturing Engineering' },
];

export const isValidAdmissionYear = (year) => {
  if (!Number.isInteger(year)) {
    return false;
  }
  return year >= START_YEAR && year <= END_YEAR;
};

export const getDepartmentByCode = (code) =>
  DEPARTMENTS.find((department) => department.code === String(code).padStart(2, '0')) || null;

const getEnrollmentPrefix = (admissionYear, departmentCode) => {
  const yearSuffix = String(admissionYear).slice(-2);
  const normalizedDepartmentCode = String(departmentCode).padStart(2, '0');
  return `${yearSuffix}${normalizedDepartmentCode}`;
};

export const validateEnrollmentFormat = ({ enrollment, admissionYear, departmentCode }) => {
  const sanitizedEnrollment = typeof enrollment === 'string' ? enrollment.trim() : '';

  console.log('Enrollment validation debug:', {
    original: enrollment,
    sanitized: sanitizedEnrollment,
    length: sanitizedEnrollment.length,
    type: typeof enrollment,
    regexTest: /^\d{7}$/.test(sanitizedEnrollment)
  });

  if (!sanitizedEnrollment) {
    return { valid: false, message: 'Enrollment number is required' };
  }

  if (!/^\d{7}$/.test(sanitizedEnrollment)) {
    return { valid: false, message: `Enrollment number must be exactly 7 digits. Got: "${sanitizedEnrollment}" (length: ${sanitizedEnrollment.length})` };
  }

  if (!isValidAdmissionYear(admissionYear)) {
    return { valid: false, message: 'Invalid admission year supplied' };
  }

  const department = getDepartmentByCode(departmentCode);
  if (!department) {
    return { valid: false, message: 'Invalid department code supplied' };
  }

  const expectedPrefix = getEnrollmentPrefix(admissionYear, department.code);
  if (sanitizedEnrollment.slice(0, 4) !== expectedPrefix) {
    return {
      valid: false,
      message: `Enrollment must start with ${expectedPrefix}.`,
    };
  }

  const rollNumber = Number(sanitizedEnrollment.slice(4));
  if (Number.isNaN(rollNumber) || rollNumber < 1 || rollNumber > 999) {
    return {
      valid: false,
      message: 'Last three digits must be a roll number between 001 and 999',
    };
  }

  return { valid: true, message: '', sanitizedEnrollment, department };
};

const normalizeWhitespace = (value = '') => value.replace(/\s+/g, ' ').trim();

const validatePasswordStrength = (password) => {
  if (!password) {
    return 'Password is required';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Password must include letters and numbers';
  }
  return '';
};

export const validateRegistrationPayload = (payload = {}) => {
  const errors = [];

  const fullName = normalizeWhitespace(payload.fullName || '');
  if (!fullName) {
    errors.push('Full name is required');
  } else if (fullName.length < 3) {
    errors.push('Full name must be at least 3 characters');
  }

  const email = normalizeWhitespace(payload.email || '').toLowerCase();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) {
    errors.push('Email is required');
  } else if (!emailPattern.test(email)) {
    errors.push('Enter a valid email address');
  }

  const admissionYear = Number(payload.admissionYear);
  if (!isValidAdmissionYear(admissionYear)) {
    errors.push('Select a valid admission year');
  }

  const department = getDepartmentByCode(payload.departmentCode);
  if (!department) {
    errors.push('Select a valid department');
  }

  const { valid, message: enrollmentMessage, sanitizedEnrollment } = validateEnrollmentFormat({
    enrollment: payload.enrollment,
    admissionYear,
    departmentCode: department?.code,
  });
  if (!valid) {
    errors.push(enrollmentMessage);
  }

  const password = payload.password || '';
  const confirmPassword = payload.confirmPassword || '';
  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    errors.push(passwordError);
  }
  if (!confirmPassword) {
    errors.push('Confirm your password');
  } else if (password && confirmPassword && password !== confirmPassword) {
    errors.push('Passwords must match');
  }

  const data = {
    fullName,
    email,
    admissionYear,
    departmentCode: department?.code,
    departmentName: department?.name,
    enrollment: sanitizedEnrollment,
    password,
  };

  return { data, errors };
};
