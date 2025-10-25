import mongoose from 'mongoose';
import User from '../models/User.js';
import cloudinaryService from '../services/cloudinaryService.js';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};

// Migrate profile pictures to Cloudinary
const migrateProfilePictures = async () => {
  try {
    console.log('🔄 Starting profile picture migration to Cloudinary...');

    // Find all users with local profile pictures
    const users = await User.find({
      profilePic: { $regex: '^/uploads/' }
    });

    console.log(`📸 Found ${users.length} users with local profile pictures`);

    if (users.length === 0) {
      console.log('✅ No profile pictures to migrate');
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const user of users) {
      try {
        console.log(`\n📤 Migrating profile picture for user: ${user.fullName} (${user.email})`);
        
        // Construct local file path
        const localPath = path.join(__dirname, '..', 'uploads', path.basename(user.profilePic));
        
        // Check if file exists
        try {
          await fs.access(localPath);
        } catch (error) {
          console.log(`⚠️  Local file not found: ${localPath}`);
          // Set to null if file doesn't exist
          user.profilePic = null;
          await user.save();
          continue;
        }

        // Upload to Cloudinary
        const uploadResult = await cloudinaryService.uploadImage(localPath, {
          folder: 'gp-connect/profile-pictures',
          public_id: `profile_${user._id}`,
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' },
            { quality: 'auto', fetch_format: 'auto' }
          ]
        });

        if (uploadResult.success) {
          // Update user with Cloudinary URL
          const oldProfilePic = user.profilePic;
          user.profilePic = uploadResult.data.secure_url;
          await user.save();

          console.log(`✅ Successfully migrated: ${oldProfilePic} → ${uploadResult.data.secure_url}`);
          successCount++;

          // Optionally delete local file after successful upload
          try {
            await fs.unlink(localPath);
            console.log(`🗑️  Deleted local file: ${localPath}`);
          } catch (deleteError) {
            console.log(`⚠️  Could not delete local file: ${deleteError.message}`);
          }
        } else {
          throw new Error(uploadResult.error || 'Upload failed');
        }

      } catch (error) {
        console.error(`❌ Failed to migrate profile picture for ${user.fullName}:`, error.message);
        errors.push({
          userId: user._id,
          fullName: user.fullName,
          email: user.email,
          profilePic: user.profilePic,
          error: error.message
        });
        errorCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`✅ Successfully migrated: ${successCount}`);
    console.log(`❌ Failed migrations: ${errorCount}`);

    if (errors.length > 0) {
      console.log('\n❌ Migration Errors:');
      errors.forEach(error => {
        console.log(`- ${error.fullName} (${error.email}): ${error.error}`);
      });
    }

    console.log('\n🎉 Profile picture migration completed!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

// Run migration
const runMigration = async () => {
  try {
    await connectDB();
    await migrateProfilePictures();
    process.exit(0);
  } catch (error) {
    console.error('Migration script failed:', error);
    process.exit(1);
  }
};

// Check if running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration();
}

export { migrateProfilePictures };