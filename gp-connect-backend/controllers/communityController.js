import mongoose from 'mongoose';
import Community from '../models/Community.js';
import User from '../models/User.js';

const parseAnnouncementAdminIds = () => {
  const fromEnv = process.env.ANNOUNCEMENT_ADMIN_ID || process.env.ANNOUNCEMENT_ADMIN_IDS;
  if (!fromEnv) {
    return [];
  }
  return fromEnv
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
};

const ANNOUNCEMENT_ADMIN_IDS = parseAnnouncementAdminIds();

const toStringId = (value) => {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (value._id) {
    return value._id.toString();
  }
  if (typeof value.toString === 'function') {
    return value.toString();
  }
  return null;
};

const communityHasMember = (community, userId) => {
  if (!community || !userId) {
    return false;
  }
  const targetId = userId.toString();
  const members = community.members || [];
  return members.some((member) => toStringId(member) === targetId);
};

const isAnnouncementAdmin = (community, userId) => {
  if (!community?.isAnnouncement || !userId) {
    return true;
  }

  const idStr = userId.toString();
  if (ANNOUNCEMENT_ADMIN_IDS.includes(idStr)) {
    return true;
  }

  const createdById = toStringId(community.createdBy);
  return createdById === idStr;
};

const shapeMember = (member) => {
  if (!member) {
    return null;
  }
  if (member._id) {
    return {
      _id: member._id.toString(),
      fullName: member.fullName || '',
      profilePic: member.profilePic || '',
      enrollment: member.enrollment || '',
    };
  }
  return {
    _id: toStringId(member),
  };
};

const shapeCreator = (creator) => {
  if (!creator) {
    return null;
  }
  if (creator._id) {
    return {
      _id: creator._id.toString(),
      fullName: creator.fullName || '',
      profilePic: creator.profilePic || '',
      enrollment: creator.enrollment || '',
    };
  }
  return {
    _id: toStringId(creator),
  };
};

const shapeCommunity = (community, userId, { includeMembers = false } = {}) => {
  const members = community.members || [];
  const membersCount = members.length;
  const memberIds = members
    .map((member) => toStringId(member))
    .filter(Boolean);
  const shapedCommunity = {
    _id: community._id.toString(),
    name: community.name,
    description: community.description,
    avatar: community.avatar,
    membersCount,
    isMember: communityHasMember(community, userId),
    isAnnouncement: !!community.isAnnouncement,
    canPost: !community.isAnnouncement || isAnnouncementAdmin(community, userId),
    createdAt: community.createdAt,
    updatedAt: community.updatedAt,
    memberIds,
  };

  if (community.createdBy) {
    shapedCommunity.createdBy = shapeCreator(community.createdBy);
  }

  if (includeMembers) {
    shapedCommunity.members = members
      .slice(0, 32)
      .map((member) => shapeMember(member))
      .filter(Boolean);
  }

  return shapedCommunity;
};

const shapeMessage = (message, communityId) => ({
  _id: message._id?.toString(),
  content: message.content,
  timestamp: message.timestamp,
  sender: message.sender && message.sender._id
    ? {
        _id: message.sender._id.toString(),
        fullName: message.sender.fullName || '',
        profilePic: message.sender.profilePic || '',
        enrollment: message.sender.enrollment || '',
      }
    : null,
  communityId,
});

const ensureValidObjectId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return false;
  }
  return true;
};

