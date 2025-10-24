import mongoose from 'mongoose';

const communitySchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
      default: '🌐',
    },
    isAnnouncement: {
      type: Boolean,
      default: false,
    },
    members: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    messages: [{
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      content: {
        type: String,
        required: function() {
          return !this.image;
        }
      },
      image: {
        type: String,
        required: false
      },
      messageType: {
        type: String,
        enum: ['text', 'image'],
        default: 'text'
      },
      timestamp: {
        type: Date,
        default: Date.now
      }
    }],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    // Department and Admin Control Fields
    departmentRestriction: {
      type: String,
      required: false, // null means no restriction (like alumni, announcements)
      index: true
    },
    allowedDepartments: [{
      type: String,
      trim: true
    }],
    adminOnly: {
      type: Boolean,
      default: false,
      index: true
    },
    communityAdmins: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  },
  {
    timestamps: true,
  }
);

// Department mapping configuration for validation
const DEPARTMENT_MAPPINGS = {
  'Computer': {
    variations: ['Computer Engineering', 'Computer', 'CE', 'Computer Engineering'],
    communityNames: ['Computer Engineering']
  },
  'IT': {
    variations: ['Information Technology', 'IT Engineering', 'IT', 'Information Technology Engineering'],
    communityNames: ['Information Technology']
  },
  'Mechanical': {
    variations: ['Mechanical Engineering', 'Mechanical', 'ME'],
    communityNames: ['Mechanical Engineering']
  },
  'Civil': {
    variations: ['Civil Engineering', 'Civil', 'CE'],
    communityNames: ['Civil Engineering']
  },
  'Electrical': {
    variations: ['Electrical Engineering', 'Electrical', 'EE'],
    communityNames: ['Electrical Engineering']
  },
  'ENTC': {
    variations: ['Electronics and Telecommunication', 'ENTC', 'Electronics and Telecommunications Engineering', 'Electronics and Telecommunication (ENTC)'],
    communityNames: ['Electronics and Telecommunication (ENTC)']
  },
  'DDGM': {
    variations: ['Dress Designing and Garment Manufacturing', 'DDGM', 'Dress Design and Garment Manufacturing Engineering'],
    communityNames: ['Dress Designing and Garment Manufacturing (DDGM)']
  },
  'Metallurgy': {
    variations: ['Metallurgy Engineering', 'Metallurgy', 'Met'],
    communityNames: ['Metallurgy']
  }
};

// Community access validation methods
communitySchema.methods.canUserJoin = function(user) {
  // Super admin can join any community
  if (user.isAdmin && user.adminLevel === 'super') {
    return { canJoin: true, reason: 'super_admin' };
  }

  // Check if community has no department restrictions (alumni, announcements, etc.)
  if (!this.departmentRestriction && this.allowedDepartments.length === 0) {
    return { canJoin: true, reason: 'unrestricted' };
  }

  // Check if user's department matches community restrictions
  if (this.departmentRestriction || this.allowedDepartments.length > 0) {
    const userDepartment = user.department;
    if (!userDepartment) {
      return { canJoin: false, reason: 'no_department', message: 'User department not specified' };
    }

    // Check against department restriction
    if (this.departmentRestriction) {
      const isMatch = this._isDepartmentMatch(userDepartment, this.departmentRestriction);
      if (!isMatch) {
        return { 
          canJoin: false, 
          reason: 'department_mismatch', 
          message: `This community is restricted to ${this.departmentRestriction} department`,
          userDepartment: userDepartment,
          requiredDepartment: this.departmentRestriction
        };
      }
    }

    // Check against allowed departments list
    if (this.allowedDepartments.length > 0) {
      const hasMatch = this.allowedDepartments.some(dept => 
        this._isDepartmentMatch(userDepartment, dept)
      );
      if (!hasMatch) {
        return { 
          canJoin: false, 
          reason: 'department_not_allowed', 
          message: `This community is restricted to specific departments`,
          userDepartment: userDepartment,
          allowedDepartments: this.allowedDepartments
        };
      }
    }
  }

  return { canJoin: true, reason: 'department_match' };
};

communitySchema.methods.isUserAdmin = function(userId) {
  // Check if user is a community admin
  const isCommAdmin = this.communityAdmins.some(adminId => 
    adminId.toString() === userId.toString()
  );
  
  return isCommAdmin;
};

communitySchema.methods.getDepartmentMapping = function() {
  if (!this.departmentRestriction) {
    return null;
  }

  // Find the department mapping for this community's restriction
  for (const [key, mapping] of Object.entries(DEPARTMENT_MAPPINGS)) {
    if (mapping.communityNames.includes(this.departmentRestriction) ||
        mapping.variations.includes(this.departmentRestriction)) {
      return {
        department: key,
        variations: mapping.variations,
        communityNames: mapping.communityNames
      };
    }
  }

  return null;
};

// Helper method for department matching with variations
communitySchema.methods._isDepartmentMatch = function(userDepartment, communityDepartment) {
  if (!userDepartment || !communityDepartment) {
    return false;
  }

  // Direct case-insensitive match
  if (userDepartment.toLowerCase().trim() === communityDepartment.toLowerCase().trim()) {
    return true;
  }

  // Check against department mappings
  for (const mapping of Object.values(DEPARTMENT_MAPPINGS)) {
    const userInVariations = mapping.variations.some(variation => 
      variation.toLowerCase().trim() === userDepartment.toLowerCase().trim()
    );
    const communityInVariations = mapping.variations.some(variation => 
      variation.toLowerCase().trim() === communityDepartment.toLowerCase().trim()
    );
    
    if (userInVariations && communityInVariations) {
      return true;
    }
  }

  return false;
};

// Method to check if user can post in this community (admin-only posting)
communitySchema.methods.canUserPost = function(user) {
  // If community is admin-only, check admin privileges
  if (this.adminOnly) {
    // Super admin can always post
    if (user.isAdmin && user.adminLevel === 'super') {
      return { canPost: true, reason: 'super_admin' };
    }
    
    // Community admin can post
    if (this.isUserAdmin(user._id)) {
      return { canPost: true, reason: 'community_admin' };
    }
    
    return { 
      canPost: false, 
      reason: 'admin_only', 
      message: 'Only administrators can post in this community' 
    };
  }

  // Regular communities allow all members to post
  return { canPost: true, reason: 'member' };
};

const Community = mongoose.model('Community', communitySchema);

export default Community;
