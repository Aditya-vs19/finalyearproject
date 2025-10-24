import asyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';
import sendEmail from '../utils/sendEmail.js';
import { requestPasswordOtp, verifyPasswordOtp } from '../services/passwordResetService.js';

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
  const {
    fullName,
    email,
    enrollment,
    password,
    departmentCode,
    departmentName,
    admissionYear,
  } = req.registrationInput || {};

  // Check if user already exists
  const userExists = await User.findOne({ 
    $or: [{ email }, { enrollment }] 
  });

  if (userExists) {
    res.status(400);
    if (userExists.email === email) {
      throw new Error('Email already exists');
    } else {
      throw new Error('Enrollment number already exists');
    }
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

  const user = await User.create({
    fullName,
    email,
    enrollment,
    password,
    department: departmentName,
    departmentCode,
    admissionYear,
    otp,
    otpExpires,
  });

  if (user) {
    // Send OTP email
    const emailMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to GP-Connect!</h2>
        <p>Hello ${fullName},</p>
        <p>Thank you for registering with GP-Connect. Please use the following OTP to verify your email address:</p>
        <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
          <h1 style="color: #007bff; font-size: 32px; margin: 0; letter-spacing: 5px;">${otp}</h1>
        </div>
        <p>This OTP will expire in 10 minutes.</p>
        <p>If you didn't request this verification, please ignore this email.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">This is an automated message from GP-Connect.</p>
      </div>
    `;

    try {
      await sendEmail(email, 'Verify Your Email - GP-ConnecX', emailMessage);
      res.status(201).json({
        message: 'OTP sent to your email. Please check your inbox and verify your email.',
        email: user.email,
      });
    } catch (error) {
      console.error('Email sending failed:', error);
      // If email sending fails, delete the user
      await User.findByIdAndDelete(user._id);
      res.status(500);
      throw new Error('Failed to send verification email. Please check your email configuration and try again.');
    }
  } else {
    res.status(400);
    throw new Error('Invalid user data');
  }
});

// @desc    Verify OTP
// @route   POST /api/auth/verify
// @access  Public
const verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (user.isVerified) {
    res.status(400);
    throw new Error('Email already verified');
  }

  if (!user.otp || !user.otpExpires) {
    res.status(400);
    throw new Error('No OTP found. Please register again.');
  }

  if (user.otp !== otp) {
    res.status(400);
    throw new Error('Invalid OTP');
  }

  if (new Date() > user.otpExpires) {
    res.status(400);
    throw new Error('OTP has expired. Please register again.');
  }

  // Mark user as verified and clear OTP
  user.isVerified = true;
  user.otp = undefined;
  user.otpExpires = undefined;
  await user.save();

  res.json({
    message: 'Email verified successfully',
    token: generateToken(user._id),
    user: {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      enrollment: user.enrollment,
    },
  });
});

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const authUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (user && (await user.matchPassword(password))) {
    // Check if user is verified
    if (!user.isVerified) {
      res.status(401);
      throw new Error('Please verify your email first');
    }

    res.json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      enrollment: user.enrollment,
      token: generateToken(user._id),
    });
  } else {
    res.status(401);
    throw new Error('Invalid email or password');
  }
});

const forgotPasswordOtp = asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  const genericResponse = { message: 'If that email exists, an OTP has been sent.' };

  if (!email || typeof email !== 'string') {
    return res.status(200).json(genericResponse);
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    return res.status(200).json(genericResponse);
  }

  const user = await User.findOne({ email: normalizedEmail });

  if (!user || !user.isVerified) {
    return res.status(200).json(genericResponse);
  }

  try {
    await requestPasswordOtp({
      user,
      email: user.email,
      ip: req.ip,
      sendEmailFn: sendEmail,
    });
  } catch (error) {
    console.error('Failed to send password OTP:', error.message);
  }

  return res.status(200).json(genericResponse);
});

const resendPasswordOtp = asyncHandler(async (req, res) => {
  return forgotPasswordOtp(req, res);
});

const verifyPasswordOtpLogin = asyncHandler(async (req, res) => {
  const { email, otp } = req.body || {};

  if (!email || !otp || typeof email !== 'string' || typeof otp !== 'string') {
    return res.status(400).json({ message: 'Invalid or expired OTP' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || otp.trim().length === 0) {
    return res.status(400).json({ message: 'Invalid or expired OTP' });
  }

  const user = await User.findOne({ email: normalizedEmail });

  if (!user || !user.isVerified) {
    return res.status(400).json({ message: 'Invalid or expired OTP' });
  }

  const verificationResult = await verifyPasswordOtp({
    user,
    otp: otp.trim(),
    ip: req.ip,
  });

  if (verificationResult.status !== 'verified') {
    if (verificationResult.status === 'locked') {
      return res.status(400).json({ message: 'Too many invalid attempts. Please try again later.' });
    }

    return res.status(400).json({ message: 'Invalid or expired OTP' });
  }

  const token = generateToken(user._id, {
    expiresIn: '15m',
    payload: { authMethod: 'otp' },
  });

  return res.status(200).json({
    message: 'OTP verified',
    token,
    user: {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      enrollment: user.enrollment,
    },
  });
});

// @desc    Reset password after OTP verification
// @route   POST /api/auth/reset-password
// @access  Public (but requires valid reset token from OTP verification)
const resetPasswordAfterOtp = asyncHandler(async (req, res) => {
  const { email, newPassword, token } = req.body || {};

  if (!email || !newPassword || !token) {
    return res.status(400).json({ message: 'Email, new password, and token are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Verify the token is valid and from OTP verification
  let decoded;
  try {
    const secret = process.env.JWT_SECRET || 'fallback_jwt_secret_key_for_development_only';
    decoded = jwt.verify(token, secret);
    
    // Check if token was issued via OTP method
    if (decoded.authMethod !== 'otp') {
      return res.status(403).json({ message: 'Invalid reset token' });
    }
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired reset token' });
  }

  const user = await User.findOne({ email: normalizedEmail });

  if (!user || !user.isVerified) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Ensure the token belongs to this user
  if (user._id.toString() !== decoded.id) {
    return res.status(403).json({ message: 'Token does not match user' });
  }

  // Validate password strength
  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters long' });
  }

  // Update password (will be hashed by pre-save middleware)
  user.password = newPassword;
  await user.save();

  return res.status(200).json({
    message: 'Password reset successful. You can now login with your new password.',
    success: true,
  });
});

export {
  registerUser,
  verifyOtp,
  authUser,
  forgotPasswordOtp,
  resendPasswordOtp,
  verifyPasswordOtpLogin,
  resetPasswordAfterOtp,
};
