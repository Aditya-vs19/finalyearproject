import User from '../models/User.js';
import Community from '../models/Community.js';
import mongoose from 'mongoose';
import cacheService from './cacheService.js';
import performanceMonitor from '../utils/performanceMonitor.js';

/**
 * AdminService - Handles super admin operations and privilege management
 * Provides methods for admin account management, privilege checking, and community operations
 */
class AdminService {
  
  /**
   * Ensure super admin account exists and is properly configured
   * @param {string} email - Email address for the super admin account
   * @returns {Promise<Object>} Super admin user object and operation status
   */
  static async ensureSuperAdmin(email) {
    try {
      // Check if super admin already exists
      let superAdmin = await User.findOne({ 
        email: email,
        isAdmin: true,
        adminLevel: 'super'
      });

      if (superAdmin) {
        console.log(`Super admin ${email} already exists`);
        return {
          success: true,
          user: superAdmin,
          created: false,
          message: 'Super admin already exists'
        };
      }

      // Check if user exists but is not super admin
      let existingUser = await User.findOne({ email: email });
      
      if (existingUser) {
        // Update existing user to super admin
        existingUser.isAdmin = true;
        existingUser.adminLevel = 'super';
        existingUser.adminCommunities = []; // Super admin doesn't need specific communities
        existingUser.isVerified = true; // Ensure admin is verified
        
        await existingUser.save();
        
        console.log(`Updated existing user ${email} to super admin`);
        return {
          success: true,
          user: existingUser,
          created: false,
          updated: true,
          message: 'Existing user updated to super admin'
        };
      }

      // Create new super admin account (without enrollment and department)
      superAdmin = new User({
        fullName: 'GP-ConneX Administrator',
        email: email,
        password: 'TempPassword123!', // Should be changed on first login
        isAdmin: true,
        adminLevel: 'super',
        adminCommunities: [],
        isVerified: true,
        bio: 'Official GP-ConneX Administrator Account'
        // Note: enrollment and department are intentionally omitted for super admin
      });

      await superAdmin.save();
      
      console.log(`Created new super admin account: ${email}`);
      return {
        success: true,
        user: superAdmin,
        created: true,
        message: 'Super admin account created successfully'
      };

    } catch (error) {
      console.error('Error ensuring super admin:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to ensure super admin account'
      };
    }
  }

  /**
   * Migrate legacy admin account to new super admin
   * @param {string} legacyAdminEmail - Email of the legacy admin account
   * @param {string} newSuperAdminEmail - Email of the new super admin account
   * @returns {Promise<Object>} Migration result
   */
  static async migrateLegacyAdmin(legacyAdminEmail, newSuperAdminEmail) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find legacy admin account
      const legacyAdmin = await User.findOne({ email: legacyAdminEmail }).session(session);
      
      if (!legacyAdmin) {
        await session.abortTransaction();
        return {
          success: false,
          message: 'Legacy admin account not found'
        };
      }

      // Ensure new super admin exists
      const superAdminResult = await this.ensureSuperAdmin(newSuperAdminEmail);
      if (!superAdminResult.success) {
        await session.abortTransaction();
        return {
          success: false,
          message: 'Failed to create new super admin account'
        };
      }

      const newSuperAdmin = superAdminResult.user;

      // Transfer community memberships from legacy admin to new super admin
      const communities = await Community.find({
        members: legacyAdmin._id
      }).session(session);

