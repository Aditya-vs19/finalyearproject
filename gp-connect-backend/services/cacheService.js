/**
 * Cache Service for Admin and Department Operations
 * 
 * Implements caching for department mappings and admin status checks
 * to improve performance of frequently accessed data.
 * 
 * Requirements: 2.3, 5.5, 8.3
 */

import NodeCache from 'node-cache';
import User from '../models/User.js';
import Community from '../models/Community.js';
import DepartmentService from './departmentService.js';

class CacheService {
  constructor() {
    // Cache configurations with different TTL for different data types
    this.adminCache = new NodeCache({ 
      stdTTL: 300, // 5 minutes for admin status
      checkperiod: 60, // Check for expired keys every minute
      useClones: false // Better performance, but be careful with object mutations
    });

    this.departmentCache = new NodeCache({ 
      stdTTL: 3600, // 1 hour for department mappings (more stable data)
      checkperiod: 300, // Check every 5 minutes
      useClones: false
    });

    this.communityCache = new NodeCache({ 
      stdTTL: 600, // 10 minutes for community data
      checkperiod: 120, // Check every 2 minutes
      useClones: false
    });

    // Statistics tracking
    this.stats = {
      adminHits: 0,
      adminMisses: 0,
      departmentHits: 0,
      departmentMisses: 0,
      communityHits: 0,
      communityMisses: 0
    };

    // Set up cache event listeners
    this._setupEventListeners();
  }

  /**
   * Set up cache event listeners for monitoring
   * @private
   */
  _setupEventListeners() {
    // Admin cache events
    this.adminCache.on('set', (key, value) => {
      console.log(`Admin cache SET: ${key}`);
    });

    this.adminCache.on('del', (key, value) => {
      console.log(`Admin cache DEL: ${key}`);
    });

    this.adminCache.on('expired', (key, value) => {
      console.log(`Admin cache EXPIRED: ${key}`);
    });

    // Department cache events
    this.departmentCache.on('set', (key, value) => {
      console.log(`Department cache SET: ${key}`);
    });

    // Community cache events
    this.communityCache.on('set', (key, value) => {
      console.log(`Community cache SET: ${key}`);
    });
  }

  /**
   * Get admin status from cache or database
   * @param {string} userId - User ID to check
   * @returns {Promise<Object>} Admin status information
   */
  async getAdminStatus(userId) {
    const cacheKey = `admin_status_${userId}`;
    
    // Try cache first
    let adminStatus = this.adminCache.get(cacheKey);
    if (adminStatus) {
      this.stats.adminHits++;
      return adminStatus;
    }

    // Cache miss - fetch from database
    this.stats.adminMisses++;
    try {
      const user = await User.findById(userId).select('isAdmin adminLevel adminCommunities');
      
      if (!user) {
        adminStatus = {
          exists: false,
          isAdmin: false,
          adminLevel: 'none',
          adminCommunities: [],
          isSuperAdmin: false
        };
      } else {
        adminStatus = {
          exists: true,
          isAdmin: user.isAdmin,
          adminLevel: user.adminLevel,
          adminCommunities: user.adminCommunities || [],
          isSuperAdmin: user.isSuperAdmin()
        };
      }

      // Cache the result
      this.adminCache.set(cacheKey, adminStatus);
      return adminStatus;

    } catch (error) {
      console.error('Error fetching admin status:', error);
      // Return safe default on error
      return {
        exists: false,
        isAdmin: false,
        adminLevel: 'none',
        adminCommunities: [],
        isSuperAdmin: false,
        error: error.message
      };
    }
  }

  /**
   * Get department validation result from cache or compute
   * @param {string} userDepartment - User's department
   * @param {string} communityDepartment - Community's department restriction
   * @param {string} communityName - Community name
   * @returns {Object} Department validation result
   */
  getDepartmentValidation(userDepartment, communityDepartment, communityName = '') {
    const cacheKey = `dept_validation_${userDepartment}_${communityDepartment}_${communityName}`;
    
    // Try cache first
    let validation = this.departmentCache.get(cacheKey);
    if (validation) {
      this.stats.departmentHits++;
      return validation;
    }

    // Cache miss - compute validation using the original logic
    this.stats.departmentMisses++;
    
    // Import the original validation logic here to avoid circular dependency
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

    const UNRESTRICTED_COMMUNITIES = [
      'Alumni',
      'Official Announcements Community',
      'General Discussion'
    ];

    // Validation logic
    try {
      // Check if community is unrestricted (anyone can join)
      if (!communityDepartment || 
          UNRESTRICTED_COMMUNITIES.some(name => 
            name.toLowerCase().trim() === communityName.toLowerCase().trim()
          )) {
        validation = {
          success: true,
          reason: 'unrestricted_community',
          message: 'Community is open to all departments'
        };
      } else if (!userDepartment) {
        validation = {
          success: false,
          reason: 'no_user_department',
          message: 'User department is required for restricted communities',
          requiredDepartment: communityDepartment
        };
      } else {
        // Check if departments match using mappings
        let departmentsMatch = false;
        
        // Direct case-insensitive match
        if (userDepartment.toLowerCase().trim() === communityDepartment.toLowerCase().trim()) {
          departmentsMatch = true;
        } else {
          // Check against department mappings
          for (const mapping of Object.values(DEPARTMENT_MAPPINGS)) {
            const userInVariations = mapping.variations.some(variation => 
              variation.toLowerCase().trim() === userDepartment.toLowerCase().trim()
            );
            const communityInVariations = mapping.variations.some(variation => 
              variation.toLowerCase().trim() === communityDepartment.toLowerCase().trim()
            );
            
            if (userInVariations && communityInVariations) {
              departmentsMatch = true;
              break;
            }
          }
        }

        if (departmentsMatch) {
          validation = {
            success: true,
            reason: 'department_match',
            message: 'User department matches community requirement',
            userDepartment,
            communityDepartment
          };
        } else {
          validation = {
            success: false,
            reason: 'department_mismatch',
            message: 'User department does not match community requirement',
            userDepartment,
            requiredDepartment: communityDepartment
          };
        }
      }
    } catch (error) {
      validation = {
        success: false,
        reason: 'validation_error',
        message: 'Error validating department access',
        error: error.message
      };
    }

    // Cache the result
    this.departmentCache.set(cacheKey, validation);
    return validation;
  }

