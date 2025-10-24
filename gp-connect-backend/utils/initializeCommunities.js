import mongoose from 'mongoose';
import Community from '../models/Community.js';
import User from '../models/User.js';

const getDefaultCommunities = () => ([
  {
    key: 'announcement',
    name: 'Official Announcements Community',
    description: 'Stay informed with the latest news, alerts, and official updates from the GP-ConneX team.',
    avatar: '🌐',
    isAnnouncement: true,
    enforcedId: process.env.GENERAL_COMMUNITY_ID,
    aliases: ['GP-ConneX CommonCommunity'],
  },
  {
    key: 'computer',
    name: 'Computer Engineering',
    description: 'Collaborate on software, hardware, and research with fellow Computer Engineering students.',
    avatar: '💻',
  },
  {
    key: 'it',
    name: 'Information Technology',
    description: 'Discuss web, mobile, data, and IT innovations with the Information Technology department.',
    avatar: '🖥️',
  },
  {
    key: 'mechanical',
    name: 'Mechanical Engineering',
    description: 'Share mechanical design, production ideas, and robotics builds.',
    avatar: '⚙️',
  },
  {
    key: 'civil',
    name: 'Civil Engineering',
    description: 'Plan structures, exchange civil project insights, and field experiences.',
    avatar: '🏗️',
  },
  {
    key: 'electrical',
    name: 'Electrical Engineering',
    description: 'Dive into power systems, circuits, and electrical innovations.',
    avatar: '⚡',
  },
  {
    key: 'entc',
    name: 'Electronics and Telecommunication (ENTC)',
    description: 'Signal processing, communication systems, and electronics enthusiasts hangout.',
    avatar: '📡',
  },
  {
    key: 'ddgm',
    name: 'Dress Designing and Garment Manufacturing (DDGM)',
    description: 'A creative space for fashion, textile, and garment design engineering students to collaborate and innovate.',
    avatar: '�',
    aliases: ['DDGM'],
  },
  {
    key: 'metallurgy',
    name: 'Metallurgy',
    description: 'Materials science, metal processing, and industrial metallurgy discussions.',
    avatar: '🔧',
  },
  {
    key: 'alumni',
    name: 'Alumni',
    description: 'Connect with graduates, share experiences, and build professional networks with alumni from all departments.',
    avatar: '🎓',
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

const ensureAdminUser = async () => {
  const preferredAdminIds = parseAdminIds();

  for (const adminId of preferredAdminIds) {
    const user = await User.findById(adminId);
    if (user) {
      return user;
    }
  }

  let adminUser = await User.findOne({ email: 'admin@gpconnect.com' });
  if (!adminUser) {
    adminUser = new User({
      fullName: 'GP-ConneX Admin',
      email: 'admin@gpconnect.com',
      password: 'Admin@123',
      enrollment: 'ADMIN01',
      department: 'Computer',
      isVerified: true,
    });
    await adminUser.save();
    console.log('➕ Created default admin user admin@gpconnect.com');
  }

  if (!adminUser.isVerified) {
    adminUser.isVerified = true;
    await adminUser.save();
  }

  return adminUser;
};

const ensureCommunity = async (config, adminUser) => {
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
      createdBy: adminUser._id,
      members: config.isAnnouncement ? [adminUser._id] : [],
      messages: [],
    };

    if (enforcedObjectId) {
      communityData._id = enforcedObjectId;
    }

    const created = new Community(communityData);
    await created.save();
    console.log(`✅ Ensured community: ${config.name}`);
    return;
  }

  let hasChanges = false;

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

  if (!community.createdBy) {
    community.createdBy = adminUser._id;
    hasChanges = true;
  }

  if (community.isAnnouncement) {
    const addedAdmin = addAdminToCommunityMembers(community, adminUser._id);
    if (addedAdmin) {
      hasChanges = true;
    }
  }

  if (hasChanges) {
    await community.save();
    console.log(`🔄 Updated community: ${config.name}`);
  }
};

const initializeCommunities = async () => {
  const adminUser = await ensureAdminUser();

  const defaultCommunities = getDefaultCommunities();

  for (const communityConfig of defaultCommunities) {
    try {
      await ensureCommunity(communityConfig, adminUser);
    } catch (error) {
      console.error(`❌ Failed to ensure community ${communityConfig.name}:`, error.message);
    }
  }
};

export default initializeCommunities;
