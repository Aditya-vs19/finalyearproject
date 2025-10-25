// Simple script to create a test user for login testing
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

async function createTestUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Check if test user already exists
    const existingUser = await User.findOne({ email: 'test@example.com' });
    if (existingUser) {
      console.log('Test user already exists');
      console.log('Email: test@example.com');
      console.log('Password: password123');
      console.log('Verified:', existingUser.isVerified);
      
      if (!existingUser.isVerified) {
        existingUser.isVerified = true;
        await existingUser.save();
        console.log('✅ User verified');
      }
      
      process.exit(0);
    }

    // Create test user
    const testUser = new User({
      fullName: 'Test User',
      email: 'test@example.com',
      enrollment: 'TEST123',
      password: 'password123',
      department: 'Computer Engineering',
      departmentCode: 'CE',
      admissionYear: 2023,
      isVerified: true, // Skip email verification for testing
    });

    await testUser.save();
    console.log('✅ Test user created successfully!');
    console.log('Email: test@example.com');
    console.log('Password: password123');
    console.log('Enrollment: TEST123');

  } catch (error) {
    console.error('❌ Error creating test user:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

createTestUser();