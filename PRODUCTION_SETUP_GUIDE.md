# Complete Production Setup Guide

## 1. MongoDB Atlas Setup (Production Database)

### Step 1: Create MongoDB Atlas Account
1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Click "Try Free" or "Sign Up"
3. Create account with email/password or Google/GitHub
4. Verify your email address

### Step 2: Create a New Project
1. After login, click "New Project"
2. Name it "GP-Connect" or similar
3. Click "Next" → "Create Project"

### Step 3: Create a Database Cluster
1. Click "Build a Database"
2. Choose "M0 Sandbox" (FREE tier)
3. Select a cloud provider (AWS recommended)
4. Choose region closest to your users
5. Name your cluster (e.g., "gp-connect-cluster")
6. Click "Create"

### Step 4: Create Database User
1. Go to "Database Access" in left sidebar
2. Click "Add New Database User"
3. Choose "Password" authentication
4. Username: `gpconnect-admin`
5. Generate secure password (save this!)
6. Database User Privileges: "Read and write to any database"
7. Click "Add User"

### Step 5: Configure Network Access
1. Go to "Network Access" in left sidebar
2. Click "Add IP Address"
3. Choose "Allow Access from Anywhere" (0.0.0.0/0)
   - This is needed for Render/Vercel deployment
4. Click "Confirm"

### Step 6: Get Connection String
1. Go to "Database" → "Connect"
2. Choose "Connect your application"
3. Driver: Node.js, Version: 5.5 or later
4. Copy the connection string
5. Replace `<password>` with your database user password
6. Replace `<dbname>` with `gpconnect`

Example: `mongodb+srv://gpconnect-admin:YOUR_PASSWORD@gp-connect-cluster.abc123.mongodb.net/gpconnect?retryWrites=true&w=majority`

## 2. Cloudinary Setup (Image Storage)

### Step 1: Create Cloudinary Account
1. Go to [cloudinary.com](https://cloudinary.com)
2. Click "Sign Up for Free"
3. Fill in details and verify email

### Step 2: Get API Credentials
1. Go to Dashboard after login
2. Find "Account Details" section
3. Copy these values:
   - Cloud Name
   - API Key
   - API Secret (click "Reveal" to see it)

## 3. Generate JWT Secret

### Option 1: Using Node.js
```javascript
// Run this in Node.js console or create a temp file
console.log(require('crypto').randomBytes(64).toString('hex'));
```

### Option 2: Using Online Generator
1. Go to [allkeysgenerator.com](https://allkeysgenerator.com/Random/Security-Encryption-Key-Generator.aspx)
2. Select "256-bit" and "Hex"
3. Generate and copy the key

### Option 3: Using Command Line
```bash
# On Windows PowerShell
[System.Web.Security.Membership]::GeneratePassword(64, 0)

# On Mac/Linux
openssl rand -hex 32
```

## 4. Generate Chat Secret
Use the same method as JWT secret to generate a 32+ character random string.

## 5. Environment Variables Summary

You'll need these environment variables:

### Backend (.env for local, Render dashboard for production):
```
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://gpconnect-admin:YOUR_PASSWORD@gp-connect-cluster.abc123.mongodb.net/gpconnect?retryWrites=true&w=majority
JWT_SECRET=your-64-character-jwt-secret-here
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
GENERAL_COMMUNITY_ID=68dd52a283642af8c35205cc
CHAT_SECRET=your-32-character-chat-secret
CORS_ORIGIN=https://your-frontend-domain.vercel.app
```

### Frontend (.env for local, Vercel dashboard for production):
```
VITE_API_BASE_URL=https://your-backend.onrender.com/api
VITE_SOCKET_URL=https://your-backend.onrender.com
VITE_CHAT_SECRET=your-32-character-chat-secret
```

## 6. Deployment Steps

### Step 1: Deploy Backend to Render
1. Go to [render.com](https://render.com)
2. Sign up/login with GitHub
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Configure:
   - Name: `gp-connect-backend`
   - Root Directory: `gp-connect-backend`
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
6. Add all backend environment variables
7. Click "Create Web Service"
8. Wait for deployment (5-10 minutes)
9. Copy your backend URL (e.g., `https://gp-connect-backend.onrender.com`)

### Step 2: Deploy Frontend to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Sign up/login with GitHub
3. Click "New Project"
4. Import your GitHub repository
5. Configure:
   - Framework Preset: Vite
   - Root Directory: `gp-connect`
   - Build Command: `npm run build`
   - Output Directory: `dist`
6. Add frontend environment variables (use your Render backend URL)
7. Click "Deploy"
8. Wait for deployment (2-5 minutes)

## 7. Post-Deployment Setup

### Step 1: Initialize Database
1. Go to your Render backend dashboard
2. Open "Shell" tab
3. Run these commands:
```bash
npm run seed
```

### Step 2: Test Your Application
1. Visit your Vercel frontend URL
2. Try to register a new account
3. Test login/logout
4. Try creating a post with image
5. Test messaging features

## 8. Troubleshooting Common Issues

### Database Connection Issues
- Check MongoDB Atlas IP whitelist includes 0.0.0.0/0
- Verify connection string format
- Ensure database user has correct permissions

### CORS Errors
- Update CORS_ORIGIN in backend to match your Vercel domain
- Check that frontend API URLs point to correct backend

### Image Upload Issues
- Verify all Cloudinary credentials are correct
- Check Cloudinary dashboard for upload attempts

### Environment Variable Issues
- Ensure all required variables are set in both platforms
- Check for typos in variable names
- Verify secrets match between frontend and backend

## 9. Security Checklist

- [ ] Strong, unique JWT secret (64+ characters)
- [ ] Strong, unique chat secret (32+ characters)
- [ ] MongoDB user has minimal required permissions
- [ ] Cloudinary API keys are kept secret
- [ ] CORS is configured to only allow your frontend domain
- [ ] All environment variables are set in platform dashboards, not in code

## 10. Monitoring and Maintenance

### Render (Backend)
- Monitor service logs for errors
- Check resource usage
- Set up health checks

### Vercel (Frontend)
- Monitor function logs
- Check build logs for issues
- Monitor performance metrics

### MongoDB Atlas
- Monitor database performance
- Set up alerts for high usage
- Regular backups (automatic on Atlas)

### Cloudinary
- Monitor storage usage
- Check transformation usage
- Set up usage alerts