  /**
   * Get department variations from cache or compute
   * @param {string} department - Department name
   * @returns {Array} Department variations
   */
  getDepartmentVariations(department) {
    const cacheKey = `dept_variations_${department}`;
    
    // Try cache first
    let variations = this.departmentCache.get(cacheKey);
    if (variations) {
      this.stats.departmentHits++;
      return variations;
    }

    // Cache miss - compute variations
    this.stats.departmentMisses++;
    
    if (!department) {
      variations = [];
    } else {
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

      const normalizedInput = department.trim().toLowerCase();
      
      // Find matching department key by checking if input matches any variation
      for (const [key, config] of Object.entries(DEPARTMENT_MAPPINGS)) {
        const variationMatches = config.variations.map(v => v.toLowerCase().trim());
        if (variationMatches.includes(normalizedInput)) {
          variations = config.variations;
          break;
        }
      }

      // If no match found, return the original department as single variation
      if (!variations) {
        variations = [department];
      }
    }

    // Cache the result
    this.departmentCache.set(cacheKey, variations);
    return variations;
  }

  /**
   * Get community access information from cache or database
   * @param {string} communityId - Community ID
   * @returns {Promise<Object>} Community access information
   */
  async getCommunityAccess(communityId) {
    const cacheKey = `community_access_${communityId}`;
    
    // Try cache first
    let communityAccess = this.communityCache.get(cacheKey);
    if (communityAccess) {
      this.stats.communityHits++;
      return communityAccess;
    }

    // Cache miss - fetch from database
    this.stats.communityMisses++;
    try {
      const community = await Community.findById(communityId)
        .select('name departmentRestriction allowedDepartments adminOnly communityAdmins');
      
      if (!community) {
        communityAccess = {
          exists: false,
          name: null,
          departmentRestriction: null,
          allowedDepartments: [],
          adminOnly: false,
          communityAdmins: []
        };
      } else {
        communityAccess = {
          exists: true,
          name: community.name,
          departmentRestriction: community.departmentRestriction,
          allowedDepartments: community.allowedDepartments || [],
          adminOnly: community.adminOnly,
          communityAdmins: community.communityAdmins || []
        };
      }

      // Cache the result
      this.communityCache.set(cacheKey, communityAccess);
      return communityAccess;

    } catch (error) {
      console.error('Error fetching community access:', error);
      return {
        exists: false,
        name: null,
        departmentRestriction: null,
        allowedDepartments: [],
        adminOnly: false,
        communityAdmins: [],
        error: error.message
      };
    }
  }

  /**
   * Check if user can manage a community (cached)
   * @param {string} userId - User ID
   * @param {string} communityId - Community ID
   * @returns {Promise<Object>} Management permission result
   */
  async canManageCommunity(userId, communityId) {
    const cacheKey = `can_manage_${userId}_${communityId}`;
    
    // Try cache first
    let canManage = this.adminCache.get(cacheKey);
    if (canManage) {
      this.stats.adminHits++;
      return canManage;
    }

    // Cache miss - compute permission
    this.stats.adminMisses++;
    try {
      const [adminStatus, communityAccess] = await Promise.all([
        this.getAdminStatus(userId),
        this.getCommunityAccess(communityId)
      ]);

      if (!adminStatus.exists || !communityAccess.exists) {
        canManage = {
          canManage: false,
          reason: 'not_found',
          message: 'User or community not found'
        };
      } else if (adminStatus.isSuperAdmin) {
        canManage = {
          canManage: true,
          reason: 'super_admin',
          message: 'Super admin has full management privileges'
        };
      } else if (adminStatus.adminLevel === 'community') {
        const hasAccess = adminStatus.adminCommunities.some(
          commId => commId.toString() === communityId.toString()
        ) || communityAccess.communityAdmins.some(
          adminId => adminId.toString() === userId.toString()
        );

        canManage = {
          canManage: hasAccess,
          reason: hasAccess ? 'community_admin' : 'insufficient_privileges',
          message: hasAccess ? 'User is admin of this community' : 'User does not have management privileges'
        };
      } else {
        canManage = {
          canManage: false,
          reason: 'insufficient_privileges',
          message: 'User does not have administrative privileges'
        };
      }

      // Cache the result with shorter TTL for permission checks
      this.adminCache.set(cacheKey, canManage, 180); // 3 minutes
      return canManage;

    } catch (error) {
      console.error('Error checking management permission:', error);
      return {
        canManage: false,
        reason: 'error',
        message: 'Error checking management permission',
        error: error.message
      };
    }
  }

