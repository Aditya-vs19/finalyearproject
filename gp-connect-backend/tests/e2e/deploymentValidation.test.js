import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Deployment Validation Tests', () => {
  describe('1. Environment Configuration', () => {
    it('should have Cloudinary environment variables defined', () => {
      expect(process.env.CLOUDINARY_CLOUD_NAME).toBeDefined();
      expect(process.env.CLOUDINARY_API_KEY).toBeDefined();
      expect(process.env.CLOUDINARY_API_SECRET).toBeDefined();
    });

    it('should have valid Cloudinary credentials format', () => {
      if (process.env.CLOUDINARY_CLOUD_NAME) {
        expect(process.env.CLOUDINARY_CLOUD_NAME.length).toBeGreaterThan(0);
      }
      if (process.env.CLOUDINARY_API_KEY) {
        expect(process.env.CLOUDINARY_API_KEY.length).toBeGreaterThan(0);
      }
      if (process.env.CLOUDINARY_API_SECRET) {
        expect(process.env.CLOUDINARY_API_SECRET.length).toBeGreaterThan(10);
      }
    });
  });

  describe('2. Required Files and Dependencies', () => {
    it('should have all required service files', () => {
      const requiredFiles = [
        '../../services/cloudinaryService.js',
        '../../middleware/cloudinaryUpload.js',
        '../../services/migrationService.js',
        '../../services/imageCleanupService.js',
        '../../services/imagePerformanceService.js'
      ];

      requiredFiles.forEach(filePath => {
        const fullPath = path.resolve(__dirname, filePath);
        expect(fs.existsSync(fullPath)).toBe(true);
      });
    });

    it('should have deployment configuration files', () => {
      const deploymentFiles = [
        '../../DEPLOYMENT_CONFIG.md',
        '../../DEPLOYMENT_CHECKLIST.md',
        '../../CLOUD_IMAGE_MAINTENANCE.md',
        '../../package.json',
        '../../Procfile'
      ];

      deploymentFiles.forEach(filePath => {
        const fullPath = path.resolve(__dirname, filePath);
        expect(fs.existsSync(fullPath)).toBe(true);
      });
    });

    it('should have required npm packages installed', () => {
      const packageJsonPath = path.resolve(__dirname, '../../package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      const requiredPackages = [
        'cloudinary',
        'multer-storage-cloudinary',
        'multer',
        'express'
      ];

      requiredPackages.forEach(pkg => {
        expect(packageJson.dependencies[pkg]).toBeDefined();
      });
    });
  });

  describe('3. Service Integration', () => {
    it('should be able to import Cloudinary service', async () => {
      const { default: cloudinaryService } = await import('../../services/cloudinaryService.js');
      expect(cloudinaryService).toBeDefined();
      expect(typeof cloudinaryService.configure).toBe('function');
      expect(typeof cloudinaryService.uploadImage).toBe('function');
      expect(typeof cloudinaryService.deleteImage).toBe('function');
    });

    it('should be able to import migration service', async () => {
      const { default: migrationService } = await import('../../services/migrationService.js');
      expect(migrationService).toBeDefined();
      expect(typeof migrationService.migrateAllImages).toBe('function');
    });

    it('should be able to import image cleanup service', async () => {
      const { default: imageCleanupService } = await import('../../services/imageCleanupService.js');
      expect(imageCleanupService).toBeDefined();
      expect(typeof imageCleanupService.cleanupOrphanedImages).toBe('function');
    });
  });

  describe('4. Configuration Validation', () => {
    it('should have proper server configuration', async () => {
      // Check if server.js exports the app
      const serverPath = path.resolve(__dirname, '../../server.js');
      const serverContent = fs.readFileSync(serverPath, 'utf8');
      expect(serverContent).toContain('export default app');
    });

    it('should have proper middleware configuration', async () => {
      const { default: cloudinaryUpload } = await import('../../middleware/cloudinaryUpload.js');
      expect(cloudinaryUpload).toBeDefined();
    });

    it('should have monitoring routes configured', () => {
      const routesPath = path.resolve(__dirname, '../../routes/imageMonitoring.js');
      expect(fs.existsSync(routesPath)).toBe(true);
    });
  });

  describe('5. Migration Scripts', () => {
    it('should have migration script available', () => {
      const migrationScriptPath = path.resolve(__dirname, '../../scripts/migrateImages.js');
      expect(fs.existsSync(migrationScriptPath)).toBe(true);
    });

    it('should have proper npm scripts for migration', () => {
      const packageJsonPath = path.resolve(__dirname, '../../package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      const requiredScripts = [
        'migrate:run',
        'migrate:status',
        'migrate:validate',
        'migrate:dry-run'
      ];

      requiredScripts.forEach(script => {
        expect(packageJson.scripts[script]).toBeDefined();
      });
    });
  });

  describe('6. Documentation', () => {
    it('should have comprehensive deployment documentation', () => {
      const deploymentConfigPath = path.resolve(__dirname, '../../DEPLOYMENT_CONFIG.md');
      const deploymentChecklistPath = path.resolve(__dirname, '../../DEPLOYMENT_CHECKLIST.md');
      const maintenancePath = path.resolve(__dirname, '../../CLOUD_IMAGE_MAINTENANCE.md');

      expect(fs.existsSync(deploymentConfigPath)).toBe(true);
      expect(fs.existsSync(deploymentChecklistPath)).toBe(true);
      expect(fs.existsSync(maintenancePath)).toBe(true);

      // Check content quality
      const deploymentConfig = fs.readFileSync(deploymentConfigPath, 'utf8');
      expect(deploymentConfig).toContain('CLOUDINARY_CLOUD_NAME');
      expect(deploymentConfig).toContain('Environment Variables');
      expect(deploymentConfig).toContain('Heroku');

      const checklist = fs.readFileSync(deploymentChecklistPath, 'utf8');
      expect(checklist).toContain('Cloudinary Account Setup');
      expect(checklist).toContain('Environment Configuration');
      expect(checklist).toContain('Deployment Process');

      const maintenance = fs.readFileSync(maintenancePath, 'utf8');
      expect(maintenance).toContain('Daily Maintenance');
      expect(maintenance).toContain('Monitoring');
      expect(maintenance).toContain('Troubleshooting');
    });

    it('should have updated environment example file', () => {
      const envExamplePath = path.resolve(__dirname, '../../.env.example');
      expect(fs.existsSync(envExamplePath)).toBe(true);

      const envExample = fs.readFileSync(envExamplePath, 'utf8');
      expect(envExample).toContain('CLOUDINARY_CLOUD_NAME');
      expect(envExample).toContain('CLOUDINARY_API_KEY');
      expect(envExample).toContain('CLOUDINARY_API_SECRET');
    });
  });

  describe('7. Error Handling', () => {
    it('should have error handling middleware', async () => {
      const { default: errorHandlingUpload } = await import('../../middleware/errorHandlingUpload.js');
      expect(errorHandlingUpload).toBeDefined();
    });

    it('should have image error handler service', async () => {
      const { default: imageErrorHandler } = await import('../../services/imageErrorHandler.js');
      expect(imageErrorHandler).toBeDefined();
      expect(typeof imageErrorHandler.handleUploadWithFallback).toBe('function');
    });
  });

  describe('8. Performance and Monitoring', () => {
    it('should have performance monitoring service', async () => {
      const { default: imagePerformanceService } = await import('../../services/imagePerformanceService.js');
      expect(imagePerformanceService).toBeDefined();
      expect(typeof imagePerformanceService.trackImageLoadTime).toBe('function');
    });

    it('should have monitoring routes', () => {
      const monitoringRoutesPath = path.resolve(__dirname, '../../routes/imageMonitoring.js');
      expect(fs.existsSync(monitoringRoutesPath)).toBe(true);
    });
  });

  describe('9. Backward Compatibility', () => {
    it('should maintain existing API structure', async () => {
      // Check that post controller still exists and has required methods
      const postControllerPath = path.resolve(__dirname, '../../controllers/postController.js');
      expect(fs.existsSync(postControllerPath)).toBe(true);

      const postController = fs.readFileSync(postControllerPath, 'utf8');
      expect(postController).toContain('createPost');
      expect(postController).toContain('updatePost');
    });

    it('should have fallback mechanisms', async () => {
      const { default: fallbackMigrationService } = await import('../../services/fallbackMigrationService.js');
      expect(fallbackMigrationService).toBeDefined();
    });
  });

  describe('10. Security', () => {
    it('should not expose sensitive credentials in code', () => {
      const sensitiveFiles = [
        '../../services/cloudinaryService.js',
        '../../middleware/cloudinaryUpload.js',
        '../../server.js'
      ];

      sensitiveFiles.forEach(filePath => {
        const fullPath = path.resolve(__dirname, filePath);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          // Should not contain hardcoded credentials
          expect(content).not.toMatch(/cloud_name:\s*['"][^'"]+['"]/);
          expect(content).not.toMatch(/api_key:\s*['"][^'"]+['"]/);
          expect(content).not.toMatch(/api_secret:\s*['"][^'"]+['"]/);
        }
      });
    });

    it('should use environment variables for configuration', async () => {
      const { default: cloudinaryService } = await import('../../services/cloudinaryService.js');
      
      // Service should be configurable (not throw errors when imported)
      expect(cloudinaryService).toBeDefined();
    });
  });
});