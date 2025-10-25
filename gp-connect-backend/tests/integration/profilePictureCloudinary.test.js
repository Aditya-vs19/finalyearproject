import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../server.js';
import User from '../../models/User.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Profile Picture Cloudinary Integration', () => {
  let mongoServer;
  let testUser;
  let authToken;

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear database
    await User.deleteMany({});

    // Create test user
    testUser = await User.create({
      fullName: 'Test User',
      email: 'test@example.com',
      enrollment: 'TEST123',
      password: 'password123',
      department: 'Computer',
      isVerified: true
    });

    // Login to get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });

    authToken = loginResponse.body.token;
  });

  describe('Profile Picture Upload', () => {
    it('should upload profile picture to Cloudinary', async () => {
      // Create a test image file path
      const testImagePath = path.join(__dirname, '../fixtures/test-image.jpg');
      
      // Skip test if Cloudinary is not configured
      if (!process.env.CLOUDINARY_CLOUD_NAME) {
        console.log('⚠️  Skipping Cloudinary test - no configuration found');
        return;
      }

      const response = await request(app)
        .post(`/api/profile/${testUser._id}/upload`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('profilePic', testImagePath);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Profile picture updated successfully');
      expect(response.body).toHaveProperty('profilePic');
      expect(response.body).toHaveProperty('cloudinaryData');

      // Verify it's a Cloudinary URL
      const profilePicUrl = response.body.profilePic;
      expect(profilePicUrl).toMatch(/cloudinary\.com/);
      expect(profilePicUrl).toMatch(/^https?:\/\//);

      // Verify Cloudinary data
      expect(response.body.cloudinaryData).toHaveProperty('public_id');
      expect(response.body.cloudinaryData).toHaveProperty('secure_url');
      expect(response.body.cloudinaryData).toHaveProperty('format');

      // Verify user was updated in database
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.profilePic).toBe(profilePicUrl);
      expect(updatedUser.profilePic).toMatch(/cloudinary\.com/);
    });

    it('should handle missing file gracefully', async () => {
      const response = await request(app)
        .post(`/api/profile/${testUser._id}/upload`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/no image file provided/i);
    });

    it('should reject unauthorized upload', async () => {
      const testImagePath = path.join(__dirname, '../fixtures/test-image.jpg');

      const response = await request(app)
        .post(`/api/profile/${testUser._id}/upload`)
        .attach('profilePic', testImagePath);

      expect(response.status).toBe(401);
    });

    it('should reject upload for different user', async () => {
      // Create another user
      const otherUser = await User.create({
        fullName: 'Other User',
        email: 'other@example.com',
        enrollment: 'OTHER123',
        password: 'password123',
        department: 'Computer',
        isVerified: true
      });

      const testImagePath = path.join(__dirname, '../fixtures/test-image.jpg');

      const response = await request(app)
        .post(`/api/profile/${otherUser._id}/upload`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('profilePic', testImagePath);

      expect(response.status).toBe(401);
      expect(response.body.message).toMatch(/not authorized/i);
    });
  });

  describe('Profile Picture Display', () => {
    it('should return Cloudinary URL in profile data', async () => {
      // Set a mock Cloudinary URL
      const cloudinaryUrl = 'https://res.cloudinary.com/test/image/upload/v123/profile_test.jpg';
      testUser.profilePic = cloudinaryUrl;
      await testUser.save();

      const response = await request(app)
        .get(`/api/profile/${testUser._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user.profilePic).toBe(cloudinaryUrl);
    });

    it('should handle null profile picture', async () => {
      testUser.profilePic = null;
      await testUser.save();

      const response = await request(app)
        .get(`/api/profile/${testUser._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user.profilePic).toBe('');
    });
  });

  describe('Backward Compatibility', () => {
    it('should handle legacy local URLs', async () => {
      // Set a legacy local URL
      testUser.profilePic = '/uploads/legacy-avatar.jpg';
      await testUser.save();

      const response = await request(app)
        .get(`/api/profile/${testUser._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user.profilePic).toBe('/uploads/legacy-avatar.jpg');
    });
  });
});

describe('Profile Picture Migration Compatibility', () => {
  it('should identify users with local profile pictures', async () => {
    // Create users with different profile picture types
    await User.create([
      {
        fullName: 'User 1',
        email: 'user1@example.com',
        enrollment: 'USER001',
        password: 'password123',
        department: 'Computer',
        profilePic: '/uploads/avatar1.jpg' // Local
      },
      {
        fullName: 'User 2', 
        email: 'user2@example.com',
        enrollment: 'USER002',
        password: 'password123',
        department: 'Computer',
        profilePic: 'https://res.cloudinary.com/test/image/upload/avatar2.jpg' // Cloudinary
      },
      {
        fullName: 'User 3',
        email: 'user3@example.com', 
        enrollment: 'USER003',
        password: 'password123',
        department: 'Computer',
        profilePic: '' // Empty
      }
    ]);

    // Find users with local profile pictures (migration candidates)
    const localPicUsers = await User.find({
      profilePic: { $regex: '^/uploads/' }
    });

    expect(localPicUsers).toHaveLength(1);
    expect(localPicUsers[0].email).toBe('user1@example.com');

    // Find users with Cloudinary URLs
    const cloudinaryUsers = await User.find({
      profilePic: { $regex: 'cloudinary\\.com' }
    });

    expect(cloudinaryUsers).toHaveLength(1);
    expect(cloudinaryUsers[0].email).toBe('user2@example.com');
  });
});