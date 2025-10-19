import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Community from '../models/Community.js';
import User from '../models/User.js';

// Load environment variables
dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/gpconnect');
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const seedCommonCommunity = async () => {
  try {
    await connectDB();
    
  console.log('Starting Official Announcements Community seed...');
    
  // Delete existing community with the specific ID
    const deleteResult = await Community.deleteOne({ _id: '68dd52a283642af8c35205cc' });
    console.log(`Deleted existing community: ${deleteResult.deletedCount}`);
    
    // Get the first user to be the creator, or create a system user
    let systemUser = await User.findOne({ email: 'system@gpconnect.com' });
    if (!systemUser) {
      systemUser = new User({
        fullName: 'GP-Connect System',
        email: 'system@gpconnect.com',
        password: 'system123', // This won't be used for login
        enrollment: 'SYSTEM1',
        department: 'Computer',
        isVerified: true
      });
      await systemUser.save();
    }
    
    // Create the announcement community with the specific ID
    const commonCommunity = new Community({
      _id: '68dd52a283642af8c35205cc',
      name: 'Official Announcements Community',
      description: 'Stay informed with the latest news, alerts, and official updates from the GP-ConneX team.',
      avatar: '🌐',
      members: [],
      messages: [],
      createdBy: systemUser._id
    });
    
    await commonCommunity.save();
    
  console.log('✅ Official Announcements Community created successfully!');
    console.log(`Community ID: ${commonCommunity._id}`);
    console.log(`Community Name: ${commonCommunity.name}`);
    console.log(`Community Description: ${commonCommunity.description}`);
    
    console.log('\n🎉 Seed completed successfully!');
  console.log('The Official Announcements Community is ready for use.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
};

// Run the seed
seedCommonCommunity();
