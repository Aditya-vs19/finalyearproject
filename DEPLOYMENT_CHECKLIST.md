# GP Connect - Deployment Checklist

Use this checklist to track your deployment progress.

## 📋 Pre-Deployment Setup

### 1. MongoDB Atlas
- [ ] Created MongoDB Atlas account
- [ ] Created cluster (Free M0 tier is fine for testing)
- [ ] Created database user with username/password
- [ ] Whitelisted IP address (0.0.0.0/0 for all IPs)
- [ ] Copied connection string
- [ ] Replaced `<password>` in connection string
- [ ] Added database name to connection string: `.../gp-connect?retryWrites=true&w=majority`

**Connection String Format:**
```
mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/gp-connect?retryWrites=true&w=majority
```

---

### 2. Cloudinary Setup
- [ ] Created Cloudinary account (free tier)
- [ ] Noted Cloud Name: `_______________`
- [ ] Noted API Key: `_______________`
- [ ] Noted API Secret: `_______________`

---

### 3. Email Configuration (Gmail)
- [ ] Using Gmail: `_______________@gmail.com`
- [ ] Enabled 2-Step Verification
- [ ] Generated App Password (16-character code)
- [ ] Noted App Password: `_______________`

**How to get Gmail App Password:**
1. Google Account → Security → 2-Step Verification → App passwords
2. Select "Mail" and your device
3. Copy the 16-character password

---

### 4. Security Secrets

Generate strong random strings (32+ characters):

- [ ] Generated JWT_SECRET: `_______________`
- [ ] Generated CHAT_SECRET: `_______________`

**Generate using Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🚀 Backend Deployment (Render)

### 5. Prepare Code
- [ ] All changes committed to Git
- [ ] Code pushed to GitHub (main branch)
- [ ] `.gitignore` includes `.env` and `node_modules/`

### 6. Create Render Account
- [ ] Signed up at https://render.com
- [ ] Connected GitHub account
- [ ] Verified email

### 7. Create Web Service
- [ ] Created new Web Service on Render
- [ ] Connected repository: `Aditya-vs19/finalyearproject`
- [ ] Set Root Directory: `gp-connect-backend`
- [ ] Set Build Command: `npm install`
- [ ] Set Start Command: `npm start`
- [ ] Selected Free instance type

### 8. Configure Environment Variables on Render

Add these in Render Dashboard → Environment:

- [ ] `NODE_ENV` = `production`
- [ ] `PORT` = `5000`
- [ ] `MONGO_URI` = `<MongoDB connection string from step 1>`
- [ ] `JWT_SECRET` = `<Generated secret from step 4>`
- [ ] `CHAT_SECRET` = `<Generated secret from step 4>`
- [ ] `EMAIL_HOST` = `smtp.gmail.com`
- [ ] `EMAIL_PORT` = `587`
- [ ] `EMAIL_USER` = `<Gmail address from step 3>`
- [ ] `EMAIL_PASS` = `<App password from step 3>`
- [ ] `CLOUDINARY_CLOUD_NAME` = `<From step 2>`
- [ ] `CLOUDINARY_API_KEY` = `<From step 2>`
- [ ] `CLOUDINARY_API_SECRET` = `<From step 2>`
- [ ] `CORS_ORIGIN` = `http://localhost:5173` (will update later)

### 9. Deploy Backend
- [ ] Clicked "Create Web Service"
- [ ] Waited for build to complete (5-10 minutes)
- [ ] Deployment successful
- [ ] Noted backend URL: `https://_______________. onrender.com`

### 10. Test Backend
- [ ] Visited: `https://your-backend.onrender.com/api/health`
- [ ] Received successful response
- [ ] No errors in Render logs

---

## 🎨 Frontend Deployment (Vercel)

### 11. Update Frontend Environment

Created `.env.production` in `gp-connect/` folder:

- [ ] `VITE_API_BASE_URL` = `https://your-backend.onrender.com/api`
- [ ] `VITE_SOCKET_URL` = `https://your-backend.onrender.com`
- [ ] `VITE_CHAT_SECRET` = `<Same as backend CHAT_SECRET>`

### 12. Test Build Locally
- [ ] Ran `npm run build` in `gp-connect/` folder
- [ ] Build completed without errors
- [ ] Ran `npm run preview` to test production build
- [ ] Tested locally - everything works

### 13. Commit Changes
- [ ] Committed `.env.production` changes
- [ ] Pushed to GitHub

### 14. Create Vercel Account
- [ ] Signed up at https://vercel.com
- [ ] Connected GitHub account
- [ ] Verified email

### 15. Import Project
- [ ] Clicked "Add New..." → "Project"
- [ ] Selected repository: `Aditya-vs19/finalyearproject`
- [ ] Clicked "Import"

### 16. Configure Vercel Project
- [ ] Set Root Directory: `gp-connect`
- [ ] Framework Preset: Vite (auto-detected)
- [ ] Build Command: `npm run build` (auto-filled)
- [ ] Output Directory: `dist` (auto-filled)

