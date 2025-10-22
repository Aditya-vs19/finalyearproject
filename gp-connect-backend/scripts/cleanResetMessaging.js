import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const cleanReset = async () => {
  try {
    console.log('🧹 Starting clean reset of messaging system...\n');
    
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✓ Connected to MongoDB\n');

    const db = mongoose.connection.db;

    // Step 1: Delete all conversations and messages
    console.log('=== Step 1: Clearing old data ===');
    const conversationsResult = await db.collection('conversations').deleteMany({});
    const messagesResult = await db.collection('messages').deleteMany({});
    console.log(`✓ Deleted ${conversationsResult.deletedCount} conversations`);
    console.log(`✓ Deleted ${messagesResult.deletedCount} messages\n`);

    // Step 2: Drop all indexes on conversations collection
    console.log('=== Step 2: Dropping old indexes ===');
    try {
      const indexes = await db.collection('conversations').indexes();
      for (const index of indexes) {
        if (index.name !== '_id_') {
          try {
            await db.collection('conversations').dropIndex(index.name);
            console.log(`✓ Dropped index: ${index.name}`);
          } catch (e) {
            console.log(`- Could not drop ${index.name}: ${e.message}`);
          }
        }
      }
    } catch (e) {
      console.log('- No indexes to drop');
    }
    console.log('');

    // Step 3: Create proper indexes
    console.log('=== Step 3: Creating new indexes ===');
    
    // Unique index on sorted members array
    await db.collection('conversations').createIndex(
      { members: 1 },
      { unique: true, name: 'members_unique' }
    );
    console.log('✓ Created members_unique index');

    // Index on updatedAt for sorting
    await db.collection('conversations').createIndex(
      { updatedAt: -1 },
      { name: 'updatedAt_desc' }
    );
    console.log('✓ Created updatedAt_desc index\n');

    // Step 4: Create indexes on messages collection
    console.log('=== Step 4: Creating message indexes ===');
    
    try {
      const msgIndexes = await db.collection('messages').indexes();
      for (const index of msgIndexes) {
        if (index.name !== '_id_') {
          try {
            await db.collection('messages').dropIndex(index.name);
            console.log(`✓ Dropped message index: ${index.name}`);
          } catch (e) {
            console.log(`- Could not drop ${index.name}`);
          }
        }
      }
    } catch (e) {
      console.log('- No message indexes to drop');
    }
    
    await db.collection('messages').createIndex(
      { conversationId: 1, createdAt: 1 },
      { name: 'conversation_time' }
    );
    console.log('✓ Created conversation_time index\n');

    // Step 5: Verify
    console.log('=== Step 5: Verification ===');
    const convIndexes = await db.collection('conversations').indexes();
    console.log('Conversation indexes:');
    convIndexes.forEach(idx => console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`));
    
    const msgIndexes = await db.collection('messages').indexes();
    console.log('\nMessage indexes:');
    msgIndexes.forEach(idx => console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`));

    console.log('\n✅ Clean reset completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Restart your backend server');
    console.log('   2. Restart your frontend');
    console.log('   3. Try creating a new conversation\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
};

cleanReset();
