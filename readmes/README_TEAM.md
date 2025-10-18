# 🚀 GP-Connect - Team Setup

Welcome to GP-Connect! This guide will help you get the project running on your machine in just a few minutes.

## ⚡ Quick Start (Automated)

### Windows Users:
```bash
# Double-click setup.bat or run in Command Prompt:
setup.bat
```

### Mac/Linux Users:
```bash
# Make script executable and run:
chmod +x setup.sh
./setup.sh
```

## 📋 Manual Setup (If Automated Fails)

### Prerequisites:
- **Node.js** v16+ ([Download](https://nodejs.org/))
- **MongoDB** ([Download](https://www.mongodb.com/try/download/community))
- **Git** ([Download](https://git-scm.com/))

### Step-by-Step:

1. **Clone & Navigate:**
   ```bash
   git clone <repository-url>
   cd Capstone
   ```

2. **Backend Setup:**
   ```bash
   cd gp-connect-backend
   npm install
   # Create .env file with database connection
   ```

3. **Frontend Setup:**
   ```bash
   cd ../gp-connect
   npm install
   ```

4. **Start Services:**
   ```bash
   # Terminal 1 - Backend:
   cd gp-connect-backend && npm start
   
   # Terminal 2 - Frontend:
   cd gp-connect && npm run dev
   ```

5. **Access Application:**
   - Open browser: `http://localhost:3000`
   - Register account and start using!

## 🎯 What You Can Do:

- ✅ **Register & Login** - Create your account
- ✅ **Create Posts** - Share text and images
- ✅ **Search Users** - Find other students by name/enrollment
- ✅ **Follow System** - Follow/unfollow other users
- ✅ **Profile Management** - Edit profile, upload pictures
- ✅ **Real-time Feed** - See posts from people you follow

## 🆘 Need Help?

1. **Check the detailed guide**: `TEAM_DEPLOYMENT_GUIDE.md`
2. **Common issues**: See troubleshooting section
3. **Verify setup**: Use the testing checklist
4. **Check logs**: Look at console output for errors

## 📱 Features Overview:

- **Home Feed**: Posts from you and people you follow
- **Search**: Find users by name or enrollment number
- **Profile**: View and edit your profile
- **Create Post**: Share content with images
- **Communities**: Browse different communities
- **Notifications**: Stay updated with activity

---

**🎉 Ready to go! Run the setup script and start exploring GP-Connect!**
