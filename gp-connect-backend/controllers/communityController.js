import mongoose from 'mongoose';
import Community from '../models/Community.js';
import User from '../models/User.js';
import AdminService from '../services/adminService.js';
import DepartmentService from '../services/departmentService.js';
import EnhancedErrorHandler from '../utils/errorHandler.js';

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
      isAdmin: !!member.isAdmin,
      adminLevel: member.adminLevel || 'none'
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

const shapeCommunity = async (community, userId, { includeMembers = false } = {}) => {
  const members = community.members || [];
  const membersCount = members.length;
  const memberIds = members
    .map((member) => toStringId(member))
    .filter(Boolean);
  
  // Check admin status for enhanced display
  const user = await User.findById(userId);
  const isSuperAdmin = user ? await AdminService.isSuperAdmin(userId) : false;
  const isCommAdmin = community.isUserAdmin ? community.isUserAdmin(userId) : false;
  
  const shapedCommunity = {
    _id: community._id.toString(),
    name: community.name,
    description: community.description,
    avatar: community.avatar,
    membersCount,
    isMember: communityHasMember(community, userId),
    isAnnouncement: !!community.isAnnouncement,
    canPost: !community.isAnnouncement || isAnnouncementAdmin(community, userId) || isSuperAdmin || isCommAdmin,
    createdAt: community.createdAt,
    updatedAt: community.updatedAt,
    memberIds,
    // Enhanced admin and department information
    departmentRestriction: community.departmentRestriction || null,
    adminOnly: !!community.adminOnly,
    isUnrestricted: DepartmentService.isUnrestrictedCommunity(community.name),
    userIsAdmin: isSuperAdmin || isCommAdmin,
    userIsSuperAdmin: isSuperAdmin
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
  image: message.image,
  messageType: message.messageType || 'text',
  timestamp: message.timestamp,
  sender: message.sender && message.sender._id
    ? {
        _id: message.sender._id.toString(),
        fullName: message.sender.fullName || '',
        profilePic: message.sender.profilePic || '',
        enrollment: message.sender.enrollment || '',
        isAdmin: !!message.sender.isAdmin,
        adminLevel: message.sender.adminLevel || 'none'
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
    const user = await User.findById(userId);
    const communities = await Community.find({})
      .populate('communityAdmins', 'fullName profilePic enrollment')
      .sort({ name: 1 });

    const shapedCommunities = await Promise.all(
      communities.map(async (community) => {
        // Check if user can join this community
        const canJoinResult = user ? await community.canUserJoin(user) : { canJoin: false, reason: 'no_user' };
        
        // Check admin status
        const isSuperAdmin = user ? await AdminService.isSuperAdmin(userId) : false;
        const isCommAdmin = community.isUserAdmin ? community.isUserAdmin(userId) : false;
        
        // Enhanced community information with detailed admin and department data
        const communityData = {
          _id: community._id.toString(),
          name: community.name,
          description: community.description,
          avatar: community.avatar,
          membersCount: community.members?.length || 0,
          isMember: communityHasMember(community, userId),
          isAnnouncement: !!community.isAnnouncement,
          
          // Enhanced department restriction information
          departmentRestriction: community.departmentRestriction || null,
          adminOnly: !!community.adminOnly,
          isUnrestricted: DepartmentService.isUnrestrictedCommunity(community.name),
          
          // Join permission details
          canJoin: canJoinResult.canJoin,
          joinRestrictionReason: canJoinResult.reason || null,
          joinRestrictionMessage: canJoinResult.message || null,
          
          // User admin status
          userIsAdmin: isSuperAdmin || isCommAdmin,
          userIsSuperAdmin: isSuperAdmin,
          userIsCommunityAdmin: isCommAdmin,
          
          // Community admin information
          communityAdmins: community.communityAdmins?.map(admin => ({
            _id: admin._id.toString(),
            fullName: admin.fullName,
            profilePic: admin.profilePic
          })) || [],
          hasAdmins: (community.communityAdmins?.length || 0) > 0,
          
          // Enhanced department matching information
          departmentInfo: {
            userDepartment: user?.department || null,
            requiredDepartment: community.departmentRestriction,
            departmentMatch: user && community.departmentRestriction ? 
              DepartmentService.departmentsMatch(user.department, community.departmentRestriction) : null,
            allowedVariations: community.departmentRestriction ? 
              DepartmentService.getDepartmentVariations(community.departmentRestriction) : null
          },
          
          // Access control summary
          accessSummary: {
            type: community.isAnnouncement ? 'announcement' : 
                  community.adminOnly ? 'admin_only' : 
                  community.departmentRestriction ? 'department_restricted' : 'open',
            canPost: user ? (await community.canUserPost(user)).canPost : false,
            restrictions: []
          }
        };

        // Build restrictions array for UI display
        if (community.departmentRestriction && !DepartmentService.isUnrestrictedCommunity(community.name)) {
          communityData.accessSummary.restrictions.push({
            type: 'department',
            description: `Restricted to ${community.departmentRestriction} department`,
            userMeetsRequirement: communityData.departmentInfo.departmentMatch
          });
        }

        if (community.adminOnly) {
          communityData.accessSummary.restrictions.push({
            type: 'admin_only',
            description: 'Administrator access only',
            userMeetsRequirement: isSuperAdmin || isCommAdmin
          });
        }

        if (community.isAnnouncement) {
          communityData.accessSummary.restrictions.push({
            type: 'admin_post_only',
            description: 'Only administrators can post',
            userMeetsRequirement: isSuperAdmin || isCommAdmin
          });
        }

        // Add helpful messages for restricted access
        if (!canJoinResult.canJoin && canJoinResult.reason) {
          switch (canJoinResult.reason) {
            case 'department_mismatch':
              communityData.helpMessage = `This community is for ${community.departmentRestriction} department members. Your department: ${user?.department || 'Not specified'}`;
              break;
            case 'admin_only':
              communityData.helpMessage = 'This community is restricted to administrators only.';
              break;
            case 'no_department':
              communityData.helpMessage = 'Please specify your department in your profile to join department-restricted communities.';
              break;
            default:
              communityData.helpMessage = canJoinResult.message || 'Access restricted';
          }
        }

        return communityData;
      })
    );

    res.json(shapedCommunities);
  } catch (error) {
    console.error('Error listing communities:', error);
    const errorResponse = EnhancedErrorHandler.createServerError('list communities', error, {
      operation: 'listCommunities',
      userId: req.user?.id
    });
    res.status(500).json(errorResponse);
  }
};

export const getCommunity = async (req, res) => {
  try {
    const { communityId } = req.params;

    if (!ensureValidObjectId(communityId)) {
      const errorResponse = EnhancedErrorHandler.createValidationError(
        'community ID', 
        communityId, 
        'Must be a valid MongoDB ObjectId',
        { operation: 'getCommunity' }
      );
      return res.status(400).json(errorResponse);
    }

    const community = await Community.findById(communityId)
      .populate('members', 'fullName profilePic enrollment isAdmin adminLevel')
      .populate('createdBy', 'fullName profilePic enrollment')
      .populate('communityAdmins', 'fullName profilePic enrollment');

    if (!community) {
      const errorResponse = EnhancedErrorHandler.createCommunityNotFoundError(communityId, {
        operation: 'getCommunity',
        userId: req.user?.id
      });
      return res.status(404).json(errorResponse);
    }

    const shapedCommunity = await shapeCommunity(community, req.user.id, { includeMembers: true });
    res.json(shapedCommunity);
  } catch (error) {
    console.error('Error getting community:', error);
    const errorResponse = EnhancedErrorHandler.createServerError('get community', error, {
      operation: 'getCommunity',
      communityId: req.params.communityId,
      userId: req.user?.id
    });
    res.status(500).json(errorResponse);
  }
};

export const joinCommunity = async (req, res) => {
  try {
    const { communityId } = req.params;
    const userId = req.user.id;

    // Use middleware validation results if available
    const communityAccess = req.communityAccess;
    
    if (!communityAccess || !communityAccess.canJoin) {
      // This should not happen if middleware is working correctly, but provide enhanced error
      const errorResponse = EnhancedErrorHandler.createServerError('join community', new Error('Middleware validation failed'), {
        operation: 'joinCommunity',
        communityId,
        userId,
        middlewareError: true
      });
      return res.status(403).json(errorResponse);
    }

    const community = communityAccess.community;
    const user = communityAccess.user;

    // Add user to community
    community.members.push(req.user._id);
    await community.save();

    const populatedCommunity = await Community.findById(communityId)
      .populate('members', 'fullName profilePic enrollment isAdmin adminLevel')
      .populate('createdBy', 'fullName profilePic enrollment')
      .populate('communityAdmins', 'fullName profilePic enrollment');

    const shapedCommunity = await shapeCommunity(populatedCommunity, userId, { includeMembers: true });
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
      joinReason: communityAccess.reason || 'allowed',
      accessType: communityAccess.reason
    });
  } catch (error) {
    console.error('Error joining community:', error);
    const errorResponse = EnhancedErrorHandler.createServerError('join community', error, {
      operation: 'joinCommunity',
      communityId: req.params.communityId,
      userId: req.user?.id
    });
    res.status(500).json(errorResponse);
  }
};

