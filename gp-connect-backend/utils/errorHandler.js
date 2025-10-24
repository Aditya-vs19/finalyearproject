/**
 * Enhanced Error Handling and User Feedback System
 * 
 * Provides specific error types for department restrictions and admin-only access
 * with helpful information about allowed communities and clear user feedback.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import DepartmentService from '../services/departmentService.js';
import AdminService from '../services/adminService.js';

/**
 * Custom error classes for specific community access scenarios
 */
export class CommunityAccessError extends Error {
  constructor(message, errorCode, details = {}) {
    super(message);
    this.name = 'CommunityAccessError';
    this.errorCode = errorCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

export class DepartmentRestrictionError extends CommunityAccessError {
  constructor(userDepartment, requiredDepartment, communityName, additionalInfo = {}) {
    const message = `Access restricted: This community is for ${requiredDepartment} department members only`;
    
    super(message, 'DEPARTMENT_RESTRICTION', {
      userDepartment,
      requiredDepartment,
      communityName,
      ...additionalInfo
    });
  }
}

export class AdminOnlyError extends CommunityAccessError {
  constructor(communityName, operation = 'access', additionalInfo = {}) {
    const message = operation === 'post' 
      ? `Only administrators can post in ${communityName}`
      : `Administrator privileges required for ${communityName}`;
    
    super(message, 'ADMIN_ONLY_ACCESS', {
      communityName,
      operation,
      ...additionalInfo
    });
  }
}

export class InsufficientPrivilegesError extends CommunityAccessError {
  constructor(requiredLevel, currentLevel, operation, additionalInfo = {}) {
    const message = `Insufficient privileges: ${operation} requires ${requiredLevel} level access`;
    
    super(message, 'INSUFFICIENT_PRIVILEGES', {
      requiredLevel,
      currentLevel,
      operation,
      ...additionalInfo
    });
  }
}

/**
 * Enhanced Error Handler Class
 * Provides comprehensive error handling with user-friendly feedback
 */
export class EnhancedErrorHandler {
  
  /**
   * Create department restriction error response
   * Requirements: 7.1, 7.2
   */
  static createDepartmentRestrictionError(user, community, additionalContext = {}) {
    const userDepartment = user?.department || 'Not specified';
    const requiredDepartment = community?.departmentRestriction;
    const communityName = community?.name || 'Unknown Community';
    
    // Get suggested communities for the user
    const suggestedCommunities = DepartmentService.getSuggestedCommunities(user?.department);
    
    // Get department variations for better understanding
    const allowedVariations = requiredDepartment 
      ? DepartmentService.getDepartmentVariations(requiredDepartment)
      : [];
    
    // Create helpful error message
    const helpMessage = this.generateDepartmentHelpMessage(userDepartment, requiredDepartment, communityName);
    
    return {
      error: 'DEPARTMENT_RESTRICTION',
      message: `You cannot join ${communityName} because it's restricted to ${requiredDepartment} department members`,
      userFriendlyMessage: helpMessage,
      details: {
        communityName,
        userDepartment,
        requiredDepartment,
        allowedVariations,
        suggestedCommunities,
        departmentMatch: false,
        accessType: 'department_restricted'
      },
      suggestions: {
        action: 'update_profile_or_join_allowed',
        message: userDepartment === 'Not specified' 
          ? 'Please update your department in your profile to access department-specific communities'
          : `You can join these communities instead: ${suggestedCommunities.slice(0, 3).join(', ')}`,
        allowedCommunities: suggestedCommunities
      },
      helpResources: {
        profileUpdateUrl: '/profile/edit',
        communityListUrl: '/communities',
        supportContact: 'gpconnex@gmail.com'
      },
      ...additionalContext
    };
  }

  /**
   * Create admin-only access error response
   * Requirements: 7.3, 7.4
   */
  static createAdminOnlyError(community, user, operation = 'access', additionalContext = {}) {
    const communityName = community?.name || 'Unknown Community';
    const isPostOperation = operation === 'post';
    const isJoinOperation = operation === 'join';
    const isManageOperation = operation === 'manage';
    
    // Determine specific error message based on operation
    let primaryMessage, userFriendlyMessage, actionSuggestion;
    
    if (isPostOperation) {
      primaryMessage = `Only administrators can post messages in ${communityName}`;
      userFriendlyMessage = `${communityName} is an admin-only posting community. Only administrators can share messages here, but you can read all announcements and updates.`;
      actionSuggestion = 'You can read messages in this community, but posting is restricted to administrators';
    } else if (isJoinOperation) {
      primaryMessage = `${communityName} is restricted to administrators only`;
      userFriendlyMessage = `${communityName} is an exclusive community for administrators. Contact an administrator if you believe you should have access.`;
      actionSuggestion = 'Contact an administrator for access or explore other available communities';
    } else if (isManageOperation) {
      primaryMessage = `Community management requires administrator privileges`;
      userFriendlyMessage = `You need administrator privileges to manage ${communityName}. Only super admins and community admins can modify community settings.`;
      actionSuggestion = 'Contact a super administrator if you need management access to this community';
    } else {
      primaryMessage = `Administrator privileges required for ${communityName}`;
      userFriendlyMessage = `${communityName} requires administrator privileges for this action.`;
      actionSuggestion = 'Contact an administrator for assistance';
    }

    // Get alternative communities for the user
    const alternativeCommunities = user?.department 
      ? DepartmentService.getSuggestedCommunities(user.department)
      : DepartmentService.getUnrestrictedCommunities();

    return {
      error: 'ADMIN_ONLY_ACCESS',
      message: primaryMessage,
      userFriendlyMessage,
      details: {
        communityName,
        operation,
        adminOnly: true,
        userIsAdmin: user?.isAdmin || false,
        userAdminLevel: user?.adminLevel || 'none',
        accessType: 'admin_only',
        canRead: !isJoinOperation, // Can read if not trying to join
        canPost: false,
        canManage: false
      },
      suggestions: {
        action: 'contact_admin_or_explore_alternatives',
        message: actionSuggestion,
        alternativeCommunities: alternativeCommunities.slice(0, 5),
        adminContact: 'gpconnex@gmail.com'
      },
      helpResources: {
        adminContactEmail: 'gpconnex@gmail.com',
        communityListUrl: '/communities',
        supportUrl: '/help/community-access'
      },
      ...additionalContext
    };
  }

  /**
   * Create insufficient privileges error response
   * Requirements: 7.4
   */
  static createInsufficientPrivilegesError(requiredLevel, currentLevel, operation, additionalContext = {}) {
    const levelDescriptions = {
      'none': 'Regular User',
      'community': 'Community Administrator',
      'super': 'Super Administrator'
    };

    const currentLevelDesc = levelDescriptions[currentLevel] || 'Unknown';
    const requiredLevelDesc = levelDescriptions[requiredLevel] || 'Unknown';

    const message = `This operation requires ${requiredLevelDesc} privileges. Your current level: ${currentLevelDesc}`;
    
    return {
      error: 'INSUFFICIENT_PRIVILEGES',
      message,
      userFriendlyMessage: `You need ${requiredLevelDesc} privileges to ${operation}. Contact an administrator if you believe you should have this access.`,
      details: {
        operation,
        currentLevel,
        requiredLevel,
        currentLevelDescription: currentLevelDesc,
        requiredLevelDescription: requiredLevelDesc,
        accessType: 'privilege_restricted'
      },
      suggestions: {
        action: 'contact_admin_for_privileges',
        message: `Contact a Super Administrator to request ${requiredLevelDesc} privileges`,
        adminContact: 'gpconnex@gmail.com'
      },
      helpResources: {
        adminContactEmail: 'gpconnex@gmail.com',
        privilegeInfoUrl: '/help/admin-privileges',
        supportUrl: '/help/access-issues'
      },
      ...additionalContext
    };
  }

  /**
   * Create user not found error response
   */
  static createUserNotFoundError(additionalContext = {}) {
    return {
      error: 'USER_NOT_FOUND',
      message: 'User account not found',
      userFriendlyMessage: 'Your user account could not be found. Please log in again or contact support.',
      details: {
        accessType: 'authentication_required'
      },
      suggestions: {
        action: 'login_or_contact_support',
        message: 'Please log in again or contact support if the issue persists',
        loginUrl: '/login'
      },
      helpResources: {
        loginUrl: '/login',
        supportContact: 'gpconnex@gmail.com'
      },
      ...additionalContext
    };
  }

  /**
   * Create community not found error response
   */
  static createCommunityNotFoundError(communityId, additionalContext = {}) {
    return {
      error: 'COMMUNITY_NOT_FOUND',
      message: 'Community not found',
      userFriendlyMessage: 'The requested community could not be found. It may have been removed or you may not have access to it.',
      details: {
        communityId,
        accessType: 'not_found'
      },
      suggestions: {
        action: 'browse_available_communities',
        message: 'Browse available communities or contact support if you believe this is an error',
        communityListUrl: '/communities'
      },
      helpResources: {
        communityListUrl: '/communities',
        supportContact: 'gpconnex@gmail.com'
      },
      ...additionalContext
    };
  }

  /**
   * Create already member error response
   */
  static createAlreadyMemberError(communityName, additionalContext = {}) {
    return {
      error: 'ALREADY_MEMBER',
      message: `You are already a member of ${communityName}`,
      userFriendlyMessage: `You're already part of ${communityName}! You can start participating in discussions right away.`,
      details: {
        communityName,
        isMember: true,
        accessType: 'already_member'
      },
      suggestions: {
        action: 'start_participating',
        message: 'You can now post messages and participate in community discussions',
        communityUrl: `/communities/${additionalContext.communityId || ''}`
      },
      helpResources: {
        communityGuideUrl: '/help/community-participation'
      },
      ...additionalContext
    };
  }

  /**
   * Generate helpful department-specific message
   * Requirements: 7.1, 7.2
   */
  static generateDepartmentHelpMessage(userDepartment, requiredDepartment, communityName) {
    if (!userDepartment || userDepartment === 'Not specified') {
      return `To join ${communityName}, please update your profile with your department information. This community is restricted to ${requiredDepartment} department members.`;
    }

    if (!requiredDepartment) {
      return `${communityName} appears to have access restrictions. Please contact an administrator for more information.`;
    }

    // Check if departments are similar (might be a variation issue)
    const userKey = DepartmentService.findDepartmentKey(userDepartment);
    const requiredKey = DepartmentService.findDepartmentKey(requiredDepartment);
    
    if (userKey && requiredKey && userKey !== requiredKey) {
      return `${communityName} is for ${requiredDepartment} department members. Your department (${userDepartment}) doesn't match this requirement. You can join communities for your department or unrestricted communities like Alumni and General Discussion.`;
    }

    return `${communityName} is restricted to ${requiredDepartment} department members. Your current department is listed as "${userDepartment}". If this is incorrect, please update your profile. Otherwise, you can join communities that match your department.`;
  }

  /**
   * Create success response with helpful context
   */
  static createSuccessResponse(operation, details = {}) {
    const successMessages = {
      'join': 'Successfully joined the community',
      'post': 'Message posted successfully',
      'leave': 'Successfully left the community',
      'manage': 'Community management action completed'
    };

    return {
      success: true,
      message: successMessages[operation] || 'Operation completed successfully',
      details: {
        operation,
        timestamp: new Date().toISOString(),
        ...details
      }
    };
  }

  /**
   * Create validation error response
   */
  static createValidationError(field, value, requirement, additionalContext = {}) {
    return {
      error: 'VALIDATION_ERROR',
      message: `Invalid ${field}: ${requirement}`,
      userFriendlyMessage: `Please check your ${field}. ${requirement}`,
      details: {
        field,
        value,
        requirement,
        accessType: 'validation_error'
      },
      suggestions: {
        action: 'correct_input',
        message: `Please provide a valid ${field} and try again`
      },
      ...additionalContext
    };
  }

  /**
   * Create server error response
   */
  static createServerError(operation, error, additionalContext = {}) {
    return {
      error: 'SERVER_ERROR',
      message: `Server error during ${operation}`,
      userFriendlyMessage: 'Something went wrong on our end. Please try again in a moment.',
      details: {
        operation,
        timestamp: new Date().toISOString(),
        errorType: error?.name || 'Unknown',
        accessType: 'server_error'
      },
      suggestions: {
        action: 'retry_or_contact_support',
        message: 'Please try again in a moment. If the issue persists, contact support.',
        supportContact: 'gpconnex@gmail.com'
      },
      helpResources: {
        supportContact: 'gpconnex@gmail.com',
        statusUrl: '/status'
      },
      ...additionalContext
    };
  }

  /**
   * Enhanced error response formatter
   * Formats errors with consistent structure and helpful information
   */
  static formatErrorResponse(error, req = null) {
    const baseResponse = {
      timestamp: new Date().toISOString(),
      requestId: req?.id || 'unknown',
      path: req?.path || 'unknown'
    };

    if (error instanceof DepartmentRestrictionError) {
      return {
        ...baseResponse,
        ...this.createDepartmentRestrictionError(
          { department: error.details.userDepartment },
          { 
            name: error.details.communityName,
            departmentRestriction: error.details.requiredDepartment
          }
        )
      };
    }

    if (error instanceof AdminOnlyError) {
      return {
        ...baseResponse,
        ...this.createAdminOnlyError(
          { name: error.details.communityName },
          {},
          error.details.operation
        )
      };
    }

    if (error instanceof InsufficientPrivilegesError) {
      return {
        ...baseResponse,
        ...this.createInsufficientPrivilegesError(
          error.details.requiredLevel,
          error.details.currentLevel,
          error.details.operation
        )
      };
    }

    if (error instanceof CommunityAccessError) {
      return {
        ...baseResponse,
        error: error.errorCode,
        message: error.message,
        details: error.details
      };
    }

    // Default server error
    return {
      ...baseResponse,
      ...this.createServerError('unknown', error)
    };
  }
}

export default EnhancedErrorHandler;