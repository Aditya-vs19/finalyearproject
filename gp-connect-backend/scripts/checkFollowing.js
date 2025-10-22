import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const checkFollowing = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB\n');

    // Get all users with their following/followers
    const users = await User.find()
      .select('fullName email following followers')
      .populate('following', 'fullName email')
      .populate('followers', 'fullName email');

    console.log('=== User Following Relationships ===\n');

    for (const user of users) {
      console.log(`👤 ${user.fullName} (${user.email})`);
      console.log(`   Following ${user.following.length} users:`);
      user.following.forEach(f => console.log(`     → ${f.fullName}`));
      console.log(`   Followed by ${user.followers.length} users:`);
      user.followers.forEach(f => console.log(`     ← ${f.fullName}`));
      
      // Check mutual following
      const mutualFollowers = user.followers.filter(follower =>
        user.following.some(following => following._id.toString() === follower._id.toString())
      );
      
      console.log(`   💚 Mutual following (${mutualFollowers.length}):`);
      mutualFollowers.forEach(m => console.log(`     ↔ ${m.fullName}`));
      console.log('');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

checkFollowing();
