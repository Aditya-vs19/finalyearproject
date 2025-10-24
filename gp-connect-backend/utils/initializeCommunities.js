import mongoose from 'mongoose';
import Community from '../models/Community.js';
import User from '../models/User.js';
import AdminService from '../services/adminService.js';
import DepartmentService from '../services/departmentService.js';

const getDefaultCommunities = () => ([
  {
    key: 'announcement',
    name: 'Official Announcements Community',
    description: 'Stay informed with the latest news, alerts, and official updates from the GP-ConneX team.',
    avatar: '🌐',
    isAnnouncement: true,
    adminOnly: true, // Only admins can post
    departmentRestriction: null, // No department restriction - all can join
    enforcedId: process.env.GENERAL_COMMUNITY_ID,
    aliases: ['GP-ConneX CommonCommunity'],
  },
  {
    key: 'computer',
    name: 'Computer Engineering',
    description: 'Collaborate on software, hardware, and research with fellow Computer Engineering students.',
    avatar: '💻',
    departmentRestriction: 'Computer Engineering',
  },
  {
    key: 'it',
    name: 'Information Technology',
    description: 'Discuss web, mobile, data, and IT innovations with the Information Technology department.',
    avatar: '🖥️',
    departmentRestriction: 'Information Technology',
  },
  {
    key: 'mechanical',
    name: 'Mechanical Engineering',
    description: 'Share mechanical design, production ideas, and robotics builds.',
    avatar: '⚙️',
    departmentRestriction: 'Mechanical Engineering',
  },
  {
    key: 'civil',
    name: 'Civil Engineering',
    description: 'Plan structures, exchange civil project insights, and field experiences.',
    avatar: '🏗️',
    departmentRestriction: 'Civil Engineering',
  },
  {
    key: 'electrical',
    name: 'Electrical Engineering',
    description: 'Dive into power systems, circuits, and electrical innovations.',
    avatar: '⚡',
    departmentRestriction: 'Electrical Engineering',
  },
  {
    key: 'entc',
    name: 'Electronics and Telecommunication (ENTC)',
    description: 'Signal processing, communication systems, and electronics enthusiasts hangout.',
    avatar: '📡',
    departmentRestriction: 'Electronics and Telecommunication (ENTC)',
  },
  {
    key: 'ddgm',
    name: 'Dress Designing and Garment Manufacturing (DDGM)',
    description: 'A creative space for fashion, textile, and garment design engineering students to collaborate and innovate.',
    avatar: '👗',
    departmentRestriction: 'Dress Designing and Garment Manufacturing (DDGM)',
    aliases: ['DDGM'],
  },
  {
    key: 'metallurgy',
    name: 'Metallurgy',
    description: 'Materials science, metal processing, and industrial metallurgy discussions.',
    avatar: '🔧',
    departmentRestriction: 'Metallurgy',
  },
  {
    key: 'alumni',
    name: 'Alumni',
    description: 'Connect with graduates, share experiences, and build professional networks with alumni from all departments.',
    avatar: '🎓',
    departmentRestriction: null, // No department restriction - all can join
  },
]);

const toObjectId = (value) => {
  if (!value) {
    return null;
  }
  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }
  if (mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return null;
};

const parseAdminIds = () => {
  const fromEnv = process.env.ANNOUNCEMENT_ADMIN_ID || process.env.ANNOUNCEMENT_ADMIN_IDS;
  if (!fromEnv) {
    return [];
  }
  return fromEnv
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => (mongoose.Types.ObjectId.isValid(value) ? value : null))
    .filter(Boolean);
};

const addAdminToCommunityMembers = (community, adminId) => {
  const adminIdStr = adminId.toString();
  const alreadyMember = (community.members || []).some((member) => {
    if (member instanceof mongoose.Types.ObjectId) {
      return member.toString() === adminIdStr;
    }
    if (typeof member === 'string') {
      return member === adminIdStr;
    }
    if (member?._id) {
      return member._id.toString() === adminIdStr;
    }
    return false;
  });

  if (!alreadyMember) {
    community.members = [adminId, ...(community.members || [])];
    return true;
  }

  return false;
};

const ensureSuperAdmin = async () => {
  const superAdminEmail = 'gpconnex@gmail.com';
  
  // Use AdminService to ensure super admin exists
  const result = await AdminService.ensureSuperAdmin(superAdminEmail);
  
  if (!result.success) {
    console.error('❌ Failed to ensure super admin:', result.message);
    throw new Error(`Failed to create super admin: ${result.message}`);
  }

  console.log(`✅ Super admin ensured: ${superAdminEmail}`);
  return result.user;
};

const migrateLegacyAdmin = async () => {
  const legacyAdminEmail = 'admin@gpconnect.com';
  const newSuperAdminEmail = 'gpconnex@gmail.com';
  
  // Check if legacy admin exists
  const legacyAdmin = await User.findOne({ email: legacyAdminEmail });
  
  if (legacyAdmin) {
    console.log('🔄 Migrating legacy admin account...');
    
    const migrationResult = await AdminService.migrateLegacyAdmin(
      legacyAdminEmail, 
      newSuperAdminEmail
    );
    
    if (migrationResult.success) {
      console.log(`✅ Successfully migrated from ${legacyAdminEmail} to ${newSuperAdminEmail}`);
      console.log(`   - Communities migrated: ${migrationResult.communitiesMigrated}`);
    } else {
      console.error('❌ Failed to migrate legacy admin:', migrationResult.message);
    }
  } else {
    console.log('ℹ️ No legacy admin account found to migrate');
  }
};