export const leaveCommunity = async (req, res) => {
  try {
    const { communityId } = req.params;
    const userId = req.user.id;

    if (!ensureValidObjectId(communityId)) {
      const errorResponse = EnhancedErrorHandler.createValidationError(
        'community ID', 
        communityId, 
        'Must be a valid MongoDB ObjectId',
        { operation: 'leaveCommunity' }
      );
      return res.status(400).json(errorResponse);
    }

    const community = await Community.findById(communityId);
    if (!community) {
      const errorResponse = EnhancedErrorHandler.createCommunityNotFoundError(communityId, {
        operation: 'leaveCommunity',
        userId
      });
      return res.status(404).json(errorResponse);
    }

    if (!communityHasMember(community, userId)) {
      const errorResponse = EnhancedErrorHandler.createValidationError(
        'membership status',
        'not a member',
        'You must be a member of the community to leave it',
        { 
          operation: 'leaveCommunity',
          communityId,
          communityName: community.name,
          userId
        }
      );
      return res.status(400).json(errorResponse);
    }

    community.members = community.members.filter((memberId) => toStringId(memberId) !== userId.toString());
    await community.save();

    const populatedCommunity = await Community.findById(communityId)
      .populate('members', 'fullName profilePic enrollment isAdmin adminLevel')
      .populate('createdBy', 'fullName profilePic enrollment')
      .populate('communityAdmins', 'fullName profilePic enrollment');

    const shapedCommunity = await shapeCommunity(populatedCommunity, userId, { includeMembers: true });
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
    console.error('Error leaving community:', error);
    const errorResponse = EnhancedErrorHandler.createServerError('leave community', error, {
      operation: 'leaveCommunity',
      communityId: req.params.communityId,
      userId: req.user?.id
    });
    res.status(500).json(errorResponse);
  }
};

