import mongoose from 'mongoose';
import User from '../models/User.js';
import Post from '../models/Post.js';
import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import Notification from '../models/Notification.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const cleanupDeletedUsers = async () => {
  try {
    console.log('🧹 Starting cleanup of deleted user references...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Get all existing user IDs
    const existingUsers = await User.find({}, '_id');
    const existingUserIds = existingUsers.map(user => user._id.toString());
    console.log(`📊 Found ${existingUserIds.length} existing users`);

    let totalCleaned = 0;

    // 1. Clean up Posts
    console.log('\n🔍 Cleaning up Posts...');
    
    // Remove posts from deleted users
    const deletedPosts = await Post.deleteMany({
      userId: { $nin: existingUserIds }
    });
    console.log(`🗑️  Deleted ${deletedPosts.deletedCount} posts from deleted users`);
    totalCleaned += deletedPosts.deletedCount;

    // Remove likes from deleted users in existing posts
    const postsWithDeletedLikes = await Post.updateMany(
      {},
      {
        $pull: {
          likes: { $nin: existingUserIds.map(id => new mongoose.Types.ObjectId(id)) }
        }
      }
    );
    console.log(`🧹 Cleaned likes from deleted users in ${postsWithDeletedLikes.modifiedCount} posts`);

    // Remove comments from deleted users in existing posts
    const postsWithDeletedComments = await Post.updateMany(
      {},
      {
        $pull: {
          comments: { 
            user: { $nin: existingUserIds.map(id => new mongoose.Types.ObjectId(id)) }
          }
        }
      }
    );
    console.log(`🧹 Cleaned comments from deleted users in ${postsWithDeletedComments.modifiedCount} posts`);

    // Update likes and comments counts
    const allPosts = await Post.find({});
    for (const post of allPosts) {
      post.likesCount = post.likes.length;
      post.commentsCount = post.comments.length;
      await post.save();
    }
    console.log(`📊 Updated likes/comments counts for ${allPosts.length} posts`);

    // 2. Clean up User followers/following relationships
    console.log('\n🔍 Cleaning up User relationships...');
    
    const usersWithDeletedFollowers = await User.updateMany(
      {},
      {
        $pull: {
          followers: { $nin: existingUserIds.map(id => new mongoose.Types.ObjectId(id)) },
          following: { $nin: existingUserIds.map(id => new mongoose.Types.ObjectId(id)) }
        }
      }
    );
    console.log(`🧹 Cleaned followers/following from ${usersWithDeletedFollowers.modifiedCount} users`);

    // 3. Clean up Messages
    console.log('\n🔍 Cleaning up Messages...');
    
    const deletedMessages = await Message.deleteMany({
      sender: { $nin: existingUserIds.map(id => new mongoose.Types.ObjectId(id)) }
    });
    console.log(`🗑️  Deleted ${deletedMessages.deletedCount} messages from deleted users`);
    totalCleaned += deletedMessages.deletedCount;

    // 4. Clean up Conversations
    console.log('\n🔍 Cleaning up Conversations...');
    
    const deletedConversations = await Conversation.deleteMany({
      members: { 
        $not: { 
          $all: existingUserIds.map(id => new mongoose.Types.ObjectId(id)) 
        }
      }
    });
    console.log(`🗑️  Deleted ${deletedConversations.deletedCount} conversations with deleted users`);
    totalCleaned += deletedConversations.deletedCount;

    // 5. Clean up Notifications
    console.log('\n🔍 Cleaning up Notifications...');
    
    const deletedNotifications = await Notification.deleteMany({
      $or: [
        { recipient: { $nin: existingUserIds.map(id => new mongoose.Types.ObjectId(id)) } },
        { sender: { $nin: existingUserIds.map(id => new mongoose.Types.ObjectId(id)) } }
      ]
    });
    console.log(`🗑️  Deleted ${deletedNotifications.deletedCount} notifications from/to deleted users`);
    totalCleaned += deletedNotifications.deletedCount;

    // 6. Clean up orphaned posts (posts referencing deleted users in likes/comments)
    console.log('\n🔍 Final cleanup of orphaned references...');
    
    // Remove any remaining invalid ObjectIds - using proper MongoDB syntax
    await Post.updateMany(
      {},
      {
        $pull: {
          likes: { $nin: existingUserIds.map(id => new mongoose.Types.ObjectId(id)) }
        }
      }
    );

    await Post.updateMany(
      {},
      {
        $pull: {
          "comments": { 
            "user": { $nin: existingUserIds.map(id => new mongoose.Types.ObjectId(id)) }
          }
        }
      }
    );

    console.log('\n✅ Cleanup completed successfully!');
    console.log(`📊 Total items cleaned: ${totalCleaned}`);
    console.log('🔄 Please restart your application to see the changes');

    // Verify cleanup
    console.log('\n🔍 Verification:');
    const remainingPosts = await Post.countDocuments();
    const remainingMessages = await Message.countDocuments();
    const remainingConversations = await Conversation.countDocuments();
    const remainingNotifications = await Notification.countDocuments();
    
    console.log(`📊 Remaining Posts: ${remainingPosts}`);
    console.log(`📊 Remaining Messages: ${remainingMessages}`);
    console.log(`📊 Remaining Conversations: ${remainingConversations}`);
    console.log(`📊 Remaining Notifications: ${remainingNotifications}`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run the cleanup
cleanupDeletedUsers();