  /**
   * Invalidate cache entries for a specific user
   * @param {string} userId - User ID to invalidate
   */
  invalidateUserCache(userId) {
    const keys = this.adminCache.keys();
    const userKeys = keys.filter(key => key.includes(userId));
    
    userKeys.forEach(key => {
      this.adminCache.del(key);
    });

    console.log(`Invalidated ${userKeys.length} cache entries for user ${userId}`);
  }

  /**
   * Invalidate cache entries for a specific community
   * @param {string} communityId - Community ID to invalidate
   */
  invalidateCommunityCache(communityId) {
    // Invalidate community-specific cache
    const communityKeys = this.communityCache.keys();
    const targetKeys = communityKeys.filter(key => key.includes(communityId));
    
    targetKeys.forEach(key => {
      this.communityCache.del(key);
    });

    // Invalidate related admin cache entries
    const adminKeys = this.adminCache.keys();
    const relatedKeys = adminKeys.filter(key => key.includes(communityId));
    
    relatedKeys.forEach(key => {
      this.adminCache.del(key);
    });

    console.log(`Invalidated ${targetKeys.length + relatedKeys.length} cache entries for community ${communityId}`);
  }

  /**
   * Clear all caches
   */
  clearAllCaches() {
    this.adminCache.flushAll();
    this.departmentCache.flushAll();
    this.communityCache.flushAll();
    
    // Reset statistics
    this.stats = {
      adminHits: 0,
      adminMisses: 0,
      departmentHits: 0,
      departmentMisses: 0,
      communityHits: 0,
      communityMisses: 0
    };

    console.log('All caches cleared');
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache performance statistics
   */
  getStats() {
    const adminTotal = this.stats.adminHits + this.stats.adminMisses;
    const departmentTotal = this.stats.departmentHits + this.stats.departmentMisses;
    const communityTotal = this.stats.communityHits + this.stats.communityMisses;

    return {
      admin: {
        hits: this.stats.adminHits,
        misses: this.stats.adminMisses,
        total: adminTotal,
        hitRate: adminTotal > 0 ? (this.stats.adminHits / adminTotal * 100).toFixed(2) + '%' : '0%',
        cacheSize: this.adminCache.keys().length
      },
      department: {
        hits: this.stats.departmentHits,
        misses: this.stats.departmentMisses,
        total: departmentTotal,
        hitRate: departmentTotal > 0 ? (this.stats.departmentHits / departmentTotal * 100).toFixed(2) + '%' : '0%',
        cacheSize: this.departmentCache.keys().length
      },
      community: {
        hits: this.stats.communityHits,
        misses: this.stats.communityMisses,
        total: communityTotal,
        hitRate: communityTotal > 0 ? (this.stats.communityHits / communityTotal * 100).toFixed(2) + '%' : '0%',
        cacheSize: this.communityCache.keys().length
      }
    };
  }

  /**
   * Warm up caches with frequently accessed data
   * @returns {Promise<Object>} Warmup results
   */
  async warmupCaches() {
    console.log('Warming up caches...');
    const results = {
      success: true,
      adminUsers: 0,
      communities: 0,
      departments: 0,
      errors: []
    };

    try {
      // Preload all admin users
      const adminUsers = await User.find({ isAdmin: true }).select('_id isAdmin adminLevel adminCommunities');
      for (const user of adminUsers) {
        await this.getAdminStatus(user._id.toString());
        results.adminUsers++;
      }

      // Preload all communities with restrictions
      const communities = await Community.find({
        $or: [
          { departmentRestriction: { $exists: true, $ne: null } },
          { adminOnly: true }
        ]
      }).select('_id name departmentRestriction allowedDepartments adminOnly communityAdmins');
      
      for (const community of communities) {
        await this.getCommunityAccess(community._id.toString());
        results.communities++;
      }

      // Preload department variations for all known departments
      const departments = Object.keys(DepartmentService.getDepartmentMappings());
      for (const dept of departments) {
        this.getDepartmentVariations(dept);
        results.departments++;
      }

      console.log(`Cache warmup completed: ${results.adminUsers} admin users, ${results.communities} communities, ${results.departments} departments`);
      return results;

    } catch (error) {
      console.error('Error warming up caches:', error);
      results.success = false;
      results.errors.push(error.message);
      return results;
    }
  }
}

// Create singleton instance
const cacheService = new CacheService();

export default cacheService;