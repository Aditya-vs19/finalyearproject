# Complete Deployment Guide: GP Connect

This guide will walk you through deploying your full-stack MERN application:
- **Backend (Node.js/Express)** on **Render**
- **Frontend (React/Vite)** on **Vercel**

---

## 📋 Prerequisites

Before starting, ensure you have:

1. ✅ A GitHub account (your repo: `Aditya-vs19/finalyearproject`)
2. ✅ A Render account (sign up at https://render.com)
3. ✅ A Vercel account (sign up at https://vercel.com)
4. ✅ MongoDB Atlas account (for database hosting)
5. ✅ Cloudinary account (for image hosting)
6. ✅ All environment variables ready

---

## 🗂️ Project Analysis

### Backend (gp-connect-backend)
- **Framework**: Express.js (Node.js)
- **Database**: MongoDB
- **File Uploads**: Cloudinary
- **Real-time**: Socket.io
- **Authentication**: JWT
- **Email**: Nodemailer
- **Port**: 5000 (configurable via `process.env.PORT`)

### Frontend (gp-connect)
- **Framework**: React + Vite
- **State Management**: React Context
- **Routing**: React Router
- **Styling**: Bootstrap + Tailwind CSS
- **Real-time**: Socket.io-client
- **API Calls**: Axios

---

## 🚀 PART 1: Deploy Backend to Render

### Step 1: Prepare MongoDB Atlas Database

1. **Go to MongoDB Atlas** (https://www.mongodb.com/cloud/atlas)
2. **Create a new cluster** (or use existing)
3. **Create Database User**:
   - Go to Database Access → Add New Database User
   - Set username and password (save these!)
   - Grant read/write permissions

4. **Whitelist IP Addresses**:
   - Go to Network Access → Add IP Address
   - Click "Allow Access from Anywhere" (0.0.0.0/0)
   - Confirm

5. **Get Connection String**:
   - Go to Databases → Connect → Connect your application
   - Copy the connection string (looks like: `mongodb+srv://username:<password>@cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority`)
   - Replace `<password>` with your actual password
   - Add your database name: `mongodb+srv://username:password@cluster.xxxxx.mongodb.net/gp-connect?retryWrites=true&w=majority`

### Step 2: Prepare Cloudinary Configuration

1. **Go to Cloudinary** (https://cloudinary.com)
2. **Get your credentials** from Dashboard:
   - Cloud Name
   - API Key
   - API Secret
3. Keep these ready for environment variables

### Step 3: Prepare Backend for Deployment

1. **Verify `package.json` has correct start script**:
   - Already configured: `"start": "node server.js"`

2. **Create `.gitignore` in backend** (if not exists):
```
node_modules/
.env
.env.backup
uploads/
*.log
.DS_Store
```

3. **Commit and push your code to GitHub**:
```bash
git add .
git commit -m "Prepare backend for Render deployment"
git push origin main
```

### Step 4: Deploy on Render

1. **Go to Render Dashboard** (https://dashboard.render.com/)

2. **Create New Web Service**:
   - Click "New +" → "Web Service"
   - Connect your GitHub repository: `Aditya-vs19/finalyearproject`
   - Click "Connect"

3. **Configure the Service**:
   - **Name**: `gp-connect-backend` (or any name you prefer)
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Root Directory**: `gp-connect-backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Choose "Free" for testing (upgrade later for production)

4. **Add Environment Variables**:
   Click "Advanced" → "Add Environment Variable" and add the following:

   ```
   NODE_ENV=production
   PORT=5000
   MONGO_URI=<your-mongodb-atlas-connection-string>
   JWT_SECRET=<generate-a-strong-random-string-32+characters>
   CHAT_SECRET=<generate-another-strong-random-string>
   
   # Email Configuration (Gmail example)
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=<your-email@gmail.com>
   EMAIL_PASS=<your-gmail-app-password>
   
   # Cloudinary Configuration
   CLOUDINARY_CLOUD_NAME=<your-cloudinary-cloud-name>
   CLOUDINARY_API_KEY=<your-cloudinary-api-key>
   CLOUDINARY_API_SECRET=<your-cloudinary-api-secret>
   
   # CORS Configuration (will update after deploying frontend)
   CORS_ORIGIN=http://localhost:5173
   
   # General Community ID (optional - will be created on first run)
   GENERAL_COMMUNITY_ID=
   ```

   **Important Notes**:
   - Generate JWT_SECRET: Use a password generator or run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - For Gmail APP Password: Go to Google Account → Security → 2-Step Verification → App passwords
   - CORS_ORIGIN will be updated after deploying frontend

5. **Create Web Service**:
   - Click "Create Web Service"
   - Render will start building and deploying
   - Wait for deployment to complete (5-10 minutes)

6. **Note Your Backend URL**:
   - Once deployed, you'll get a URL like: `https://gp-connect-backend.onrender.com`
   - Copy this URL - you'll need it for frontend configuration

7. **Test Your Backend**:
   - Visit: `https://your-backend-url.onrender.com/api/health`
   - You should see a health check response

### Step 5: Initialize Database (Optional)

If you need to seed communities or run migrations:

1. **Go to Render Dashboard** → Your Service → "Shell"
2. **Run seed command**:
   ```bash
   npm run seed
   ```

---

## 🚀 PART 2: Deploy Frontend to Vercel

### Step 1: Prepare Frontend for Deployment

1. **Update Environment Variables**:
   
   Edit `gp-connect/.env`:
   ```env
   # Replace with your actual Render backend URL
   VITE_API_BASE_URL=https://gp-connect-backend.onrender.com/api
   VITE_SOCKET_URL=https://gp-connect-backend.onrender.com
   VITE_CHAT_SECRET=<same-as-backend-CHAT_SECRET>
   ```

2. **Create Production Environment File**:
   
   Create `gp-connect/.env.production`:
   ```env
   VITE_API_BASE_URL=https://gp-connect-backend.onrender.com/api
   VITE_SOCKET_URL=https://gp-connect-backend.onrender.com
   VITE_CHAT_SECRET=<same-as-backend-CHAT_SECRET>
   ```

3. **Verify Build Configuration**:
   
   Check `gp-connect/vite.config.js` - already configured correctly ✓

4. **Test Local Build**:
   ```bash
   cd gp-connect
   npm run build
   npm run preview
   ```
   - Verify the production build works locally
   - Check console for any errors

5. **Commit Changes**:
   ```bash
   git add .
   git commit -m "Configure frontend for Vercel deployment"
   git push origin main
   ```

### Step 2: Deploy on Vercel

1. **Go to Vercel Dashboard** (https://vercel.com/dashboard)

2. **Import Project**:
   - Click "Add New..." → "Project"
   - Click "Import Git Repository"
   - Select your repository: `Aditya-vs19/finalyearproject`
   - Click "Import"

3. **Configure Project**:
   - **Project Name**: `gp-connect` (or any name)
   - **Framework Preset**: Vite (should auto-detect)
   - **Root Directory**: Click "Edit" → Select `gp-connect`
   - **Build Command**: `npm run build` (auto-filled)
   - **Output Directory**: `dist` (auto-filled)
   - **Install Command**: `npm install` (auto-filled)

4. **Add Environment Variables**:
   
   Click "Environment Variables" and add:
   ```
   VITE_API_BASE_URL=https://gp-connect-backend.onrender.com/api
   VITE_SOCKET_URL=https://gp-connect-backend.onrender.com
   VITE_CHAT_SECRET=<same-as-backend-CHAT_SECRET>
   ```

   Make sure to add these for:
   - ✅ Production
   - ✅ Preview
   - ✅ Development

5. **Deploy**:
   - Click "Deploy"
   - Vercel will build and deploy (3-5 minutes)
   - Wait for deployment to complete

6. **Note Your Frontend URL**:
   - Once deployed, you'll get URLs like:
     - Production: `https://gp-connect.vercel.app`
     - Or custom domain if you add one

---

## 🔄 PART 3: Update CORS Configuration

### Step 1: Update Backend CORS

1. **Go to Render Dashboard** → Your Backend Service → "Environment"

2. **Update CORS_ORIGIN**:
   ```
   CORS_ORIGIN=https://gp-connect.vercel.app,https://*.vercel.app
   ```
   - Replace with your actual Vercel URL
   - Include both production and preview URLs

3. **Save Changes** → Backend will automatically redeploy

### Step 2: Verify CORS Settings

Your backend `server.js` already handles CORS properly with environment variables ✓

---

## 🧪 PART 4: Testing Your Deployment

### Test Checklist:

1. ✅ **Backend Health Check**:
   - Visit: `https://your-backend.onrender.com/api/health`
   - Should return 200 OK

2. ✅ **Frontend Loading**:
   - Visit: `https://your-frontend.vercel.app`
   - Should load without errors

3. ✅ **User Registration**:
   - Try creating a new account
   - Check if email is received
   - Verify user is created in MongoDB Atlas

4. ✅ **User Login**:
   - Login with created account
   - Verify JWT token is stored
   - Check if redirected to dashboard

5. ✅ **Socket.io Connection**:
   - Open browser console
   - Look for "User connected" or Socket.io logs
   - Test real-time chat functionality

6. ✅ **Image Uploads**:
   - Try uploading profile picture
   - Verify image appears in Cloudinary dashboard
   - Check if image displays correctly

7. ✅ **API Calls**:
   - Check Network tab in DevTools
   - Verify all API calls go to Render backend URL
   - Check for CORS errors

---

## 🛠️ Common Issues & Solutions

### Issue 1: CORS Errors

**Symptom**: "Access to XMLHttpRequest has been blocked by CORS policy"

**Solution**:
1. Verify CORS_ORIGIN in Render environment variables
2. Include your exact Vercel URL (no trailing slash)
3. Clear browser cache
4. Redeploy backend on Render

### Issue 2: Socket.io Connection Failed

**Symptom**: "WebSocket connection failed" or Socket.io not connecting

**Solution**:
1. Verify VITE_SOCKET_URL in Vercel environment variables
2. Check if Render backend is running (visit health endpoint)
3. Ensure JWT token is being sent in socket auth
4. Check Render logs for authentication errors

### Issue 3: Environment Variables Not Working

**Symptom**: API calls going to localhost or wrong URL

**Solution**:
1. Verify all VITE_ prefixed variables in Vercel
2. Redeploy frontend on Vercel
3. Clear browser cache and hard reload (Ctrl+Shift+R)
4. Check console for actual API URL being used

### Issue 4: Database Connection Error

**Symptom**: "MongoNetworkError" or connection timeout

**Solution**:
1. Verify MongoDB Atlas connection string is correct
2. Check IP whitelist includes 0.0.0.0/0
3. Verify database user has correct permissions
4. Check Render logs for detailed error

### Issue 5: Images Not Loading

**Symptom**: Broken image icons or 404 errors

**Solution**:
1. Verify Cloudinary credentials in Render
2. Check if images exist in Cloudinary dashboard
3. Verify image URLs are using Cloudinary CDN
4. Check CORS configuration in Cloudinary

### Issue 6: Render Free Tier Sleep

**Symptom**: First request takes 30-60 seconds

**Solution**:
- Render free tier spins down after 15 minutes of inactivity
- First request wakes up the service (slow)
- Upgrade to paid plan for always-on service
- Or use a service like UptimeRobot to ping every 10 minutes

### Issue 7: Build Fails on Vercel

**Symptom**: Deployment fails during build

**Solution**:
1. Check build logs on Vercel
2. Verify all dependencies are in package.json
3. Run `npm run build` locally to test
4. Check Node.js version compatibility
5. Clear Vercel build cache and redeploy

---

## 📊 Monitoring & Maintenance

### Render Monitoring:

1. **Logs**: Render Dashboard → Your Service → Logs
   - Real-time logs
   - Error tracking
   - Request monitoring

2. **Metrics**: Check CPU, Memory, Response time

3. **Alerts**: Set up email alerts for downtime

### Vercel Monitoring:

1. **Deployments**: Track all deployments
2. **Analytics**: View visitor data (upgrade for more)
3. **Logs**: Runtime and build logs

### MongoDB Atlas Monitoring:

1. **Metrics**: Monitor connections, operations, storage
2. **Alerts**: Set up alerts for high usage
3. **Backup**: Configure automated backups

---

## 🔒 Security Best Practices

1. ✅ **Environment Variables**:
   - Never commit .env files
   - Use strong, random secrets
   - Rotate secrets periodically

2. ✅ **CORS**:
   - Only allow your frontend domain
   - Don't use wildcards (*) in production

3. ✅ **Database**:
   - Use strong passwords
   - Enable MongoDB Atlas encryption
   - Regular backups

4. ✅ **Rate Limiting**:
   - Already implemented in your backend ✓
   - Monitor for abuse

5. ✅ **HTTPS**:
   - Both Render and Vercel provide HTTPS by default ✓

---

## 🚀 Performance Optimization

### Backend (Render):

1. **Upgrade Plan**: Free tier has limitations
2. **Enable Redis**: For caching (if needed)
3. **Database Indexing**: Optimize MongoDB queries
4. **Compression**: Enable gzip compression

### Frontend (Vercel):

1. **Image Optimization**: Use Cloudinary transformations
2. **Code Splitting**: Already configured in vite.config.js ✓
3. **Lazy Loading**: Implement for routes
4. **CDN**: Vercel provides global CDN by default ✓

---

## 📝 Deployment Checklist

### Before Going Live:

- [ ] All environment variables set correctly
- [ ] CORS configured properly
- [ ] MongoDB Atlas accessible
- [ ] Cloudinary working
- [ ] Email service configured
- [ ] All tests passing
- [ ] Error handling tested
- [ ] Socket.io connection verified
- [ ] Image uploads working
- [ ] User authentication working
- [ ] Mobile responsive design checked
- [ ] Browser compatibility tested
- [ ] Security headers configured
- [ ] Rate limiting tested
- [ ] Backup strategy in place

---

## 🔄 Continuous Deployment

### Auto-Deploy on Git Push:

Both Render and Vercel support automatic deployments:

1. **Render**: Auto-deploys on push to main branch
2. **Vercel**: Auto-deploys on push to main branch

### Preview Deployments (Vercel):

- Every PR gets a preview URL
- Test changes before merging
- Automatic cleanup after merge

---

## 📞 Getting Help

### Render Support:
- Docs: https://render.com/docs
- Community: https://community.render.com
- Status: https://status.render.com

### Vercel Support:
- Docs: https://vercel.com/docs
- Community: https://github.com/vercel/vercel/discussions
- Status: https://www.vercel-status.com

---

## 🎉 Congratulations!

Your GP Connect application is now live! 

**Production URLs**:
- Frontend: `https://your-app.vercel.app`
- Backend: `https://your-backend.onrender.com`

Share these URLs with your users and team! 🚀

---

## 📌 Quick Reference

### Essential Commands:

```bash
# Backend (Render runs these)
npm install
npm start

# Frontend (Vercel runs these)
npm install
npm run build

# Local Development
npm run dev (both frontend and backend)
```

### Environment Variable Template:

**Backend (.env on Render)**:
```
NODE_ENV=production
PORT=5000
MONGO_URI=mongodb+srv://...
JWT_SECRET=...
CHAT_SECRET=...
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=...
EMAIL_PASS=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CORS_ORIGIN=https://your-frontend.vercel.app
```

**Frontend (.env on Vercel)**:
```
VITE_API_BASE_URL=https://your-backend.onrender.com/api
VITE_SOCKET_URL=https://your-backend.onrender.com
VITE_CHAT_SECRET=...
```

---

**Last Updated**: October 25, 2025
**Version**: 1.0.0
