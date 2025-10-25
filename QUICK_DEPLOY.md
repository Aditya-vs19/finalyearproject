# 🚀 Quick Deployment Commands

This is a quick reference for deploying GP Connect to Render and Vercel.

---

## 📦 Pre-Deployment: Test Locally

### Backend (Terminal 1)
```bash
cd gp-connect-backend
npm install
npm start
```
Should start on http://localhost:5000

### Frontend (Terminal 2)
```bash
cd gp-connect
npm install
npm run dev
```
Should start on http://localhost:5173

### Test Production Build
```bash
cd gp-connect
npm run build
npm run preview
```

---

## 🔑 Generate Secrets

```bash
# Generate JWT_SECRET (run twice for both secrets)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or use PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

---

## 📝 Environment Variables Quick Copy

### Backend (Render) - Copy this template:

```env
NODE_ENV=production
PORT=5000
MONGO_URI=mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/gp-connect?retryWrites=true&w=majority
JWT_SECRET=your-generated-secret-here
CHAT_SECRET=your-generated-secret-here
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
CORS_ORIGIN=https://your-app.vercel.app
```

### Frontend (Vercel) - Copy this template:

```env
VITE_API_BASE_URL=https://your-backend.onrender.com/api
VITE_SOCKET_URL=https://your-backend.onrender.com
VITE_CHAT_SECRET=same-as-backend-chat-secret
```

---

## 🔧 Git Commands

```bash
# Make sure you're in the root directory
cd "c:\Users\Aditya Surwase\Downloads\CapstoneB"

# Check current status
git status

# Add all changes
git add .

# Commit with message
git commit -m "Prepare for deployment"

# Push to GitHub
git push origin main

# If you need to pull first
git pull origin main

# View current branch
git branch
```

---

## 📊 Testing Endpoints

### Test Backend Health
```bash
# After deployment, test with curl or browser
https://your-backend-name.onrender.com/api/health
```

Should return:
```json
{
  "status": "OK",
  "timestamp": "2025-10-25T..."
}
```

### Test Frontend
```bash
# Open in browser
https://your-app-name.vercel.app
```

---

## 🔍 Debug Commands

### Check Render Logs
1. Go to: https://dashboard.render.com
2. Click your service
3. Click "Logs" tab
4. Look for errors

### Check Vercel Logs
1. Go to: https://vercel.com/dashboard
2. Click your project
3. Click latest deployment
4. Click "Runtime Logs"

### Check Local Environment
```bash
# Check Node version
node --version

# Check npm version
npm --version

# Check if MongoDB URI is valid (from backend folder)
node -e "console.log(process.env.MONGO_URI)"
```

---

## 🔄 Redeploy

### Redeploy Backend (Render)
- Render auto-deploys on git push to main
- Or: Dashboard → Your Service → Manual Deploy

### Redeploy Frontend (Vercel)
- Vercel auto-deploys on git push to main
- Or: Dashboard → Your Project → Redeploy

### Force Redeploy
```bash
# Make a small change and push
git commit --allow-empty -m "Trigger redeploy"
git push origin main
```

---

## 🗂️ Project Structure

```
CapstoneB/
├── gp-connect/                 # Frontend (Deploy to Vercel)
│   ├── src/
│   ├── package.json
│   ├── vite.config.js
│   └── .env.production        # Production env vars
│
├── gp-connect-backend/        # Backend (Deploy to Render)
│   ├── server.js
│   ├── package.json
│   ├── Procfile               # Render config
│   └── .env.example           # Example env vars
│
├── DEPLOYMENT_GUIDE.md        # Full deployment guide
├── DEPLOYMENT_CHECKLIST.md    # Step-by-step checklist
└── QUICK_DEPLOY.md            # This file
```

---

## 🚨 Common Errors & Quick Fixes

### Error: "CORS policy error"
**Fix:** Update CORS_ORIGIN in Render to include your Vercel URL

### Error: "Cannot connect to database"
**Fix:** Check MONGO_URI and MongoDB Atlas IP whitelist

### Error: "Socket.io connection failed"
**Fix:** Verify VITE_SOCKET_URL matches your Render backend URL

### Error: "Build failed on Vercel"
**Fix:** Run `npm run build` locally, fix errors, push again

### Error: "Images not loading"
**Fix:** Check Cloudinary credentials in Render environment variables

### Error: "Backend is slow (first request)"
**Fix:** Normal for Render free tier - server spins down after 15 min inactivity

---

## 📞 Quick Links

| Service | URL |
|---------|-----|
| Render Dashboard | https://dashboard.render.com |
| Vercel Dashboard | https://vercel.com/dashboard |
| MongoDB Atlas | https://cloud.mongodb.com |
| Cloudinary Console | https://cloudinary.com/console |
| GitHub Repo | https://github.com/Aditya-vs19/finalyearproject |

---

## ✅ Pre-Flight Checklist

Before deploying:
- [ ] Code pushed to GitHub
- [ ] MongoDB Atlas setup complete
- [ ] Cloudinary account ready
- [ ] Gmail app password generated
- [ ] Secrets generated
- [ ] `.env.production` updated
- [ ] Local build test successful

---

## 🎯 Deployment Steps Summary

1. **Setup Services** → MongoDB Atlas, Cloudinary, Gmail
2. **Push to GitHub** → `git push origin main`
3. **Deploy Backend** → Render.com (link GitHub, set env vars)
4. **Deploy Frontend** → Vercel.com (link GitHub, set env vars)
5. **Update CORS** → Add Vercel URL to Render CORS_ORIGIN
6. **Test Everything** → Registration, login, chat, images

**Total Time:** ~30-45 minutes

---

## 💡 Pro Tips

1. **Use Free Tiers First** - Test everything before upgrading
2. **Save Your URLs** - Bookmark all dashboards
3. **Monitor Logs** - Check regularly for errors
4. **Auto-Deploy** - Let Render and Vercel auto-deploy on push
5. **Environment Vars** - Double-check they match between frontend/backend
6. **CHAT_SECRET** - Must be identical in both frontend and backend
7. **Keep Secrets Safe** - Never commit .env files

---

**Need help?** Check the full `DEPLOYMENT_GUIDE.md` for detailed instructions!
