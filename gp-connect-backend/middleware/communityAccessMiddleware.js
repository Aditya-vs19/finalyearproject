import asyncHandler from 'express-async-handler';
import Community from '../models/Community.js';
import User from '../models/User.js';
import AdminService from '../services/adminService.js';
import DepartmentService from '../services/departmentService.js';
import EnhancedErrorHandler from '../utils/errorHandler.js';

/**
 * CommunityAccessMiddleware - Handles department-based community access control
 * 
 * Provides middleware functions for validating community join and post operations
 * based on department restrictions and admin privileges.
 * 
 * Requirements: 3.2, 3.3, 4.1, 4.2, 4.4, 4.5
 */
class CommunityAccessMiddleware {

  /**
   * Middleware to validate community join requests
   * Checks department restrictions and admin privileges
   * 
   * Requirements: 3.2, 3.3, 4.1, 4.2
   */
  static validateCommunityJoin = asyncHandler(async (req, res, next) => {
    try {
      const { communityId } = req.params;
      const userId = req.user._id;

      // Get community and user data
      const community = await Community.findById(communityId);
      if (!community) {
        const errorResponse = EnhancedErrorHandler.createCommunityNotFoundError(communityId, {
          operation: 'validateCommunityJoin',
          userId,
          middleware: 'communityAccessMiddleware'
        });
        return res.status(404).json(errorResponse);
      }

      const user = await User.findById(userId);
      if (!user) {
        const errorResponse = EnhancedErrorHandler.createUserNotFoundError({
          operation: 'validateCommunityJoin',
          userId,
          middleware: 'communityAccessMiddleware'
        });
        return res.status(404).json(errorResponse);
      }

      // Check if user is already a member
      const isAlreadyMember = community.members.some(
        memberId => memberId.toString() === userId.toString()
      );

      if (isAlreadyMember) {
        const errorResponse = EnhancedErrorHandler.createAlreadyMemberError(community.name, {
          operation: 'validateCommunityJoin',
          communityId,
          userId,
          middleware: 'communityAccessMiddleware'
        });
        return res.status(400).json(errorResponse);
      }

      // Check if community is unrestricted (alumni, announcements, etc.)
      if (CommunityAccessMiddleware.isUnrestrictedCommunity(community)) {
        // Allow join for unrestricted communities
        req.communityAccess = {
          canJoin: true,
          reason: 'unrestricted_community',
          community: community,
          user: user
        };
        return next();
      }

      // Check department restrictions
      const departmentValidation = await CommunityAccessMiddleware.checkDepartmentRestriction(user, community);
      
      if (!departmentValidation.success) {
        const errorResponse = EnhancedErrorHandler.createDepartmentRestrictionError(user, community, {
          operation: 'validateCommunityJoin',
          middleware: 'communityAccessMiddleware',
          validationDetails: departmentValidation
        });
        return res.status(403).json(errorResponse);
      }

      // Access granted
      req.communityAccess = {
        canJoin: true,
        reason: departmentValidation.reason,
        community: community,
        user: user
      };

      next();

    } catch (error) {
      console.error('Community join validation error:', error);
      const errorResponse = EnhancedErrorHandler.createServerError('validate community join', error, {
        operation: 'validateCommunityJoin',
        communityId: req.params.communityId,
        userId: req.user?._id,
        middleware: 'communityAccessMiddleware'
      });
      res.status(500).json(errorResponse);
    }
  });

