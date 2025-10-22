import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const departmentEnum = [
  'Civil Engineering',
  'Electrical Engineering',
  'Electronics and Telecommunications Engineering',
  'Mechanical Engineering',
  'Metallurgy Engineering',
  'Computer Engineering',
  'IT Engineering',
  'Dress Design and Garment Manufacturing Engineering',
  'Computer',
  'Mechanical',
  'Civil',
  'Metallurgy',
  'IT',
  'Electrical',
  'ENTC',
  'DDGM',
  'Meta',
];

const userSchema = mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    enrollment: {
      type: String,
      required: true,
      unique: true,
      minlength: 7,
      maxlength: 7,
    },
    password: {
      type: String,
      required: true,
    },
    bio: {
      type: String,
      default: '',
    },
    profilePic: {
      type: String,
      default: '',
    },
    department: {
      type: String,
      required: true,
      enum: departmentEnum,
      trim: true,
    },
    departmentCode: {
      type: String,
      minlength: 2,
      maxlength: 2,
      trim: true,
    },
    admissionYear: {
      type: Number,
      min: 2010,
      max: 2025,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: String,
    },
    otpExpires: {
      type: Date,
    },
    followers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }],
    following: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }],
    chatIdentityPublicKey: {
      type: String,
    },
    chatDhPublicKey: {
      type: String,
    },
    chatPrekeyBatchId: {
      type: String,
    },
    chatPrekeysPublishedAt: {
      type: Date,
    },
    onlineStatus: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Encrypt password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

export default User;