      for (const community of communities) {
        // Remove legacy admin from members
        community.members = community.members.filter(
          memberId => {
            const memberIdStr = memberId.toString ? memberId.toString() : memberId;
            const legacyIdStr = legacyAdmin._id.toString ? legacyAdmin._id.toString() : legacyAdmin._id;
            return memberIdStr !== legacyIdStr;
          }
        );
        
        // Add new super admin if not already a member
        const isAlreadyMember = community.members.some(memberId => {
          const memberIdStr = memberId.toString ? memberId.toString() : memberId;
          const newAdminIdStr = newSuperAdmin._id.toString ? newSuperAdmin._id.toString() : newSuperAdmin._id;
          return memberIdStr === newAdminIdStr;
        });
        
        if (!isAlreadyMember) {
          community.members.push(newSuperAdmin._id);
        }

        // Update community admins
        const isLegacyAdminInAdmins = community.communityAdmins.some(adminId => {
          const adminIdStr = adminId.toString ? adminId.toString() : adminId;
          const legacyIdStr = legacyAdmin._id.toString ? legacyAdmin._id.toString() : legacyAdmin._id;
          return adminIdStr === legacyIdStr;
        });
        
        if (isLegacyAdminInAdmins) {
          community.communityAdmins = community.communityAdmins.filter(
            adminId => {
              const adminIdStr = adminId.toString ? adminId.toString() : adminId;
              const legacyIdStr = legacyAdmin._id.toString ? legacyAdmin._id.toString() : legacyAdmin._id;
              return adminIdStr !== legacyIdStr;
            }
          );
          
          const isNewAdminInAdmins = community.communityAdmins.some(adminId => {
            const adminIdStr = adminId.toString ? adminId.toString() : adminId;
            const newAdminIdStr = newSuperAdmin._id.toString ? newSuperAdmin._id.toString() : newSuperAdmin._id;
            return adminIdStr === newAdminIdStr;
          });
          
          if (!isNewAdminInAdmins) {
            community.communityAdmins.push(newSuperAdmin._id);
          }
        }

        await community.save({ session });
      }

      // Update any messages from legacy admin to reference new super admin
      await Community.updateMany(
        { 'messages.sender': legacyAdmin._id },
        { $set: { 'messages.$.sender': newSuperAdmin._id } },
        { session }
      );

      // Deactivate or remove legacy admin account
      legacyAdmin.isAdmin = false;
      legacyAdmin.adminLevel = 'none';
      legacyAdmin.adminCommunities = [];
      legacyAdmin.email = `deactivated_${legacyAdmin.email}`;
      await legacyAdmin.save({ session });

      await session.commitTransaction();
      