### 17. Add Environment Variables on Vercel

Added these in Vercel → Environment Variables:

- [ ] `VITE_API_BASE_URL` = `https://your-backend.onrender.com/api`
- [ ] `VITE_SOCKET_URL` = `https://your-backend.onrender.com`
- [ ] `VITE_CHAT_SECRET` = `<Same as backend>`

**Make sure to add for all environments:**
- [ ] Production
- [ ] Preview
- [ ] Development

### 18. Deploy Frontend
- [ ] Clicked "Deploy"
- [ ] Waited for build (3-5 minutes)
- [ ] Deployment successful
- [ ] Noted frontend URL: `https://_______________. vercel.app`

---

## 🔄 Final Configuration

### 19. Update Backend CORS
- [ ] Went to Render Dashboard → Environment
- [ ] Updated `CORS_ORIGIN` = `https://your-frontend.vercel.app,https://*.vercel.app`
- [ ] Saved changes
- [ ] Backend redeployed automatically

---

## ✅ Testing & Verification

### 20. Backend Tests
- [ ] Health check works: `https://your-backend.onrender.com/api/health`
- [ ] No errors in Render logs
- [ ] Database connected (check logs for "MongoDB connected")

### 21. Frontend Tests
- [ ] Website loads: `https://your-frontend.vercel.app`
- [ ] No console errors in browser DevTools
- [ ] API calls going to correct backend URL (check Network tab)

### 22. Feature Tests
- [ ] User registration works
- [ ] Email received after registration
- [ ] User login works
- [ ] JWT token stored in localStorage
- [ ] Profile page loads
- [ ] Can upload profile picture
- [ ] Image appears from Cloudinary
- [ ] Can create post
- [ ] Can view posts feed
- [ ] Can join communities
- [ ] Socket.io connects (check console)
- [ ] Real-time chat works
- [ ] Notifications work

### 23. Cross-Browser Testing
- [ ] Tested on Chrome
- [ ] Tested on Firefox
- [ ] Tested on Safari (if available)
- [ ] Tested on mobile browser

### 24. Performance Checks
- [ ] First load time acceptable
- [ ] Images load properly
- [ ] No CORS errors
- [ ] Socket connection stable
- [ ] API responses fast enough

---

## 📊 Monitoring Setup

### 25. Set Up Monitoring
- [ ] Enabled Render email alerts
- [ ] Bookmarked Render logs page
- [ ] Bookmarked Vercel deployments page
- [ ] Bookmarked MongoDB Atlas metrics

---

## 🎉 Launch!

### 26. Go Live
- [ ] All tests passing
- [ ] No critical errors
- [ ] Performance acceptable
- [ ] Shared URLs with team
- [ ] Documented any known issues

---

## 📝 Important URLs (Fill These In)

**Backend (Render):**
- Dashboard: https://dashboard.render.com
- App URL: `https://_______________. onrender.com`
- Logs: https://dashboard.render.com/web/YOUR-SERVICE-ID

**Frontend (Vercel):**
- Dashboard: https://vercel.com/dashboard
- App URL: `https://_______________. vercel.app`
- Deployments: https://vercel.com/YOUR-USERNAME/gp-connect

**Database:**
- MongoDB Atlas: https://cloud.mongodb.com
- Cluster: `_______________`

**Services:**
- Cloudinary: https://cloudinary.com/console
- GitHub Repo: https://github.com/Aditya-vs19/finalyearproject

---

## 🆘 Troubleshooting

If you encounter issues, check:

1. [ ] Render logs for backend errors
2. [ ] Vercel logs for build errors
3. [ ] Browser console for frontend errors
4. [ ] Network tab for API call failures
5. [ ] MongoDB Atlas for connection issues
6. [ ] Environment variables are correct
7. [ ] CORS settings match frontend URL
8. [ ] Both backend and frontend are deployed

**Common Issues:**
- First load slow on Render free tier → Normal (server spins down)
- CORS errors → Check CORS_ORIGIN includes your Vercel URL
- Socket.io won't connect → Verify VITE_SOCKET_URL and JWT token
- Images not loading → Check Cloudinary credentials

---

**Deployment Date:** `_______________`
**Deployed By:** `_______________`
**Notes:**
```
_______________________________________________
_______________________________________________
_______________________________________________
```

---

## 🔄 Next Steps After Deployment

- [ ] Set up custom domain (optional)
- [ ] Configure email notifications
- [ ] Set up analytics (Vercel Analytics)
- [ ] Configure backups (MongoDB Atlas)
- [ ] Monitor usage and performance
- [ ] Plan for scaling (upgrade from free tier)
- [ ] Set up error tracking (e.g., Sentry)
- [ ] Create user documentation
- [ ] Share with beta testers

---

✅ **Deployment Complete!** Your app is live! 🚀
