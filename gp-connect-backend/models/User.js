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
      required: function() {
        // Enrollment not required for super admin accounts
        // Check both current state and email for admin identification
        return !(
          (this.isAdmin && this.adminLevel === 'super') || 
          this.email === 'gpconnex@gmail.com'
        );
      },
      unique: true,
      sparse: true, // Allow null values to be non-unique
      validate: {
        validator: function(v) {
          // If super admin, enrollment can be null/undefined
          if (
            (this.isAdmin && this.adminLevel === 'super') || 
            this.email === 'gpconnex@gmail.com'
          ) {
            return true;
          }
          // For regular users, enrollment must be exactly 7 characters if provided
          if (!v) return false; // Required for non-admin users
          return v.length >= 7 && v.length <= 7;
        },
        message: 'Enrollment must be exactly 7 characters for regular users'
      }
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
      required: function() {
        // Department not required for super admin accounts
        // Check both current state and email for admin identification
        return !(
          (this.isAdmin && this.adminLevel === 'super') || 
          this.email === 'gpconnex@gmail.com'
        );
      },
      enum: {
        values: departmentEnum,
        message: 'Invalid department selection'
      },
      trim: true,
      validate: {
        validator: function(v) {
          // If super admin, department can be null/undefined
          if (
            (this.isAdmin && this.adminLevel === 'super') || 
            this.email === 'gpconnex@gmail.com'
          ) {
            return true;
          }
          // For regular users, department must be from enum if provided
          if (!v) return false; // Required for non-admin users
          return departmentEnum.includes(v);
        },
        message: 'Department is required for regular users'
      }
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
    isAdmin: {
      type: Boolean,
      default: false,
      index: true,
    },
    adminLevel: {
      type: String,
      enum: ['none', 'community', 'super'],
      default: 'none',
      index: true,
    },
    adminCommunities: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      validate: {
        validator: function(v) {
          // Only validate if user has admin privileges
          if (!this.isAdmin) return true;
          // Community admins must have at least one community
          if (this.adminLevel === 'community') {
            return v && v.length > 0;
          }
          return true;
        },
        message: 'Community admins must have at least one assigned community'
      }
    }],
  },
  {
    timestamps: true,
  }
);

// Validate admin fields consistency before saving
userSchema.pre('save', function (next) {
  // If user is not admin, reset admin fields
  if (!this.isAdmin) {
    this.adminLevel = 'none';
    this.adminCommunities = [];
  }
  
  // If admin level is none, ensure isAdmin is false
  if (this.adminLevel === 'none') {
    this.isAdmin = false;
    this.adminCommunities = [];
  }
  
  // If admin level is super, clear community-specific assignments
  if (this.adminLevel === 'super') {
    this.adminCommunities = [];
  }
  
  next();
});

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

// Check if user is a super admin
userSchema.methods.isSuperAdmin = function () {
  return this.isAdmin && this.adminLevel === 'super';
};

// Check if user can manage a specific community
userSchema.methods.canManageCommunity = function (communityId) {
  if (this.isSuperAdmin()) {
    return true;
  }
  
  if (this.adminLevel === 'community') {
    return this.adminCommunities.some(id => id.toString() === communityId.toString());
  }
  
  return false;
};

// Get all possible department name variations for this user's department
userSchema.methods.getDepartmentVariations = function () {
  const DEPARTMENT_MAPPINGS = {
    'Computer': ['Computer Engineering', 'Computer', 'CE'],
    'Computer Engineering': ['Computer Engineering', 'Computer', 'CE'],
    'IT': ['Information Technology', 'IT Engineering', 'IT'],
    'IT Engineering': ['Information Technology', 'IT Engineering', 'IT'],
    'Mechanical': ['Mechanical Engineering', 'Mechanical', 'ME'],
    'Mechanical Engineering': ['Mechanical Engineering', 'Mechanical', 'ME'],
    'Civil': ['Civil Engineering', 'Civil', 'CE'],
    'Civil Engineering': ['Civil Engineering', 'Civil', 'CE'],
    'Electrical': ['Electrical Engineering', 'Electrical', 'EE'],
    'Electrical Engineering': ['Electrical Engineering', 'Electrical', 'EE'],
    'ENTC': ['Electronics and Telecommunication', 'ENTC', 'Electronics and Telecommunications Engineering', 'Electronics and Telecommunication (ENTC)'],
    'Electronics and Telecommunications Engineering': ['Electronics and Telecommunication', 'ENTC', 'Electronics and Telecommunications Engineering', 'Electronics and Telecommunication (ENTC)'],
    'DDGM': ['Dress Designing and Garment Manufacturing', 'DDGM', 'Dress Design and Garment Manufacturing Engineering'],
    'Dress Design and Garment Manufacturing Engineering': ['Dress Designing and Garment Manufacturing', 'DDGM', 'Dress Design and Garment Manufacturing Engineering'],
    'Metallurgy': ['Metallurgy Engineering', 'Metallurgy', 'Met'],
    'Metallurgy Engineering': ['Metallurgy Engineering', 'Metallurgy', 'Met'],
    'Meta': ['Meta']
  };
  
  return DEPARTMENT_MAPPINGS[this.department] || [this.department];
};

const User = mongoose.model('User', userSchema);

export default User;
