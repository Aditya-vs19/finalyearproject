import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const checkConversations = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const collection = db.collection('conversations');

    console.log('=== All Conversations ===\n');
    const conversations = await collection.find({}).toArray();
    
    conversations.forEach((conv, index) => {
      console.log(`Conversation ${index + 1}:`);
      console.log(`  _id: ${conv._id}`);
      console.log(`  members: ${JSON.stringify(conv.members)}`);
      console.log(`  members length: ${conv.members?.length || 'N/A'}`);
      console.log(`  lastMessage: ${conv.lastMessage || 'null'}`);
      console.log(`  created: ${conv.createdAt}`);
      console.log('');
    });

    console.log(`Total: ${conversations.length} conversations`);

    // Check for invalid conversations
    const invalid = conversations.filter(c => 
      !Array.isArray(c.members) || c.members.length !== 2
    );

    if (invalid.length > 0) {
      console.log(`\n⚠️  Found ${invalid.length} invalid conversations:`);
      invalid.forEach(conv => {
        console.log(`  - ${conv._id}: members = ${JSON.stringify(conv.members)}`);
      });
      
      console.log('\n❌ Deleting invalid conversations...');
      const result = await collection.deleteMany({
        $or: [
          { members: { $exists: false } },
          { members: null },
          { members: { $not: { $size: 2 } } }
        ]
      });
      console.log(`✓ Deleted ${result.deletedCount} invalid conversations`);
    } else {
      console.log('\n✅ All conversations are valid');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

checkConversations();