      console.log(`Successfully migrated from ${legacyAdminEmail} to ${newSuperAdminEmail}`);
      return {
        success: true,
        legacyAdmin: legacyAdmin,
        newSuperAdmin: newSuperAdmin,
        communitiesMigrated: communities.length,
        message: 'Admin account migration completed successfully'
      };

    } catch (error) {
      await session.abortTransaction();
      console.error('Error migrating legacy admin:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to migrate legacy admin account'
      };
    } finally {
      session.endSession();
    }
  }

  /**
   * Add super admin to all existing communities
   * @param {string} adminId - ID of the super admin user
   * @returns {Promise<Object>} Operation result
   */
  static async addSuperAdminToAllCommunities(adminId) {
    try {
      // Verify user is super admin
      const admin = await User.findById(adminId);
      if (!admin || !admin.isSuperAdmin()) {
        return {
          success: false,
          message: 'User is not a super admin'
        };
      }

      // Get all communities
      const communities = await Community.find({});
      let addedCount = 0;
      let alreadyMemberCount = 0;

      for (const community of communities) {
        // Check if admin is already a member
        const isAlreadyMember = community.members.some(
          memberId => memberId.toString() === adminId.toString()
        );

        if (!isAlreadyMember) {
          community.members.push(adminId);
          await community.save();
          addedCount++;
        } else {
          alreadyMemberCount++;
        }

        // Ensure admin is in community admins list
        const isAlreadyAdmin = community.communityAdmins.some(
          adminIdInList => adminIdInList.toString() === adminId.toString()
        );

        if (!isAlreadyAdmin) {
          community.communityAdmins.push(adminId);
          await community.save();
        }
      }

      console.log(`Added super admin to ${addedCount} communities, already member of ${alreadyMemberCount}`);
      return {
        success: true,
        totalCommunities: communities.length,
        addedToCommunities: addedCount,
        alreadyMemberOf: alreadyMemberCount,
        message: 'Super admin added to all communities successfully'
      };

    } catch (error) {
      console.error('Error adding super admin to communities:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to add super admin to all communities'
      };
    }
  }

  /**
   * Check if user is a super admin
   * @param {string} userId - ID of the user to check
   * @returns {Promise<boolean>} True if user is super admin
   */
  static async isSuperAdmin(userId) {
    const startTime = Date.now();
    try {
      // Use cached admin status
      const adminStatus = await cacheService.getAdminStatus(userId);
      const duration = Date.now() - startTime;
      
      performanceMonitor.recordAdminOperation('isSuperAdmin', duration, true, { 
        userId, 
        cached: true,
        result: adminStatus.isSuperAdmin 
      });
      
      return adminStatus.isSuperAdmin;
    } catch (error) {
      const duration = Date.now() - startTime;
      performanceMonitor.recordAdminOperation('isSuperAdmin', duration, false, { userId });
      performanceMonitor.recordError('isSuperAdmin', 'database_error', error.message, { userId });
      console.error('Error checking super admin status:', error);
      return false;
    }
  }

  /**
   * Check if user can post in a specific community
   * @param {string} userId - ID of the user
   * @param {string} communityId - ID of the community
   * @returns {Promise<Object>} Permission result with details
   */
  static async canPostInCommunity(userId, communityId) {
    const startTime = Date.now();
    try {
      // Use cached data for performance
      const [adminStatus, communityAccess] = await Promise.all([
        cacheService.getAdminStatus(userId),
        cacheService.getCommunityAccess(communityId)
      ]);

      const duration = Date.now() - startTime;

      if (!adminStatus.exists || !communityAccess.exists) {
        performanceMonitor.recordCommunityAccess(userId, communityId, 'post', duration, false, true);
        return {
          canPost: false,
          reason: 'not_found',
          message: 'User or community not found'
        };
      }

      // Check membership (this still requires a database query for now)
      const community = await Community.findById(communityId).select('members');
      const isMember = community.members.some(
        memberId => memberId.toString() === userId.toString()
      );

      if (!isMember) {
        performanceMonitor.recordCommunityAccess(userId, communityId, 'post', duration, false, true);
        return {
          canPost: false,
          reason: 'not_member',
          message: 'User is not a member of this community'
        };
      }

      // Check admin-only posting
      let canPost = true;
      let reason = 'member';
      let message = 'User can post as community member';

      if (communityAccess.adminOnly) {
        if (adminStatus.isSuperAdmin) {
          reason = 'super_admin';
          message = 'Super admin can post in admin-only community';
        } else if (communityAccess.communityAdmins.some(adminId => adminId.toString() === userId.toString())) {
          reason = 'community_admin';
          message = 'Community admin can post in admin-only community';
        } else {
          canPost = false;
          reason = 'admin_only';
          message = 'Only administrators can post in this community';
        }
      }

      const finalDuration = Date.now() - startTime;
      performanceMonitor.recordCommunityAccess(userId, communityId, 'post', finalDuration, canPost, true);
      performanceMonitor.recordAdminOperation('canPostInCommunity', finalDuration, true, { 
        userId, 
        communityId, 
        canPost, 
        reason 
      });

      return { canPost, reason, message };

    } catch (error) {
      const duration = Date.now() - startTime;
      performanceMonitor.recordCommunityAccess(userId, communityId, 'post', duration, false, false);
      performanceMonitor.recordError('canPostInCommunity', 'database_error', error.message, { userId, communityId });
      console.error('Error checking post permission:', error);
      return {
        canPost: false,
        reason: 'error',
        message: 'Error checking post permission'
      };
    }
  }

  /**
   * Check if user can manage a specific community
   * @param {string} userId - ID of the user
   * @param {string} communityId - ID of the community
   * @returns {Promise<Object>} Management permission result
   */
  static async canManageCommunity(userId, communityId) {
    const startTime = Date.now();
    try {
      // Use cached management permission check
      const result = await cacheService.canManageCommunity(userId, communityId);
      const duration = Date.now() - startTime;
      
      performanceMonitor.recordCommunityAccess(userId, communityId, 'manage', duration, result.canManage, true);
      performanceMonitor.recordAdminOperation('canManageCommunity', duration, true, { 
        userId, 
        communityId, 
        canManage: result.canManage, 
        reason: result.reason 
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      performanceMonitor.recordCommunityAccess(userId, communityId, 'manage', duration, false, false);
      performanceMonitor.recordError('canManageCommunity', 'cache_error', error.message, { userId, communityId });
      console.error('Error checking management permission:', error);
      return {
        canManage: false,
        reason: 'error',
        message: 'Error checking management permission'
      };
    }
  }

  /**
   * Create a new admin account with specified privileges
   * @param {Object} userData - User data for the new admin
   * @param {string} adminLevel - Admin level ('community' or 'super')
   * @param {Array} communityIds - Array of community IDs for community admins
   * @returns {Promise<Object>} Creation result
   */
  static async createAdminAccount(userData, adminLevel = 'community', communityIds = []) {
    try {
      // Validate admin level
      if (!['community', 'super'].includes(adminLevel)) {
        return {
          success: false,
          message: 'Invalid admin level. Must be "community" or "super"'
        };
      }

      // For community admins, validate community IDs
      if (adminLevel === 'community' && (!communityIds || communityIds.length === 0)) {
        return {
          success: false,
          message: 'Community admins must be assigned to at least one community'
        };
      }

      // Create admin user
      const adminUser = new User({
        ...userData,
        isAdmin: true,
        adminLevel: adminLevel,
        adminCommunities: adminLevel === 'community' ? communityIds : [],
        isVerified: true // Admins are automatically verified
      });

      await adminUser.save();

      // If community admin, add to community admins lists
      if (adminLevel === 'community') {
        await Community.updateMany(
          { _id: { $in: communityIds } },
          { $addToSet: { communityAdmins: adminUser._id } }
        );
      }

      console.log(`Created ${adminLevel} admin account: ${userData.email}`);
      return {
        success: true,
        user: adminUser,
        message: `${adminLevel} admin account created successfully`
      };

    } catch (error) {
      console.error('Error creating admin account:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to create admin account'
      };
    }
  }

  /**
   * Update admin privileges for an existing user
   * @param {string} userId - ID of the user to update
   * @param {Object} privileges - New privilege settings
   * @returns {Promise<Object>} Update result
   */
  static async updateAdminPrivileges(userId, privileges) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      const { isAdmin, adminLevel, adminCommunities } = privileges;

      // Update user privileges
      if (typeof isAdmin === 'boolean') {
        user.isAdmin = isAdmin;
      }

      if (adminLevel && ['none', 'community', 'super'].includes(adminLevel)) {
        user.adminLevel = adminLevel;
      }

      if (Array.isArray(adminCommunities)) {
        user.adminCommunities = adminCommunities;
      }

      await user.save();

      console.log(`Updated admin privileges for user: ${user.email}`);
      return {
        success: true,
        user: user,
        message: 'Admin privileges updated successfully'
      };

    } catch (error) {
      console.error('Error updating admin privileges:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to update admin privileges'
      };
    }
  }

  /**
   * Get all admin users with their privileges
   * @returns {Promise<Object>} List of admin users
   */
  static async getAllAdmins() {
    try {
      const admins = await User.find({ 
        isAdmin: true 
      }).populate('adminCommunities', 'name description').select('-password');

      return {
        success: true,
        admins: admins,
        count: admins.length,
        message: 'Admin users retrieved successfully'
      };

    } catch (error) {
      console.error('Error getting admin users:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to retrieve admin users'
      };
    }
  }

  /**
   * Remove admin privileges from a user
   * @param {string} userId - ID of the user
   * @returns {Promise<Object>} Removal result
   */
  static async removeAdminPrivileges(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      // Remove from community admins lists
      if (user.adminCommunities && user.adminCommunities.length > 0) {
        await Community.updateMany(
          { _id: { $in: user.adminCommunities } },
          { $pull: { communityAdmins: userId } }
        );
      }

      // Reset admin fields
      user.isAdmin = false;
      user.adminLevel = 'none';
      user.adminCommunities = [];

      await user.save();

      console.log(`Removed admin privileges from user: ${user.email}`);
      return {
        success: true,
        user: user,
        message: 'Admin privileges removed successfully'
      };

    } catch (error) {
      console.error('Error removing admin privileges:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to remove admin privileges'
      };
    }
  }
}

export default AdminService;