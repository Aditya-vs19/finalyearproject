#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🖼️  Setting up image directories and sample data...\n');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'gp-connect-backend', 'uploads');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('✅ Created uploads directory');
} else {
    console.log('✅ Uploads directory already exists');
}

// Create a simple placeholder image
const placeholderImage = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
);

// Create sample images for testing
const sampleImages = [
    { name: 'profile-sample.jpg', type: 'profile' },
    { name: 'post-sample1.jpg', type: 'post' },
    { name: 'post-sample2.jpg', type: 'post' }
];

sampleImages.forEach(image => {
    const imagePath = path.join(uploadsDir, image.name);
    if (!fs.existsSync(imagePath)) {
        fs.writeFileSync(imagePath, placeholderImage);
        console.log(`✅ Created ${image.type} sample image: ${image.name}`);
    } else {
        console.log(`✅ ${image.type} sample image already exists: ${image.name}`);
    }
});

console.log('\n🎉 Image setup complete!');
console.log('\n📝 Next steps:');
console.log('1. Start your backend server: cd gp-connect-backend && npm start');
console.log('2. Start your frontend: cd gp-connect && npm run dev');
console.log('3. Create some posts to generate real images');
console.log('4. Images will be stored in gp-connect-backend/uploads/');
console.log('\n💡 Tip: The uploads directory will be populated as users upload content.');