  /**
   * Middleware to validate community post requests
   * Enforces admin-only posting rules for announcement communities
   * 
   * Requirements: 4.1, 4.2, 4.4, 4.5
   */
  static validateCommunityPost = asyncHandler(async (req, res, next) => {
    try {
      const { communityId } = req.params;
      const userId = req.user._id;

      // Get community and user data
      const community = await Community.findById(communityId);
      if (!community) {
        const errorResponse = EnhancedErrorHandler.createCommunityNotFoundError(communityId, {
          operation: 'validateCommunityPost',
          userId,
          middleware: 'communityAccessMiddleware'
        });
        return res.status(404).json(errorResponse);
      }

      const user = await User.findById(userId);
      if (!user) {
        const errorResponse = EnhancedErrorHandler.createUserNotFoundError({
          operation: 'validateCommunityPost',
          userId,
          middleware: 'communityAccessMiddleware'
        });
        return res.status(404).json(errorResponse);
      }

      // Check if user is a member of the community
      const isMember = community.members.some(
        memberId => memberId.toString() === userId.toString()
      );

      if (!isMember) {
        const errorResponse = EnhancedErrorHandler.createValidationError(
          'membership status',
          'not a member',
          'You must be a member of this community to post messages',
          { 
            operation: 'validateCommunityPost',
            communityId,
            communityName: community.name,
            userId,
            middleware: 'communityAccessMiddleware',
            suggestion: 'Join the community first to post messages'
          }
        );
        return res.status(403).json(errorResponse);
      }

      // Check if community has admin-only posting restrictions
      if (community.adminOnly) {
        // Check if user is super admin
        const isSuperAdmin = await AdminService.isSuperAdmin(userId);
        if (isSuperAdmin) {
          req.postAccess = {
            canPost: true,
            reason: 'super_admin',
            community: community,
            user: user
          };
          return next();
        }

        // Check if user is community admin
        const isCommAdmin = community.isUserAdmin(userId);
        if (isCommAdmin) {
          req.postAccess = {
            canPost: true,
            reason: 'community_admin',
            community: community,
            user: user
          };
          return next();
        }

        // Access denied for admin-only community
        const errorResponse = EnhancedErrorHandler.createAdminOnlyError(community, user, 'post', {
          operation: 'validateCommunityPost',
          middleware: 'communityAccessMiddleware',
          userId,
          communityId
        });
        return res.status(403).json(errorResponse);
      }

      // Regular community - all members can post
      req.postAccess = {
        canPost: true,
        reason: 'member',
        community: community,
        user: user
      };

      next();

    } catch (error) {
      console.error('Community post validation error:', error);
      const errorResponse = EnhancedErrorHandler.createServerError('validate community post', error, {
        operation: 'validateCommunityPost',
        communityId: req.params.communityId,
        userId: req.user?._id,
        middleware: 'communityAccessMiddleware'
      });
      res.status(500).json(errorResponse);
    }
  });

  /**
   * Middleware to validate community management operations
   * Checks if user has admin privileges for community management
   */
  static validateCommunityManagement = asyncHandler(async (req, res, next) => {
    try {
      const { communityId } = req.params;
      const userId = req.user._id;

      // Check management permissions using AdminService
      const managementCheck = await AdminService.canManageCommunity(userId, communityId);
      
      if (!managementCheck.canManage) {
        const errorResponse = EnhancedErrorHandler.createInsufficientPrivilegesError(
          'admin',
          'none',
          'manage community',
          {
            operation: 'validateCommunityManagement',
            communityId,
            userId,
            middleware: 'communityAccessMiddleware',
            managementCheckDetails: managementCheck
          }
        );
        return res.status(403).json(errorResponse);
      }

      // Access granted
      req.managementAccess = {
        canManage: true,
        reason: managementCheck.reason,
        userId: userId,
        communityId: communityId
      };

      next();

    } catch (error) {
      console.error('Community management validation error:', error);
      const errorResponse = EnhancedErrorHandler.createServerError('validate community management', error, {
        operation: 'validateCommunityManagement',
        communityId: req.params.communityId,
        userId: req.user?._id,
        middleware: 'communityAccessMiddleware'
      });
      res.status(500).json(errorResponse);
    }
  });

  /**
   * Helper method to check department restrictions for community access
   * 
   * @param {Object} user - User object
   * @param {Object} community - Community object
   * @returns {Object} Validation result
   */
  static async checkDepartmentRestriction(user, community) {
    try {
      // Super admin can access any community
      if (user.isAdmin && user.adminLevel === 'super') {
        return {
          success: true,
          reason: 'super_admin',
          message: 'Super admin has access to all communities'
        };
      }

      // Use DepartmentService for validation
      const validation = DepartmentService.validateDepartmentAccess(
        user.department,
        community.departmentRestriction,
        community.name
      );

      return validation;

    } catch (error) {
      console.error('Department restriction check error:', error);
      return {
        success: false,
        reason: 'validation_error',
        message: 'Error checking department restrictions',
        error: error.message
      };
    }
  }

