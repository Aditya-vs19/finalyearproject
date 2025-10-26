#!/usr/bin/env node

import crypto from 'crypto';

console.log('🔐 Generating Production Secrets for GP Connect\n');

// Generate JWT Secret (64 bytes = 128 hex characters)
const jwtSecret = crypto.randomBytes(64).toString('hex');
console.log('JWT_SECRET:');
console.log(jwtSecret);
console.log('');

// Generate Chat Secret (32 bytes = 64 hex characters)
const chatSecret = crypto.randomBytes(32).toString('hex');
console.log('CHAT_SECRET:');
console.log(chatSecret);
console.log('');

// Generate a sample General Community ID (MongoDB ObjectId format)
const generalCommunityId = crypto.randomBytes(12).toString('hex');
console.log('GENERAL_COMMUNITY_ID (you can use this or generate from your seeded data):');
console.log(generalCommunityId);
console.log('');

console.log('📋 Copy these values to your environment variables:');
console.log('');
console.log('Backend Environment Variables:');
console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`CHAT_SECRET=${chatSecret}`);
console.log(`GENERAL_COMMUNITY_ID=${generalCommunityId}`);
console.log('');
console.log('Frontend Environment Variables:');
console.log(`VITE_CHAT_SECRET=${chatSecret}`);
console.log('');
console.log('⚠️  Keep these secrets secure and never commit them to version control!');