export const getCommunityMessages = async (req, res) => {
  try {
    const { communityId } = req.params;
    const userId = req.user.id;

    if (!ensureValidObjectId(communityId)) {
      const errorResponse = EnhancedErrorHandler.createValidationError(
        'community ID', 
        communityId, 
        'Must be a valid MongoDB ObjectId',
        { operation: 'getCommunityMessages' }
      );
      return res.status(400).json(errorResponse);
    }

    const community = await Community.findById(communityId)
      .populate('messages.sender', 'fullName profilePic enrollment isAdmin adminLevel');

    if (!community) {
      const errorResponse = EnhancedErrorHandler.createCommunityNotFoundError(communityId, {
        operation: 'getCommunityMessages',
        userId
      });
      return res.status(404).json(errorResponse);
    }

    if (!communityHasMember(community, userId)) {
      const errorResponse = EnhancedErrorHandler.createValidationError(
        'membership status',
        'not a member',
        'You must be a member of the community to view messages',
        { 
          operation: 'getCommunityMessages',
          communityId,
          communityName: community.name,
          userId,
          suggestion: 'Join the community first to view messages'
        }
      );
      return res.status(403).json(errorResponse);
    }

    const sortedMessages = [...(community.messages || [])].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );

    const shapedMessages = sortedMessages.map((message) =>
      shapeMessage(message, communityId.toString())
    );

    res.json(shapedMessages);
  } catch (error) {
    console.error('Error getting community messages:', error);
    const errorResponse = EnhancedErrorHandler.createServerError('get community messages', error, {
      operation: 'getCommunityMessages',
      communityId: req.params.communityId,
      userId: req.user?.id
    });
    res.status(500).json(errorResponse);
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { communityId } = req.params;
    const userId = req.user.id;

    // Check if it's an image upload or text message
    const isImageUpload = req.file;
    const content = req.body?.content || '';
    
    if (!isImageUpload && (!content || content.trim().length === 0)) {
      const errorResponse = EnhancedErrorHandler.createValidationError(
        'message content',
        content,
        'Message content or image is required',
        { 
          operation: 'sendMessage',
          communityId,
          userId,
          messageType: isImageUpload ? 'image' : 'text'
        }
      );
      return res.status(400).json(errorResponse);
    }

    // Use middleware validation results if available
    const postAccess = req.postAccess;
    
    if (!postAccess || !postAccess.canPost) {
      // This should not happen if middleware is working correctly, but provide enhanced error
      const errorResponse = EnhancedErrorHandler.createServerError('send message', new Error('Middleware validation failed'), {
        operation: 'sendMessage',
        communityId,
        userId,
        middlewareError: true,
        postAccessDetails: postAccess
      });
      return res.status(403).json(errorResponse);
    }

    const community = postAccess.community;
    const user = postAccess.user;

    const newMessage = {
      sender: req.user._id,
      timestamp: new Date(),
    };

    if (isImageUpload) {
      newMessage.image = req.file.filename;
      newMessage.messageType = 'image';
      newMessage.content = content ? content.trim() : '';
    } else {
      newMessage.content = content.trim();
      newMessage.messageType = 'text';
    }

    community.messages.push(newMessage);
    await community.save();

    const savedMessage = community.messages[community.messages.length - 1];
    const sender = await User.findById(userId).select('fullName profilePic enrollment isAdmin adminLevel');

    const shapedMessage = {
      _id: savedMessage._id.toString(),
      content: savedMessage.content || '',
      image: savedMessage.image || null,
      messageType: savedMessage.messageType || 'text',
      timestamp: savedMessage.timestamp,
      communityId: communityId.toString(),
      sender: sender
        ? {
            _id: sender._id.toString(),
            fullName: sender.fullName || '',
            profilePic: sender.profilePic || '',
            enrollment: sender.enrollment || '',
            isAdmin: !!sender.isAdmin,
            adminLevel: sender.adminLevel || 'none'
          }
        : null,
      // Add enhanced context about posting permissions and admin status
      postReason: postAccess.reason || 'member',
      isAdminPost: postAccess.reason === 'super_admin' || postAccess.reason === 'community_admin',
      adminContext: {
        postedByAdmin: postAccess.reason === 'super_admin' || postAccess.reason === 'community_admin',
        adminLevel: sender?.adminLevel || 'none',
        communityAdminOnly: !!community.adminOnly,
        isAnnouncementCommunity: !!community.isAnnouncement,
        accessReason: postAccess.reason
      }
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
    console.error('Error sending message:', error);
    const errorResponse = EnhancedErrorHandler.createServerError('send message', error, {
      operation: 'sendMessage',
      communityId: req.params.communityId,
      userId: req.user?.id,
      messageType: req.file ? 'image' : 'text'
    });
    res.status(500).json(errorResponse);
  }
};
