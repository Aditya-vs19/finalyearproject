import PasswordOtp from '../models/PasswordOtp.js';
import { generateOtp, hashOtp, constantTimeEquals } from '../utils/otpUtils.js';

const OTP_EXPIRY_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;
const OTP_REQUEST_LIMIT = 3;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_LOCK_DURATION_MS = 10 * 60 * 1000;

const buildOtpEmail = ({ otp, email, appUrl }) => {
  const safeAppUrl = appUrl || 'https://gp-connect';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #ffffff; background: #0b0b0b; padding: 24px; border-radius: 12px;">
      <h2 style="color: #ffffff; margin-top: 0;">Your GP-ConneX OTP</h2>
      <p style="color: #dddddd;">Use this one-time password to securely access your GP-ConneX account.</p>
      <div style="background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
        <span style="display: inline-block; font-size: 40px; letter-spacing: 8px; color: #f5c16c; font-weight: 700;">${otp}</span>
      </div>
      <p style="color: #cccccc;">This code is valid for <strong>5 minutes</strong>. For your security, never share this code with anyone.</p>
      <p style="color: #cccccc;">Once logged in, you can change your password from the profile settings inside the app.</p>
      <hr style="border: none; border-top: 1px solid #1f2937; margin: 24px 0;" />
      <p style="color: #666666; font-size: 12px;">Requested for <strong>${email}</strong>. If you did not request this code, please ignore this email or contact support.</p>
      <p style="color: #666666; font-size: 12px;">GP-ConneX · <a style="color: #8888ff;" href="${safeAppUrl}" target="_blank" rel="noopener noreferrer">${safeAppUrl}</a></p>
    </div>
  `;

  const text = `Your GP-ConneX OTP is ${otp}. It expires in 5 minutes. Do not share this code with anyone. Visit ${safeAppUrl} after logging in to change your password.`;

  return { html, text };
};

export const requestPasswordOtp = async ({
  user,
  email,
  ip,
  sendEmailFn,
  appUrl = process.env.APP_URL,
  now = new Date(),
  generateOtpFn = generateOtp,
  hashOtpFn = hashOtp,
  includePlainOtp = false,
}) => {
  if (!user) {
    return { status: 'unknown_user' };
  }

  const cutoff = new Date(now.getTime() - 15 * 60 * 1000);

  const recentRequestsForUser = await PasswordOtp.countDocuments({
    userId: user._id,
    createdAt: { $gte: cutoff },
  });

  if (recentRequestsForUser >= OTP_REQUEST_LIMIT) {
    return { status: 'rate_limited' };
  }

  if (ip) {
    const recentRequestsForIp = await PasswordOtp.countDocuments({
      requestedFromIp: ip,
      createdAt: { $gte: cutoff },
    });

    if (recentRequestsForIp >= OTP_REQUEST_LIMIT) {
      return { status: 'rate_limited' };
    }
  }

  const latestOtp = await PasswordOtp.findOne({ userId: user._id }).sort({ createdAt: -1 });

  if (latestOtp && now.getTime() - latestOtp.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
    return { status: 'cooldown', retryAt: new Date(latestOtp.createdAt.getTime() + OTP_RESEND_COOLDOWN_MS) };
  }

  await PasswordOtp.updateMany({ userId: user._id, used: false }, { $set: { used: true } });

  const otp = generateOtpFn();
  const otpHash = hashOtpFn(otp);
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

  const passwordOtp = await PasswordOtp.create({
    userId: user._id,
    otpHash,
    expiresAt,
    attemptsRemaining: OTP_MAX_ATTEMPTS,
    used: false,
    lockedUntil: undefined,
    requestedFromIp: ip,
    createdAt: now,
    updatedAt: now,
  });

  const { html, text } = buildOtpEmail({ otp, email, appUrl });

  try {
    await sendEmailFn(email, 'Your GP-ConneX OTP', html, text);
  } catch (error) {
    await PasswordOtp.findByIdAndUpdate(passwordOtp._id, { used: true });
    throw error;
  }

  const result = { status: 'sent', expiresAt };
  if (includePlainOtp) {
    result.otp = otp;
  }

  return result;
};

export const verifyPasswordOtp = async ({
  user,
  otp,
  ip,
  now = new Date(),
  hashOtpFn = hashOtp,
  compareFn = constantTimeEquals,
}) => {
  if (!user) {
    return { status: 'no_record' };
  }

  const latestOtp = await PasswordOtp.findOne({ userId: user._id, used: false }).sort({ createdAt: -1 });

  if (!latestOtp) {
    return { status: 'no_record' };
  }

  if (latestOtp.lockedUntil && latestOtp.lockedUntil > now) {
    return { status: 'locked', lockedUntil: latestOtp.lockedUntil };
  }

  if (latestOtp.expiresAt <= now) {
    latestOtp.used = true;
    await latestOtp.save();
    return { status: 'expired' };
  }

  const hashedInput = hashOtpFn(otp);

  if (!compareFn(latestOtp.otpHash, hashedInput)) {
    if (latestOtp.attemptsRemaining > 0) {
      latestOtp.attemptsRemaining -= 1;
    }

    if (latestOtp.attemptsRemaining <= 0) {
      latestOtp.lockedUntil = new Date(now.getTime() + OTP_LOCK_DURATION_MS);
    }

    await latestOtp.save();
    return { status: latestOtp.attemptsRemaining <= 0 ? 'locked' : 'invalid', attemptsRemaining: latestOtp.attemptsRemaining };
  }

  latestOtp.used = true;
  latestOtp.attemptsRemaining = 0;
  latestOtp.usedAt = now;
  latestOtp.usedFromIp = ip;
  await latestOtp.save();

  await PasswordOtp.updateMany(
    {
      userId: user._id,
      used: false,
      _id: { $ne: latestOtp._id },
    },
    { $set: { used: true } }
  );

  return { status: 'verified' };
};

export const __testables = {
  OTP_EXPIRY_MINUTES,
  OTP_MAX_ATTEMPTS,
  OTP_REQUEST_LIMIT,
  OTP_RESEND_COOLDOWN_MS,
  OTP_LOCK_DURATION_MS,
  buildOtpEmail,
};
