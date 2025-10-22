import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const cleanInvalidConversations = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const collection = db.collection('conversations');

    console.log('=== Finding all conversations ===\n');
    const all = await collection.find({}).toArray();
    
    console.log(`Total conversations: ${all.length}\n`);
    
    for (const conv of all) {
      console.log(`Conversation ${conv._id}:`);
      console.log(`  members: ${JSON.stringify(conv.members)}`);
      console.log(`  members.length: ${conv.members?.length}`);
      console.log(`  valid: ${Array.isArray(conv.members) && conv.members.length === 2}`);
      console.log('');
    }

    // Delete conversations that don't have exactly 2 members
    console.log('=== Deleting invalid conversations ===\n');
    const deleteResult = await collection.deleteMany({
      $or: [
        { members: { $exists: false } },
        { members: null },
        { members: { $not: { $size: 2 } } }
      ]
    });

    console.log(`✓ Deleted ${deleteResult.deletedCount} invalid conversations\n`);

    // Show remaining conversations
    const remaining = await collection.find({}).toArray();
    console.log(`=== Remaining conversations: ${remaining.length} ===\n`);
    remaining.forEach(conv => {
      console.log(`${conv._id}: members = ${JSON.stringify(conv.members)}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

cleanInvalidConversations();
