/**
 * Performance Monitor for Admin Operations and Access Control
 * 
 * Monitors and tracks performance metrics for admin operations,
 * department validation, and community access control.
 * 
 * Requirements: 2.3, 5.5, 8.3
 */

import fs from 'fs/promises';
import path from 'path';

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      adminOperations: new Map(),
      departmentValidations: new Map(),
      communityAccess: new Map(),
      queryPerformance: new Map(),
      errorRates: new Map()
    };

    this.thresholds = {
      slowQueryMs: 100,
      verySlowQueryMs: 500,
      errorRateThreshold: 0.05, // 5%
      maxMetricsAge: 24 * 60 * 60 * 1000 // 24 hours
    };

    // Start periodic cleanup
    this.startPeriodicCleanup();
  }

  /**
   * Start periodic cleanup of old metrics
   * @private
   */
  startPeriodicCleanup() {
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 60 * 60 * 1000); // Cleanup every hour
  }

  /**
   * Clean up metrics older than maxMetricsAge
   * @private
   */
  cleanupOldMetrics() {
    const cutoffTime = Date.now() - this.thresholds.maxMetricsAge;
    
    for (const [category, metricsMap] of Object.entries(this.metrics)) {
      if (metricsMap instanceof Map) {
        for (const [key, data] of metricsMap.entries()) {
          if (data.timestamp < cutoffTime) {
            metricsMap.delete(key);
          }
        }
      }
    }

    console.log('Performance metrics cleanup completed');
  }

  /**
   * Record admin operation performance
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in milliseconds
   * @param {boolean} success - Whether operation succeeded
   * @param {Object} metadata - Additional metadata
   */
  recordAdminOperation(operation, duration, success, metadata = {}) {
    const key = `${operation}_${Date.now()}`;
    
    this.metrics.adminOperations.set(key, {
      operation,
      duration,
      success,
      metadata,
      timestamp: Date.now(),
      slow: duration > this.thresholds.slowQueryMs,
      verySlow: duration > this.thresholds.verySlowQueryMs
    });

    // Log slow operations
    if (duration > this.thresholds.verySlowQueryMs) {
      console.warn(`Very slow admin operation: ${operation} took ${duration}ms`);
    } else if (duration > this.thresholds.slowQueryMs) {
      console.log(`Slow admin operation: ${operation} took ${duration}ms`);
    }
  }

  /**
   * Record department validation performance
   * @param {string} userDepartment - User's department
   * @param {string} communityDepartment - Community's department
   * @param {number} duration - Duration in milliseconds
   * @param {boolean} success - Whether validation succeeded
   * @param {boolean} cached - Whether result was cached
   */
  recordDepartmentValidation(userDepartment, communityDepartment, duration, success, cached = false) {
    const key = `${userDepartment}_${communityDepartment}_${Date.now()}`;
    
    this.metrics.departmentValidations.set(key, {
      userDepartment,
      communityDepartment,
      duration,
      success,
      cached,
      timestamp: Date.now(),
      slow: duration > this.thresholds.slowQueryMs
    });
  }

  /**
   * Record community access check performance
   * @param {string} userId - User ID
   * @param {string} communityId - Community ID
   * @param {string} accessType - Type of access (join, post, manage)
   * @param {number} duration - Duration in milliseconds
   * @param {boolean} granted - Whether access was granted
   * @param {boolean} cached - Whether result was cached
   */
  recordCommunityAccess(userId, communityId, accessType, duration, granted, cached = false) {
    const key = `${accessType}_${userId}_${communityId}_${Date.now()}`;
    
    this.metrics.communityAccess.set(key, {
      userId,
      communityId,
      accessType,
      duration,
      granted,
      cached,
      timestamp: Date.now(),
      slow: duration > this.thresholds.slowQueryMs
    });
  }

  /**
   * Record database query performance
   * @param {string} queryType - Type of query
   * @param {string} collection - Database collection
   * @param {number} duration - Duration in milliseconds
   * @param {number} documentsExamined - Number of documents examined
   * @param {number} documentsReturned - Number of documents returned
   * @param {string} indexUsed - Index used (or 'COLLSCAN')
   */
  recordQueryPerformance(queryType, collection, duration, documentsExamined, documentsReturned, indexUsed) {
    const key = `${queryType}_${collection}_${Date.now()}`;
    
    const efficiency = documentsReturned > 0 ? documentsExamined / documentsReturned : 0;
    
    this.metrics.queryPerformance.set(key, {
      queryType,
      collection,
      duration,
      documentsExamined,
      documentsReturned,
      indexUsed,
      efficiency,
      timestamp: Date.now(),
      slow: duration > this.thresholds.slowQueryMs,
      inefficient: efficiency > 10 || indexUsed === 'COLLSCAN'
    });

    // Log inefficient queries
    if (indexUsed === 'COLLSCAN') {
      console.warn(`Collection scan detected: ${queryType} on ${collection}`);
    } else if (efficiency > 10) {
      console.warn(`Inefficient query: ${queryType} on ${collection} (efficiency: ${efficiency.toFixed(2)})`);
    }
  }

  /**
   * Record error occurrence
   * @param {string} operation - Operation that failed
   * @param {string} errorType - Type of error
   * @param {string} errorMessage - Error message
   * @param {Object} context - Additional context
   */
  recordError(operation, errorType, errorMessage, context = {}) {
    const key = `${operation}_${Date.now()}`;
    
    this.metrics.errorRates.set(key, {
      operation,
      errorType,
      errorMessage,
      context,
      timestamp: Date.now()
    });

    console.error(`Performance Monitor - Error in ${operation}: ${errorType} - ${errorMessage}`);
  }

  /**
   * Get performance summary for admin operations
   * @param {number} timeWindowMs - Time window in milliseconds (default: 1 hour)
   * @returns {Object} Performance summary
   */
  getAdminOperationsSummary(timeWindowMs = 60 * 60 * 1000) {
    const cutoffTime = Date.now() - timeWindowMs;
    const recentOps = Array.from(this.metrics.adminOperations.values())
      .filter(op => op.timestamp > cutoffTime);

    if (recentOps.length === 0) {
      return { totalOperations: 0, message: 'No admin operations in time window' };
    }

    const summary = {
      totalOperations: recentOps.length,
      successRate: (recentOps.filter(op => op.success).length / recentOps.length * 100).toFixed(2) + '%',
      averageDuration: (recentOps.reduce((sum, op) => sum + op.duration, 0) / recentOps.length).toFixed(2) + 'ms',
      slowOperations: recentOps.filter(op => op.slow).length,
      verySlowOperations: recentOps.filter(op => op.verySlow).length,
      operationBreakdown: {}
    };

    // Group by operation type
    const operationGroups = {};
    recentOps.forEach(op => {
      if (!operationGroups[op.operation]) {
        operationGroups[op.operation] = [];
      }
      operationGroups[op.operation].push(op);
    });

    // Calculate stats per operation type
    for (const [operation, ops] of Object.entries(operationGroups)) {
      summary.operationBreakdown[operation] = {
        count: ops.length,
        averageDuration: (ops.reduce((sum, op) => sum + op.duration, 0) / ops.length).toFixed(2) + 'ms',
        successRate: (ops.filter(op => op.success).length / ops.length * 100).toFixed(2) + '%',
        slowCount: ops.filter(op => op.slow).length
      };
    }

    return summary;
  }

  /**
   * Get performance summary for department validations
   * @param {number} timeWindowMs - Time window in milliseconds
   * @returns {Object} Department validation summary
   */
  getDepartmentValidationSummary(timeWindowMs = 60 * 60 * 1000) {
    const cutoffTime = Date.now() - timeWindowMs;
    const recentValidations = Array.from(this.metrics.departmentValidations.values())
      .filter(val => val.timestamp > cutoffTime);

    if (recentValidations.length === 0) {
      return { totalValidations: 0, message: 'No department validations in time window' };
    }

    const cacheHits = recentValidations.filter(val => val.cached).length;
    const cacheMisses = recentValidations.length - cacheHits;

    return {
      totalValidations: recentValidations.length,
      cacheHitRate: (cacheHits / recentValidations.length * 100).toFixed(2) + '%',
      averageDuration: (recentValidations.reduce((sum, val) => sum + val.duration, 0) / recentValidations.length).toFixed(2) + 'ms',
      slowValidations: recentValidations.filter(val => val.slow).length,
      successRate: (recentValidations.filter(val => val.success).length / recentValidations.length * 100).toFixed(2) + '%',
      cachePerformance: {
        hits: cacheHits,
        misses: cacheMisses,
        hitRate: (cacheHits / recentValidations.length * 100).toFixed(2) + '%'
      }
    };
  }

  /**
   * Get performance summary for community access checks
   * @param {number} timeWindowMs - Time window in milliseconds
   * @returns {Object} Community access summary
   */
  getCommunityAccessSummary(timeWindowMs = 60 * 60 * 1000) {
    const cutoffTime = Date.now() - timeWindowMs;
    const recentAccess = Array.from(this.metrics.communityAccess.values())
      .filter(acc => acc.timestamp > cutoffTime);

    if (recentAccess.length === 0) {
      return { totalAccessChecks: 0, message: 'No community access checks in time window' };
    }

    const accessTypeBreakdown = {};
    recentAccess.forEach(acc => {
      if (!accessTypeBreakdown[acc.accessType]) {
        accessTypeBreakdown[acc.accessType] = {
          total: 0,
          granted: 0,
          cached: 0,
          totalDuration: 0
        };
      }
      const breakdown = accessTypeBreakdown[acc.accessType];
      breakdown.total++;
      if (acc.granted) breakdown.granted++;
      if (acc.cached) breakdown.cached++;
      breakdown.totalDuration += acc.duration;
    });

    // Calculate stats per access type
    for (const [type, stats] of Object.entries(accessTypeBreakdown)) {
      stats.grantRate = (stats.granted / stats.total * 100).toFixed(2) + '%';
      stats.cacheHitRate = (stats.cached / stats.total * 100).toFixed(2) + '%';
      stats.averageDuration = (stats.totalDuration / stats.total).toFixed(2) + 'ms';
    }

    return {
      totalAccessChecks: recentAccess.length,
      averageDuration: (recentAccess.reduce((sum, acc) => sum + acc.duration, 0) / recentAccess.length).toFixed(2) + 'ms',
      overallGrantRate: (recentAccess.filter(acc => acc.granted).length / recentAccess.length * 100).toFixed(2) + '%',
      cacheHitRate: (recentAccess.filter(acc => acc.cached).length / recentAccess.length * 100).toFixed(2) + '%',
      slowChecks: recentAccess.filter(acc => acc.slow).length,
      accessTypeBreakdown
    };
  }

  /**
   * Get query performance summary
   * @param {number} timeWindowMs - Time window in milliseconds
   * @returns {Object} Query performance summary
   */
  getQueryPerformanceSummary(timeWindowMs = 60 * 60 * 1000) {
    const cutoffTime = Date.now() - timeWindowMs;
    const recentQueries = Array.from(this.metrics.queryPerformance.values())
      .filter(query => query.timestamp > cutoffTime);

    if (recentQueries.length === 0) {
      return { totalQueries: 0, message: 'No queries in time window' };
    }

    const collectionBreakdown = {};
    recentQueries.forEach(query => {
      if (!collectionBreakdown[query.collection]) {
        collectionBreakdown[query.collection] = {
          total: 0,
          totalDuration: 0,
          slowQueries: 0,
          inefficientQueries: 0,
          collectionScans: 0
        };
      }
      const breakdown = collectionBreakdown[query.collection];
      breakdown.total++;
      breakdown.totalDuration += query.duration;
      if (query.slow) breakdown.slowQueries++;
      if (query.inefficient) breakdown.inefficientQueries++;
      if (query.indexUsed === 'COLLSCAN') breakdown.collectionScans++;
    });

    // Calculate stats per collection
    for (const [collection, stats] of Object.entries(collectionBreakdown)) {
      stats.averageDuration = (stats.totalDuration / stats.total).toFixed(2) + 'ms';
      stats.slowQueryRate = (stats.slowQueries / stats.total * 100).toFixed(2) + '%';
      stats.inefficientQueryRate = (stats.inefficientQueries / stats.total * 100).toFixed(2) + '%';
      stats.collectionScanRate = (stats.collectionScans / stats.total * 100).toFixed(2) + '%';
    }

    return {
      totalQueries: recentQueries.length,
      averageDuration: (recentQueries.reduce((sum, query) => sum + query.duration, 0) / recentQueries.length).toFixed(2) + 'ms',
      slowQueries: recentQueries.filter(query => query.slow).length,
      inefficientQueries: recentQueries.filter(query => query.inefficient).length,
      collectionScans: recentQueries.filter(query => query.indexUsed === 'COLLSCAN').length,
      collectionBreakdown
    };
  }

  /**
   * Get comprehensive performance report
   * @param {number} timeWindowMs - Time window in milliseconds
   * @returns {Object} Comprehensive performance report
   */
  getPerformanceReport(timeWindowMs = 60 * 60 * 1000) {
    return {
      timeWindow: `${timeWindowMs / (60 * 1000)} minutes`,
      timestamp: new Date().toISOString(),
      adminOperations: this.getAdminOperationsSummary(timeWindowMs),
      departmentValidations: this.getDepartmentValidationSummary(timeWindowMs),
      communityAccess: this.getCommunityAccessSummary(timeWindowMs),
      queryPerformance: this.getQueryPerformanceSummary(timeWindowMs),
      systemHealth: this.getSystemHealthIndicators(timeWindowMs)
    };
  }

  /**
   * Get system health indicators
   * @param {number} timeWindowMs - Time window in milliseconds
   * @returns {Object} System health indicators
   */
  getSystemHealthIndicators(timeWindowMs = 60 * 60 * 1000) {
    const cutoffTime = Date.now() - timeWindowMs;
    const recentErrors = Array.from(this.metrics.errorRates.values())
      .filter(error => error.timestamp > cutoffTime);

    const totalOperations = 
      Array.from(this.metrics.adminOperations.values()).filter(op => op.timestamp > cutoffTime).length +
      Array.from(this.metrics.departmentValidations.values()).filter(val => val.timestamp > cutoffTime).length +
      Array.from(this.metrics.communityAccess.values()).filter(acc => acc.timestamp > cutoffTime).length;

    const errorRate = totalOperations > 0 ? recentErrors.length / totalOperations : 0;

    return {
      totalOperations,
      totalErrors: recentErrors.length,
      errorRate: (errorRate * 100).toFixed(4) + '%',
      healthStatus: errorRate < this.thresholds.errorRateThreshold ? 'HEALTHY' : 'WARNING',
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };
  }

  /**
   * Export performance data to file
   * @param {string} filePath - File path to export to
   * @param {number} timeWindowMs - Time window for data export
   * @returns {Promise<boolean>} Success status
   */
  async exportPerformanceData(filePath, timeWindowMs = 24 * 60 * 60 * 1000) {
    try {
      const report = this.getPerformanceReport(timeWindowMs);
      const exportData = {
        exportTimestamp: new Date().toISOString(),
        report,
        rawMetrics: {
          adminOperations: Array.from(this.metrics.adminOperations.entries()),
          departmentValidations: Array.from(this.metrics.departmentValidations.entries()),
          communityAccess: Array.from(this.metrics.communityAccess.entries()),
          queryPerformance: Array.from(this.metrics.queryPerformance.entries()),
          errorRates: Array.from(this.metrics.errorRates.entries())
        }
      };

      await fs.writeFile(filePath, JSON.stringify(exportData, null, 2));
      console.log(`Performance data exported to ${filePath}`);
      return true;

    } catch (error) {
      console.error('Error exporting performance data:', error);
      return false;
    }
  }

  /**
   * Clear all performance metrics
   */
  clearMetrics() {
    this.metrics.adminOperations.clear();
    this.metrics.departmentValidations.clear();
    this.metrics.communityAccess.clear();
    this.metrics.queryPerformance.clear();
    this.metrics.errorRates.clear();
    
    console.log('All performance metrics cleared');
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

export default performanceMonitor;