const ensureCommunity = async (config, superAdmin) => {
  const enforcedObjectId = toObjectId(config.enforcedId);

  let community = await Community.findOne({ name: config.name });
  if (!community && Array.isArray(config.aliases) && config.aliases.length > 0) {
    community = await Community.findOne({ name: { $in: config.aliases } });
  }
  if (!community && enforcedObjectId) {
    community = await Community.findById(enforcedObjectId);
  }

  if (!community) {
    const communityData = {
      name: config.name,
      description: config.description,
      avatar: config.avatar,
      isAnnouncement: !!config.isAnnouncement,
      adminOnly: !!config.adminOnly,
      departmentRestriction: config.departmentRestriction || null,
      allowedDepartments: config.departmentRestriction ? 
        DepartmentService.getDepartmentVariations(config.departmentRestriction) : [],
      createdBy: superAdmin._id,
      members: [superAdmin._id], // Super admin is always a member
      communityAdmins: [superAdmin._id], // Super admin is always a community admin
      messages: [],
    };

    if (enforcedObjectId) {
      communityData._id = enforcedObjectId;
    }

    const created = new Community(communityData);
    await created.save();
    console.log(`✅ Created community: ${config.name} (Department: ${config.departmentRestriction || 'Unrestricted'})`);
    return created;
  }

  let hasChanges = false;

  // Update basic community properties
  if (community.name !== config.name) {
    community.name = config.name;
    hasChanges = true;
  }

  if (community.description !== config.description) {
    community.description = config.description;
    hasChanges = true;
  }

  if (community.avatar !== config.avatar) {
    community.avatar = config.avatar;
    hasChanges = true;
  }

  if (community.isAnnouncement !== !!config.isAnnouncement) {
    community.isAnnouncement = !!config.isAnnouncement;
    hasChanges = true;
  }

  // Update admin-only setting
  if (community.adminOnly !== !!config.adminOnly) {
    community.adminOnly = !!config.adminOnly;
    hasChanges = true;
  }

  // Update department restriction
  const newDepartmentRestriction = config.departmentRestriction || null;
  if (community.departmentRestriction !== newDepartmentRestriction) {
    community.departmentRestriction = newDepartmentRestriction;
    hasChanges = true;
  }

  // Update allowed departments based on department restriction
  const newAllowedDepartments = newDepartmentRestriction ? 
    DepartmentService.getDepartmentVariations(newDepartmentRestriction) : [];
  
  const currentAllowedDepts = community.allowedDepartments || [];
  if (JSON.stringify(currentAllowedDepts.sort()) !== JSON.stringify(newAllowedDepartments.sort())) {
    community.allowedDepartments = newAllowedDepartments;
    hasChanges = true;
  }

  if (!community.createdBy) {
    community.createdBy = superAdmin._id;
    hasChanges = true;
  }

  // Ensure super admin is a member
  const addedAsMember = addAdminToCommunityMembers(community, superAdmin._id);
  if (addedAsMember) {
    hasChanges = true;
  }

  // Ensure super admin is in community admins
  const superAdminIdStr = superAdmin._id.toString();
  const isAlreadyCommAdmin = (community.communityAdmins || []).some(adminId => 
    adminId.toString() === superAdminIdStr
  );
  
  if (!isAlreadyCommAdmin) {
    community.communityAdmins = community.communityAdmins || [];
    community.communityAdmins.push(superAdmin._id);
    hasChanges = true;
  }

  if (hasChanges) {
    await community.save();
    console.log(`🔄 Updated community: ${config.name} (Department: ${config.departmentRestriction || 'Unrestricted'})`);
  }

  return community;
};

const initializeCommunities = async () => {
  console.log('🚀 Starting community initialization...');
  
  try {
    // Step 1: Ensure super admin exists
    const superAdmin = await ensureSuperAdmin();
    
    // Step 2: Migrate legacy admin if exists
    await migrateLegacyAdmin();
    
    // Step 3: Initialize all communities with department restrictions
    const defaultCommunities = getDefaultCommunities();
    
    console.log(`📋 Initializing ${defaultCommunities.length} communities...`);
    
    for (const communityConfig of defaultCommunities) {
      try {
        await ensureCommunity(communityConfig, superAdmin);
      } catch (error) {
        console.error(`❌ Failed to ensure community ${communityConfig.name}:`, error.message);
      }
    }
    
    // Step 4: Add super admin to all existing communities (including any not in default list)
    await AdminService.addSuperAdminToAllCommunities(superAdmin._id);
    
    console.log('✅ Community initialization completed successfully');
    
  } catch (error) {
    console.error('❌ Community initialization failed:', error.message);
    throw error;
  }
};

export default initializeCommunities;
