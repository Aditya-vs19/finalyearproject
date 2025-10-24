/**
 * Department Mapping Service
 * 
 * Handles department name validation, normalization, and access control
 * for community-based restrictions in GP-ConneX.
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import cacheService from './cacheService.js';
import performanceMonitor from '../utils/performanceMonitor.js';

// Department mappings with all variations and community names
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

// Communities that are unrestricted (anyone can join regardless of department)
const UNRESTRICTED_COMMUNITIES = [
  'Alumni',
  'Official Announcements Community',
  'General Discussion'
];

class DepartmentService {
  /**
   * Get the department mappings configuration
   * @returns {Object} Department mappings object
   */
  static getDepartmentMappings() {
    return DEPARTMENT_MAPPINGS;
  }

  /**
   * Get unrestricted communities list
   * @returns {Array} List of unrestricted community names
   */
  static getUnrestrictedCommunities() {
    return UNRESTRICTED_COMMUNITIES;
  }

  /**
   * Normalize department name by trimming and converting to lowercase
   * Requirement 5.2: Case-insensitive matching
   * 
   * @param {string} department - Department name to normalize
   * @returns {string} Normalized department name
   */
  static normalizeDepartmentName(department) {
    if (!department || typeof department !== 'string') {
      return '';
    }
    return department.trim().toLowerCase();
  }

  /**
   * Get all variations for a given department
   * Requirement 5.1: Handle both full department names and abbreviated forms
   * 
   * @param {string} department - Department name
   * @returns {Array} Array of department variations
   */
  static getDepartmentVariations(department) {
    const startTime = Date.now();
    
    if (!department) {
      return [];
    }

    // Use cached variations for performance
    const variations = cacheService.getDepartmentVariations(department);
    const duration = Date.now() - startTime;
    
    performanceMonitor.recordDepartmentValidation(department, 'variations', duration, true, true);
    
    return variations;
  }

  /**
   * Find the canonical department key for a given department name
   * 
   * @param {string} department - Department name to find key for
   * @returns {string|null} Canonical department key or null if not found
   */
  static findDepartmentKey(department) {
    if (!department) {
      return null;
    }

    const normalizedInput = this.normalizeDepartmentName(department);
    
    for (const [key, config] of Object.entries(DEPARTMENT_MAPPINGS)) {
      const variations = config.variations.map(v => this.normalizeDepartmentName(v));
      if (variations.includes(normalizedInput)) {
        return key;
      }
    }

    return null;
  }

  /**
   * Check if two departments match (including variations)
   * Requirements 5.1, 5.2, 5.3: Handle variations and case-insensitive matching
   * 
   * @param {string} userDepartment - User's department
   * @param {string} communityDepartment - Community's required department
   * @returns {boolean} True if departments match
   */
  static departmentsMatch(userDepartment, communityDepartment) {
    if (!userDepartment || !communityDepartment) {
      return false;
    }

    // Normalize both department names
    const normalizedUser = this.normalizeDepartmentName(userDepartment);
    const normalizedCommunity = this.normalizeDepartmentName(communityDepartment);

    // Direct match
    if (normalizedUser === normalizedCommunity) {
      return true;
    }

    // Find department keys for both
    const userKey = this.findDepartmentKey(userDepartment);
    const communityKey = this.findDepartmentKey(communityDepartment);

    // If both have valid keys, check if they're the same
    if (userKey && communityKey) {
      return userKey === communityKey;
    }

    // Check if user department matches any variation of community department
    const communityVariations = this.getDepartmentVariations(communityDepartment)
      .map(v => this.normalizeDepartmentName(v));
    
    if (communityVariations.includes(normalizedUser)) {
      return true;
    }

    // Check if community department matches any variation of user department
    const userVariations = this.getDepartmentVariations(userDepartment)
      .map(v => this.normalizeDepartmentName(v));
    
    return userVariations.includes(normalizedCommunity);
  }

  /**
   * Validate if a user can access a community based on department restrictions
   * Requirements 5.1, 5.2, 5.3, 5.4: Complete department validation logic
   * 
   * @param {string} userDepartment - User's department
   * @param {string} communityDepartment - Community's department restriction
   * @param {string} communityName - Community name (for unrestricted check)
   * @returns {Object} Validation result with success flag and details
   */
  static validateDepartmentAccess(userDepartment, communityDepartment, communityName = '') {
    const startTime = Date.now();
    
    try {
      // Use cached validation for performance
      const validation = cacheService.getDepartmentValidation(userDepartment, communityDepartment, communityName);
      const duration = Date.now() - startTime;
      
      performanceMonitor.recordDepartmentValidation(
        userDepartment, 
        communityDepartment, 
        duration, 
        validation.success, 
        true
      );
      
      return validation;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Requirement 5.5: Log issues and deny access with clear error message
      performanceMonitor.recordDepartmentValidation(userDepartment, communityDepartment, duration, false, false);
      performanceMonitor.recordError('validateDepartmentAccess', 'validation_error', error.message, {
        userDepartment,
        communityDepartment,
        communityName
      });
      
      console.error('Department validation error:', error);
      return {
        success: false,
        reason: 'validation_error',
        message: 'Error validating department access',
        error: error.message
      };
    }
  }

  /**
   * Get all communities a user can join based on their department
   * 
   * @param {string} userDepartment - User's department
   * @param {Array} allCommunities - Array of all available communities
   * @returns {Array} Array of communities the user can join
   */
  static getAccessibleCommunities(userDepartment, allCommunities = []) {
    if (!Array.isArray(allCommunities)) {
      return [];
    }

    return allCommunities.filter(community => {
      const validation = this.validateDepartmentAccess(
        userDepartment,
        community.departmentRestriction,
        community.name
      );
      return validation.success;
    });
  }

  /**
   * Get suggested communities for a user based on their department
   * 
   * @param {string} userDepartment - User's department
   * @returns {Array} Array of suggested community names
   */
  static getSuggestedCommunities(userDepartment) {
    const suggestions = [...UNRESTRICTED_COMMUNITIES];
    
    if (userDepartment) {
      const departmentKey = this.findDepartmentKey(userDepartment);
      if (departmentKey && DEPARTMENT_MAPPINGS[departmentKey]) {
        suggestions.push(...DEPARTMENT_MAPPINGS[departmentKey].communityNames);
      }
    }

    return [...new Set(suggestions)]; // Remove duplicates
  }

  /**
   * Check if a community name is unrestricted
   * 
   * @param {string} communityName - Community name to check
   * @returns {boolean} True if community is unrestricted
   */
  static isUnrestrictedCommunity(communityName) {
    if (!communityName) {
      return false;
    }

    const normalizedName = this.normalizeDepartmentName(communityName);
    return UNRESTRICTED_COMMUNITIES.some(name => 
      this.normalizeDepartmentName(name) === normalizedName
    );
  }

  /**
   * Validate department name format and existence
   * 
   * @param {string} department - Department name to validate
   * @returns {Object} Validation result
   */
  static validateDepartmentFormat(department) {
    if (!department || typeof department !== 'string') {
      return {
        valid: false,
        message: 'Department name is required and must be a string'
      };
    }

    const trimmed = department.trim();
    if (!trimmed) {
      return {
        valid: false,
        message: 'Department name cannot be empty'
      };
    }

    // Check if department exists in our mappings
    const departmentKey = this.findDepartmentKey(department);
    if (!departmentKey) {
      return {
        valid: true, // Allow unknown departments but flag them
        message: 'Department not found in standard mappings',
        warning: true,
        suggestions: Object.keys(DEPARTMENT_MAPPINGS)
      };
    }

    return {
      valid: true,
      message: 'Valid department',
      departmentKey,
      variations: DEPARTMENT_MAPPINGS[departmentKey].variations
    };
  }
}

export default DepartmentService;