export const listCommunities = async (req, res) => {
  try {
    const userId = req.user.id;
    const communities = await Community.find({}).sort({ name: 1 });

    const shapedCommunities = communities.map((community) => ({
      _id: community._id.toString(),
      name: community.name,
      description: community.description,
      avatar: community.avatar,
      membersCount: community.members?.length || 0,
      isMember: communityHasMember(community, userId),
      isAnnouncement: !!community.isAnnouncement,
    }));

    res.json(shapedCommunities);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getCommunity = async (req, res) => {
  try {
    const { communityId } = req.params;

    if (!ensureValidObjectId(communityId)) {
      return res.status(400).json({ message: 'Invalid community id' });
    }

    const community = await Community.findById(communityId)
      .populate('members', 'fullName profilePic enrollment')
      .populate('createdBy', 'fullName profilePic enrollment');

    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    }

    const shapedCommunity = shapeCommunity(community, req.user.id, { includeMembers: true });
    res.json(shapedCommunity);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const joinCommunity = async (req, res) => {
  try {
    const { communityId } = req.params;
    const userId = req.user.id;

    if (!ensureValidObjectId(communityId)) {
      return res.status(400).json({ message: 'Invalid community id' });
    }

    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    }

    if (communityHasMember(community, userId)) {
      return res.status(400).json({ message: 'User is already a member' });
    }

    community.members.push(req.user._id);
    await community.save();

    const populatedCommunity = await Community.findById(communityId)
      .populate('members', 'fullName profilePic enrollment')
      .populate('createdBy', 'fullName profilePic enrollment');

    const shapedCommunity = shapeCommunity(populatedCommunity, userId, { includeMembers: true });
    const memberIds = (populatedCommunity.members || []).map((member) => toStringId(member)).filter(Boolean);

    const io = req.app.get('io');
    if (io) {
      const payload = {
        communityId: shapedCommunity._id,
        membersCount: shapedCommunity.membersCount,
        members: shapedCommunity.members,
        memberIds,
      };
      io.to(`community_${shapedCommunity._id}`).emit('community:memberUpdate', payload);
      io.emit('community:metaUpdate', {
        communityId: shapedCommunity._id,
        membersCount: shapedCommunity.membersCount,
      });
    }

    res.json({
      success: true,
      message: 'Successfully joined the community',
      community: shapedCommunity,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const leaveCommunity = async (req, res) => {
  try {
    const { communityId } = req.params;
    const userId = req.user.id;

    if (!ensureValidObjectId(communityId)) {
      return res.status(400).json({ message: 'Invalid community id' });
    }

    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    }

    if (!communityHasMember(community, userId)) {
      return res.status(400).json({ message: 'User is not a member' });
    }

    community.members = community.members.filter((memberId) => toStringId(memberId) !== userId.toString());
    await community.save();

    const populatedCommunity = await Community.findById(communityId)
      .populate('members', 'fullName profilePic enrollment')
      .populate('createdBy', 'fullName profilePic enrollment');

    const shapedCommunity = shapeCommunity(populatedCommunity, userId, { includeMembers: true });
    const memberIds = (populatedCommunity.members || []).map((member) => toStringId(member)).filter(Boolean);

    const io = req.app.get('io');
    if (io) {
      const payload = {
        communityId: shapedCommunity._id,
        membersCount: shapedCommunity.membersCount,
        members: shapedCommunity.members,
        memberIds,
      };
      io.to(`community_${shapedCommunity._id}`).emit('community:memberUpdate', payload);
      io.emit('community:metaUpdate', {
        communityId: shapedCommunity._id,
        membersCount: shapedCommunity.membersCount,
      });
    }

    res.json({
      success: true,
      message: 'Successfully left the community',
      community: shapedCommunity,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getCommunityMessages = async (req, res) => {
  try {
    const { communityId } = req.params;
    const userId = req.user.id;

    if (!ensureValidObjectId(communityId)) {
      return res.status(400).json({ message: 'Invalid community id' });
    }

    const community = await Community.findById(communityId)
      .populate('messages.sender', 'fullName profilePic enrollment');

    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    }

    if (!communityHasMember(community, userId)) {
      return res.status(403).json({ message: 'You must be a member to view messages' });
    }

    const sortedMessages = [...(community.messages || [])].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );

    const shapedMessages = sortedMessages.map((message) =>
      shapeMessage(message, communityId.toString())
    );

    res.json(shapedMessages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { communityId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!ensureValidObjectId(communityId)) {
      return res.status(400).json({ message: 'Invalid community id' });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'Message content cannot be empty' });
    }

    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    }

    if (!communityHasMember(community, userId)) {
      return res.status(403).json({ message: 'You must be a member to send messages' });
    }

    if (community.isAnnouncement && !isAnnouncementAdmin(community, userId)) {
      return res.status(403).json({ message: 'Only admin can post announcements.' });
    }

    const trimmedContent = content.trim();
    const newMessage = {
      sender: req.user._id,
      content: trimmedContent,
      timestamp: new Date(),
    };

    community.messages.push(newMessage);
    await community.save();

    const savedMessage = community.messages[community.messages.length - 1];
    const sender = await User.findById(userId).select('fullName profilePic enrollment');

    const shapedMessage = {
      _id: savedMessage._id.toString(),
      content: savedMessage.content,
      timestamp: savedMessage.timestamp,
      communityId: communityId.toString(),
      sender: sender
        ? {
            _id: sender._id.toString(),
            fullName: sender.fullName || '',
            profilePic: sender.profilePic || '',
            enrollment: sender.enrollment || '',
          }
        : null,
    };

    const io = req.app.get('io');
    if (io) {
      io.to(`community_${communityId}`).emit('community:message', {
        communityId: shapedMessage.communityId,
        message: shapedMessage,
      });
    }

    res.status(201).json(shapedMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
