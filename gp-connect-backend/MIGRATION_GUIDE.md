# Image Migration Guide

This guide explains how to migrate existing local images to Cloudinary cloud storage using the migration script.

## Prerequisites

1. **Environment Variables**: Ensure all required environment variables are set in your `.env` file:
   ```env
   MONGODB_URI=your_mongodb_connection_string
   CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret
   ```

2. **Dependencies**: Make sure all npm packages are installed:
   ```bash
   npm install
   ```

3. **Database Connection**: Ensure your MongoDB database is accessible and contains the posts you want to migrate.

## Migration Process

### Step 1: Validate Environment

Before starting the migration, validate that your environment is properly configured:

```bash
npm run migrate:validate
```

This will check:
- Required environment variables are present
- Cloudinary connection is working
- MongoDB connection can be established
- Uploads directory exists (if applicable)

### Step 2: Check Current Status

View the current state of your images:

```bash
npm run migrate:status
```

This shows:
- Total posts with images
- Posts already using Cloudinary
- Posts still using local storage
- Previous migration information (if any)

### Step 3: Create Backup

**IMPORTANT**: Always create a backup before running the migration:

```bash
npm run migrate:backup
```

This creates a `migration-backup.json` file containing all current image references in your database.

### Step 4: Run Migration

#### Dry Run (Recommended First)

Test the migration without making any changes:

```bash
npm run migrate:dry-run
```

This will show you what would be migrated without actually performing the migration.

#### Full Migration

Run the actual migration:

```bash
npm run migrate:run
```

**Options available:**
- `--batch-size <size>`: Number of images to process in each batch (default: 5)
- `--retry-attempts <attempts>`: Number of retry attempts for failed uploads (default: 3)
- `--skip-backup`: Skip creating backup before migration (not recommended)

Example with custom options:
```bash
node scripts/migrateImages.js migrate --batch-size 10 --retry-attempts 5
```

### Step 5: Validate Results

After migration, the script automatically validates the results. You can also check the status again:

```bash
npm run migrate:status
```

## Migration Results

The migration process will:

1. **Scan** the `uploads/` directory for image files
2. **Upload** each image to Cloudinary
3. **Update** database records to use Cloudinary URLs
4. **Validate** that all images are accessible
5. **Log** detailed information about the process

### Success Indicators

- ✅ All images successfully uploaded to Cloudinary
- ✅ All database records updated with new URLs
- ✅ No broken image links detected
- ✅ Migration log shows success status

### Common Issues

- **Upload Failures**: Some images may fail to upload due to network issues or file corruption
- **Database Update Errors**: Database connection issues during the update phase
- **Missing Posts**: Images found locally but no corresponding posts in database

## Rollback Process

If something goes wrong during migration, you can rollback to the previous state:

```bash
npm run migrate:rollback
```

This will:
- Restore all image references from the backup file
- Revert database changes
- Leave Cloudinary images intact (for safety)

## Cleanup

After successful migration and verification, you can clean up temporary files:

```bash
npm run migrate:cleanup
```

This removes:
- Migration backup file
- Migration log file

**Note**: This does NOT remove the original local image files. You should manually delete them after confirming the migration was successful.

## Troubleshooting

### Environment Issues

**Problem**: "Missing required environment variables"
**Solution**: Check your `.env` file and ensure all Cloudinary credentials are present

**Problem**: "Failed to connect to Cloudinary"
**Solution**: Verify your Cloudinary credentials are correct and your account is active

### Migration Issues

**Problem**: "No images found to migrate"
**Solution**: Check that the `uploads/` directory exists and contains image files

**Problem**: "Database connection failed"
**Solution**: Verify your MongoDB connection string and ensure the database is accessible

**Problem**: "Some images failed to upload"
**Solution**: Check the migration log for specific error messages. Common causes:
- Network connectivity issues
- File corruption
- Cloudinary account limits reached

### Post-Migration Issues

**Problem**: "Images not displaying in application"
**Solution**: 
- Check that the frontend is using the updated image URLs
- Verify Cloudinary URLs are accessible
- Check browser console for CORS or loading errors

## File Locations

- **Migration Script**: `scripts/migrateImages.js`
- **Migration Service**: `services/migrationService.js`
- **Backup File**: `migration-backup.json` (created during migration)
- **Log File**: `migration-log.json` (created during migration)
- **Local Images**: `uploads/` directory

## Best Practices

1. **Always run validation first** to catch configuration issues early
2. **Create backups** before any migration attempt
3. **Test with dry-run** to understand what will be migrated
4. **Monitor the process** and check logs for any issues
5. **Validate results** after migration completes
6. **Keep backups** until you're confident the migration was successful
7. **Test your application** thoroughly after migration

## Support

If you encounter issues during migration:

1. Check the migration log file for detailed error information
2. Verify your environment configuration
3. Ensure your Cloudinary account has sufficient quota
4. Test individual components (database connection, Cloudinary upload) separately

For additional help, refer to:
- [Cloudinary Documentation](https://cloudinary.com/documentation)
- [MongoDB Connection Troubleshooting](https://docs.mongodb.com/manual/reference/connection-string/)