/**
 * Database Indexes and Performance Optimizations
 * 
 * This module handles the creation of database indexes for admin and department fields
 * to ensure efficient queries for the admin community management system.
 * 
 * Requirements: 2.3, 5.5, 8.3
 */

import mongoose from 'mongoose';
import User from '../models/User.js';
import Community from '../models/Community.js';

class DatabaseIndexManager {
  /**
   * Create all necessary indexes for admin and department functionality
   * @returns {Promise<Object>} Index creation results
   */
  static async createAdminIndexes() {
    const results = {
      success: true,
      userIndexes: [],
      communityIndexes: [],
      errors: []
    };

    try {
      console.log('Creating database indexes for admin and department fields...');

      // User model indexes
      const userIndexes = [
        // Admin-related indexes
        { isAdmin: 1 },
        { adminLevel: 1 },
        { isAdmin: 1, adminLevel: 1 }, // Compound index for admin queries
        
        // Department-related indexes
        { department: 1 },
        { department: 1, isVerified: 1 }, // For department validation queries
        
        // Performance indexes for common queries
        { email: 1, isAdmin: 1 }, // For admin lookup by email
        { adminCommunities: 1 }, // For community admin queries
        
        // Compound indexes for complex queries
        { isAdmin: 1, adminLevel: 1, department: 1 },
        { department: 1, isVerified: 1, isAdmin: 1 }
      ];

      // Create user indexes
      for (const index of userIndexes) {
        try {
          await User.collection.createIndex(index, { background: true });
          results.userIndexes.push({ index, status: 'created' });
          console.log(`✓ Created User index:`, index);
        } catch (error) {
          if (error.code === 85) { // Index already exists
            results.userIndexes.push({ index, status: 'exists' });
            console.log(`- User index already exists:`, index);
          } else {
            results.errors.push({ model: 'User', index, error: error.message });
            console.error(`✗ Failed to create User index:`, index, error.message);
          }
        }
      }

      // Community model indexes
      const communityIndexes = [
        // Department restriction indexes
        { departmentRestriction: 1 },
        { adminOnly: 1 },
        
        // Admin-related indexes
        { communityAdmins: 1 },
        { members: 1 }, // For membership queries
        
        // Performance indexes for access control
        { departmentRestriction: 1, adminOnly: 1 }, // Compound for access checks
        { name: 1, departmentRestriction: 1 }, // For community lookup with restrictions
        
        // Message-related indexes for performance
        { 'messages.sender': 1 },
        { 'messages.timestamp': -1 }, // For chronological message queries
        
        // Compound indexes for complex queries
        { departmentRestriction: 1, adminOnly: 1, members: 1 },
        { adminOnly: 1, communityAdmins: 1 }
      ];

      // Create community indexes
      for (const index of communityIndexes) {
        try {
          await Community.collection.createIndex(index, { background: true });
          results.communityIndexes.push({ index, status: 'created' });
          console.log(`✓ Created Community index:`, index);
        } catch (error) {
          if (error.code === 85) { // Index already exists
            results.communityIndexes.push({ index, status: 'exists' });
            console.log(`- Community index already exists:`, index);
          } else {
            results.errors.push({ model: 'Community', index, error: error.message });
            console.error(`✗ Failed to create Community index:`, index, error.message);
          }
        }
      }

      console.log(`Index creation completed. User indexes: ${results.userIndexes.length}, Community indexes: ${results.communityIndexes.length}`);
      
      if (results.errors.length > 0) {
        results.success = false;
        console.warn(`${results.errors.length} errors occurred during index creation`);
      }

      return results;

    } catch (error) {
      console.error('Error creating database indexes:', error);
      results.success = false;
      results.errors.push({ general: error.message });
      return results;
    }
  }

  /**
   * Drop all admin-related indexes (for cleanup or recreation)
   * @returns {Promise<Object>} Drop results
   */
  static async dropAdminIndexes() {
    const results = {
      success: true,
      dropped: [],
      errors: []
    };

    try {
      console.log('Dropping admin-related indexes...');

      // Get existing indexes
      const userIndexes = await User.collection.listIndexes().toArray();
      const communityIndexes = await Community.collection.listIndexes().toArray();

      // Drop user admin indexes (keep essential ones like _id and unique constraints)
      const userAdminIndexNames = userIndexes
        .filter(idx => 
          idx.name !== '_id_' && 
          idx.name !== 'email_1' && 
          idx.name !== 'enrollment_1' &&
          (idx.name.includes('isAdmin') || 
           idx.name.includes('adminLevel') || 
           idx.name.includes('adminCommunities') ||
           idx.name.includes('department'))
        )
        .map(idx => idx.name);

      for (const indexName of userAdminIndexNames) {
        try {
          await User.collection.dropIndex(indexName);
          results.dropped.push({ model: 'User', index: indexName });
          console.log(`✓ Dropped User index: ${indexName}`);
        } catch (error) {
          results.errors.push({ model: 'User', index: indexName, error: error.message });
          console.error(`✗ Failed to drop User index: ${indexName}`, error.message);
        }
      }

      // Drop community admin indexes
      const communityAdminIndexNames = communityIndexes
        .filter(idx => 
          idx.name !== '_id_' && 
          idx.name !== 'name_1' &&
          (idx.name.includes('departmentRestriction') || 
           idx.name.includes('adminOnly') || 
           idx.name.includes('communityAdmins') ||
           idx.name.includes('messages'))
        )
        .map(idx => idx.name);

      for (const indexName of communityAdminIndexNames) {
        try {
          await Community.collection.dropIndex(indexName);
          results.dropped.push({ model: 'Community', index: indexName });
          console.log(`✓ Dropped Community index: ${indexName}`);
        } catch (error) {
          results.errors.push({ model: 'Community', index: indexName, error: error.message });
          console.error(`✗ Failed to drop Community index: ${indexName}`, error.message);
        }
      }

      if (results.errors.length > 0) {
        results.success = false;
      }

      return results;

    } catch (error) {
      console.error('Error dropping indexes:', error);
      results.success = false;
      results.errors.push({ general: error.message });
      return results;
    }
  }

