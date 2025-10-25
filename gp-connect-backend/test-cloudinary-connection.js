// Quick test script to verify Cloudinary connection
require('dotenv').config();
const cloudinaryService = require('./services/cloudinaryService.js');

async function testCloudinaryConnection() {
  try {
    console.log('Testing Cloudinary connection...');
    
    // Configure the service
    cloudinaryService.configure();
    console.log('✓ Cloudinary configured successfully');
    
    // Test connection
    const isConnected = await cloudinaryService.testConnection();
    if (isConnected) {
      console.log('✓ Cloudinary connection test passed');
    } else {
      console.log('✗ Cloudinary connection test failed');
    }
    
    console.log('Service ready status:', cloudinaryService.isReady());
    
  } catch (error) {
    console.error('Error testing Cloudinary:', error.message);
  }
}

testCloudinaryConnection();