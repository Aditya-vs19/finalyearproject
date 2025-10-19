import mongoose from 'mongoose';

const passwordOtpSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    attemptsRemaining: {
      type: Number,
      default: 5,
      min: 0,
    },
    used: {
      type: Boolean,
      default: false,
      index: true,
    },
    lockedUntil: {
      type: Date,
    },
    requestedFromIp: {
      type: String,
    },
    usedAt: {
      type: Date,
    },
    usedFromIp: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

passwordOtpSchema.index({ createdAt: 1 });
passwordOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PasswordOtp = mongoose.model('PasswordOtp', passwordOtpSchema);

export default PasswordOtp;
