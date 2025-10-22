const START_YEAR = 2010;
const END_YEAR = 2025;

export const ADMISSION_YEARS = Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, index) => START_YEAR + index);

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

const padRollNumber = (rollNumber) => String(rollNumber).padStart(3, '0');

export const getEnrollmentPrefix = (admissionYear, departmentCode) => {
  if (!admissionYear || !departmentCode) {
    return '';
  }
  const yearSuffix = String(admissionYear).slice(-2);
  return `${yearSuffix}${departmentCode}`;
};

export const validateEnrollmentNumber = (enrollment, admissionYear, departmentCode) => {
  if (!admissionYear || !departmentCode) {
    return { valid: false, message: 'Select admission year and department first' };
  }

  if (!enrollment) {
    return { valid: false, message: 'Enrollment number is required' };
  }

  if (!/^\d{7}$/.test(enrollment)) {
    return { valid: false, message: 'Enrollment number must be exactly 7 digits' };
  }

  const expectedPrefix = getEnrollmentPrefix(admissionYear, departmentCode);
  if (enrollment.slice(0, 4) !== expectedPrefix) {
    const exampleRoll = padRollNumber(1);
    return {
      valid: false,
      message: `Enrollment must start with ${expectedPrefix}. Example: ${expectedPrefix}${exampleRoll}`,
    };
  }

  const rollDigits = Number(enrollment.slice(4));
  if (Number.isNaN(rollDigits) || rollDigits < 1 || rollDigits > 999) {
    return {
      valid: false,
      message: 'Last three digits must be a roll number between 001 and 999',
    };
  }

  return { valid: true, message: '' };
};

export const getDepartmentByCode = (departmentCode) =>
  DEPARTMENTS.find((department) => department.code === departmentCode) || null;