  /**
   * Helper method to check if a community is unrestricted
   * Unrestricted communities include alumni, announcements, and general discussion
   * 
   * @param {Object} community - Community object
   * @returns {boolean} True if community is unrestricted
   */
  static isUnrestrictedCommunity(community) {
    if (!community) {
      return false;
    }

    // Check if community has no department restrictions
    if (!community.departmentRestriction && 
        (!community.allowedDepartments || community.allowedDepartments.length === 0)) {
      return true;
    }

    // Check against known unrestricted community names
    return DepartmentService.isUnrestrictedCommunity(community.name);
  }

  /**
   * Helper method to get accessible communities for a user
   * 
   * @param {Object} user - User object
   * @returns {Promise<Array>} Array of communities the user can access
   */
  static async getAccessibleCommunities(user) {
    try {
      const allCommunities = await Community.find({}).select('name description departmentRestriction allowedDepartments adminOnly');
      
      return DepartmentService.getAccessibleCommunities(user.department, allCommunities);

    } catch (error) {
      console.error('Error getting accessible communities:', error);
      return [];
    }
  }

  /**
   * Helper method to check if user can join a specific community
   * 
   * @param {string} userId - User ID
   * @param {string} communityId - Community ID
   * @returns {Promise<Object>} Join permission result
   */
  static async canUserJoinCommunity(userId, communityId) {
    try {
      const user = await User.findById(userId);
      const community = await Community.findById(communityId);

      if (!user || !community) {
        return {
          canJoin: false,
          reason: 'not_found',
          message: 'User or community not found'
        };
      }

      // Check if already a member
      const isAlreadyMember = community.members.some(
        memberId => memberId.toString() === userId.toString()
      );

      if (isAlreadyMember) {
        return {
          canJoin: false,
          reason: 'already_member',
          message: 'User is already a member'
        };
      }

      // Use community's canUserJoin method
      return community.canUserJoin(user);

    } catch (error) {
      console.error('Error checking join permission:', error);
      return {
        canJoin: false,
        reason: 'error',
        message: 'Error checking join permission'
      };
    }
  }

  /**
   * Helper method to get detailed access information for a user and community
   * 
   * @param {string} userId - User ID
   * @param {string} communityId - Community ID
   * @returns {Promise<Object>} Detailed access information
   */
  static async getCommunityAccessInfo(userId, communityId) {
    try {
      const user = await User.findById(userId);
      const community = await Community.findById(communityId);

      if (!user || !community) {
        return {
          error: 'not_found',
          message: 'User or community not found'
        };
      }

      const isMember = community.members.some(
        memberId => memberId.toString() === userId.toString()
      );

      const joinCheck = await this.canUserJoinCommunity(userId, communityId);
      const postCheck = await AdminService.canPostInCommunity(userId, communityId);
      const manageCheck = await AdminService.canManageCommunity(userId, communityId);

      return {
        user: {
          id: user._id,
          department: user.department,
          isAdmin: user.isAdmin,
          adminLevel: user.adminLevel
        },
        community: {
          id: community._id,
          name: community.name,
          departmentRestriction: community.departmentRestriction,
          adminOnly: community.adminOnly,
          isUnrestricted: this.isUnrestrictedCommunity(community)
        },
        access: {
          isMember: isMember,
          canJoin: joinCheck.canJoin,
          canPost: postCheck.canPost,
          canManage: manageCheck.canManage
        },
        reasons: {
          join: joinCheck.reason,
          post: postCheck.reason,
          manage: manageCheck.reason
        }
      };

    } catch (error) {
      console.error('Error getting community access info:', error);
      return {
        error: 'validation_error',
        message: 'Error getting access information'
      };
    }
  }
}

export default CommunityAccessMiddleware;