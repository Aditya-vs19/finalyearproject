import dotenv from 'dotenv';
import connectDB from './config/db.js';
import initializeCommunities from './utils/initializeCommunities.js';

dotenv.config();

const seedCommunities = async () => {
  try {
    await connectDB();
    await initializeCommunities();
    console.log('Communities ensured successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error ensuring communities:', error);
    process.exit(1);
  }
};

seedCommunities();
