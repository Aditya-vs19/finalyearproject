import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const fixIndexes = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected successfully');

    const db = mongoose.connection.db;
    const collection = db.collection('conversations');

    console.log('\n=== Step 1: Check existing data ===');
    const totalCount = await collection.countDocuments();
    const invalidCount = await collection.countDocuments({ members: { $exists: false } });
    const nullMembersCount = await collection.countDocuments({ members: null });
    
    console.log(`Total conversations: ${totalCount}`);
    console.log(`Conversations without members field: ${invalidCount}`);
    console.log(`Conversations with null members: ${nullMembersCount}`);

    // Delete invalid/old conversations
    if (invalidCount > 0 || nullMembersCount > 0) {
      console.log('\n=== Step 2: Cleaning up invalid conversations ===');
      const deleteResult = await collection.deleteMany({
        $or: [
          { members: { $exists: false } },
          { members: null },
          { members: { $size: 0 } }
        ]
      });
      console.log(`✓ Deleted ${deleteResult.deletedCount} invalid conversations`);
    }

    console.log('\n=== Step 3: Dropping old indexes ===');
    const indexes = await collection.indexes();
    const oldIndexNames = [
      'participants_1',
      'participantAId_1',
      'participantBId_1',
      'participantAId_1_lastMessageAt_-1',
      'participantBId_1_lastMessageAt_-1',
      'participants.user_1',
      'lastActivity_-1',
      'type_1'
    ];

    for (const indexName of oldIndexNames) {
      try {
        await collection.dropIndex(indexName);
        console.log(`✓ Dropped index: ${indexName}`);
      } catch (error) {
        if (error.code === 27) {
          console.log(`- Index ${indexName} does not exist (skipped)`);
        } else {
          console.log(`⚠ Could not drop ${indexName}: ${error.message}`);
        }
      }
    }

    console.log('\n=== Step 4: Creating new members index ===');
    // For array fields, we need to ensure the ENTIRE array is unique, not individual elements
    // MongoDB treats array indexes specially - we need a compound unique index on both members
    try {
      await collection.dropIndex('members_1');
      console.log('✓ Dropped existing members_1 index');
    } catch (e) {
      console.log('- No existing members_1 index to drop');
    }
    
    // Create a unique index on the sorted members array
    // This ensures each unique pair can only have one conversation
    await collection.createIndex(
      { members: 1 },
      { unique: true, name: 'members_unique' }
    );
    console.log('✓ Successfully created members_unique index');

    console.log('\n=== Final index list ===');
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach(idx => {
      console.log(`- ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    console.log('\n✅ Migration completed successfully!');
    console.log('\n⚠️  IMPORTANT: Restart your backend server now!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
};

fixIndexes();
