import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Conversation from '../models/Conversation.js';

dotenv.config();

const testQuery = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB\n');

    const userId1 = '68d8e299b8ff5aa565bcac30'; // Aditya_1819
    const userId2 = '68d8fd9508c7a347ef164fa1'; // Rudraksh

    // Test sortPair
    const sortPair = (a, b) => {
      const [first, second] = [a, b].map((id) => id.toString()).sort();
      return [new mongoose.Types.ObjectId(first), new mongoose.Types.ObjectId(second)];
    };

    const members = sortPair(userId1, userId2);
    console.log('Sorted members:', members);
    console.log('');

    // Try different query methods
    console.log('=== Method 1: Exact array match ===');
    const result1 = await Conversation.findOne({ members });
    console.log('Result:', result1 ? `Found: ${result1._id}` : 'Not found');
    console.log('');

    console.log('=== Method 2: $all query ===');
    const result2 = await Conversation.findOne({
      members: { $all: members },
      $expr: { $eq: [{ $size: '$members' }, 2] }
    });
    console.log('Result:', result2 ? `Found: ${result2._id}` : 'Not found');
    console.log('');

    console.log('=== Method 3: Check raw database ===');
    const db = mongoose.connection.db;
    const collection = db.collection('conversations');
    const all = await collection.find({}).toArray();
    console.log(`Total conversations: ${all.length}`);
    all.forEach(conv => {
      console.log(`  ${conv._id}:`);
      console.log(`    members[0]: ${conv.members[0]} (type: ${typeof conv.members[0]})`);
      console.log(`    members[1]: ${conv.members[1]} (type: ${typeof conv.members[1]})`);
      console.log(`    Match userId1? ${conv.members.some(m => m.toString() === userId1)}`);
      console.log(`    Match userId2? ${conv.members.some(m => m.toString() === userId2)}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

testQuery();