  /**
   * Get information about existing indexes
   * @returns {Promise<Object>} Index information
   */
  static async getIndexInfo() {
    try {
      const userIndexes = await User.collection.listIndexes().toArray();
      const communityIndexes = await Community.collection.listIndexes().toArray();

      return {
        success: true,
        userIndexes: userIndexes.map(idx => ({
          name: idx.name,
          key: idx.key,
          unique: idx.unique || false,
          background: idx.background || false
        })),
        communityIndexes: communityIndexes.map(idx => ({
          name: idx.name,
          key: idx.key,
          unique: idx.unique || false,
          background: idx.background || false
        }))
      };

    } catch (error) {
      console.error('Error getting index information:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Analyze query performance for admin operations
   * @returns {Promise<Object>} Performance analysis results
   */
  static async analyzeQueryPerformance() {
    const results = {
      success: true,
      analyses: [],
      recommendations: []
    };

    try {
      console.log('Analyzing query performance for admin operations...');

      // Test common admin queries
      const testQueries = [
        {
          name: 'Find Super Admin',
          collection: User,
          query: { isAdmin: true, adminLevel: 'super' },
          explain: true
        },
        {
          name: 'Find Users by Department',
          collection: User,
          query: { department: 'Computer Engineering', isVerified: true },
          explain: true
        },
        {
          name: 'Find Admin-Only Communities',
          collection: Community,
          query: { adminOnly: true },
          explain: true
        },
        {
          name: 'Find Communities by Department Restriction',
          collection: Community,
          query: { departmentRestriction: 'Computer Engineering' },
          explain: true
        },
        {
          name: 'Find Community Admins',
          collection: User,
          query: { adminLevel: 'community', adminCommunities: { $exists: true, $ne: [] } },
          explain: true
        }
      ];

      for (const test of testQueries) {
        try {
          const startTime = Date.now();
          const explanation = await test.collection.find(test.query).explain('executionStats');
          const endTime = Date.now();

          const analysis = {
            queryName: test.name,
            executionTimeMs: endTime - startTime,
            documentsExamined: explanation.executionStats.totalDocsExamined,
            documentsReturned: explanation.executionStats.totalDocsReturned,
            indexUsed: explanation.executionStats.executionStages.indexName || 'COLLSCAN',
            efficient: explanation.executionStats.totalDocsExamined <= explanation.executionStats.totalDocsReturned * 2
          };

          results.analyses.push(analysis);

          // Add recommendations for inefficient queries
          if (!analysis.efficient || analysis.indexUsed === 'COLLSCAN') {
            results.recommendations.push({
              query: test.name,
              issue: analysis.indexUsed === 'COLLSCAN' ? 'Collection scan detected' : 'Inefficient index usage',
              suggestion: `Consider adding index for: ${JSON.stringify(test.query)}`
            });
          }

          console.log(`✓ Analyzed: ${test.name} - ${analysis.executionTimeMs}ms, ${analysis.indexUsed}`);

        } catch (error) {
          results.analyses.push({
            queryName: test.name,
            error: error.message
          });
          console.error(`✗ Failed to analyze: ${test.name}`, error.message);
        }
      }

      return results;

    } catch (error) {
      console.error('Error analyzing query performance:', error);
      results.success = false;
      results.error = error.message;
      return results;
    }
  }

  /**
   * Initialize all database optimizations
   * @returns {Promise<Object>} Initialization results
   */
  static async initializeOptimizations() {
    console.log('Initializing database optimizations for admin system...');
    
    const results = {
      success: true,
      indexCreation: null,
      performanceAnalysis: null,
      errors: []
    };

    try {
      // Create indexes
      results.indexCreation = await this.createAdminIndexes();
      if (!results.indexCreation.success) {
        results.success = false;
        results.errors.push('Index creation failed');
      }

      // Analyze performance
      results.performanceAnalysis = await this.analyzeQueryPerformance();
      if (!results.performanceAnalysis.success) {
        results.errors.push('Performance analysis failed');
      }

      console.log('Database optimization initialization completed');
      return results;

    } catch (error) {
      console.error('Error initializing database optimizations:', error);
      results.success = false;
      results.errors.push(error.message);
      return results;
    }
  }
}

export default DatabaseIndexManager;