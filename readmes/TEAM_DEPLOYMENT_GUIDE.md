# 🚀 GP-Connect Team Deployment Guide

## 📋 **Prerequisites**

Before setting up the project, ensure your teammate has the following installed:

### **Required Software:**
- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **MongoDB** (v4.4 or higher) - [Download here](https://www.mongodb.com/try/download/community)
- **Git** - [Download here](https://git-scm.com/)

### **Verify Installation:**
```bash
node --version    # Should show v16+
npm --version     # Should show v8+
mongod --version  # Should show MongoDB version
git --version     # Should show Git version
```

## 🛠️ **Setup Instructions**

### **Step 1: Clone the Repository**
```bash
# Clone the project
git clone <your-repository-url>
cd Capstone

# Verify project structure
ls -la
# Should show: gp-connect/ and gp-connect-backend/
```

### **Step 2: Backend Setup**

```bash
# Navigate to backend directory
cd gp-connect-backend

# Install dependencies
npm install

# Create environment file
# Create .env file in gp-connect-backend/ directory
```

**Create `.env` file in `gp-connect-backend/` directory:**
```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://localhost:27017/gp-connect
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random
```

**Important:** Replace `your_super_secret_jwt_key_here_make_it_long_and_random` with a secure random string.

### **Step 3: Database Setup**

```bash
# Start MongoDB service
# On Windows: Start MongoDB service from Services
# On Mac: brew services start mongodb-community
# On Linux: sudo systemctl start mongod

# Verify MongoDB is running
mongosh --eval "db.runCommand('ping')"
# Should return: { ok: 1 }
```

### **Step 4: Frontend Setup**

```bash
# Navigate to frontend directory
cd ../gp-connect

# Install dependencies
npm install

# Verify installation
npm list --depth=0
```

### **Step 5: Start the Application**

**Terminal 1 - Backend:**
```bash
cd gp-connect-backend
npm start
# Should show: Server running on port 5000
# Should show: MongoDB Connected: localhost
```

**Terminal 2 - Frontend:**
```bash
cd gp-connect
npm run dev
# Should show: Local: http://localhost:3000
```

### **Step 6: Set Up Images (Important!)**

```bash
# Run the image setup script to create uploads directory
node setup-images.js
```

This script will:
- Create the `uploads` directory in the backend
- Add sample placeholder images
- Set up proper image handling

### **Step 7: Verify Setup**

1. **Open browser** and go to `http://localhost:3000`
2. **Register a new account** or login
3. **Test key features:**
   - ✅ Create a post with image
   - ✅ Search for users
   - ✅ Follow/unfollow users
   - ✅ View profiles
   - ✅ Upload profile picture
   - ✅ Verify images display correctly

## 🔧 **Configuration Details**

### **Backend Configuration (`gp-connect-backend/.env`):**
```env
NODE_ENV=development          # Environment mode
PORT=5000                    # Backend server port
MONGO_URI=mongodb://localhost:27017/gp-connect  # Database connection
JWT_SECRET=your_jwt_secret_here  # JWT signing secret
```

### **Frontend Configuration:**
- **API Base URL**: `http://localhost:5000/api` (configured in `src/services/api.js`)
- **Development Server**: `http://localhost:3000`
- **Build Output**: `dist/` directory

### **Database Configuration:**
- **Database Name**: `gp-connect`
- **Collections**: `users`, `posts`
- **Connection**: `mongodb://localhost:27017/gp-connect`

## 🚨 **Common Issues & Solutions**

### **Issue 1: MongoDB Connection Failed**
```bash
# Error: MongoDB connection failed
# Solution:
mongod --version  # Check if MongoDB is installed
# Start MongoDB service:
# Windows: Services → MongoDB → Start
# Mac: brew services start mongodb-community
# Linux: sudo systemctl start mongod
```

### **Issue 2: Port Already in Use**
```bash
# Error: Port 5000 already in use
# Solution: Kill process using port 5000
# Windows:
netstat -ano | findstr :5000
taskkill /PID <PID_NUMBER> /F

# Mac/Linux:
lsof -ti:5000 | xargs kill -9
```

### **Issue 3: Node Modules Issues**
```bash
# Error: Module not found
# Solution: Clean install
rm -rf node_modules package-lock.json
npm install
```

### **Issue 4: JWT Secret Missing**
```bash
# Error: JWT secret not defined
# Solution: Add JWT_SECRET to .env file
echo "JWT_SECRET=your_secure_secret_here" >> .env
```

### **Issue 5: CORS Errors**
```bash
# Error: CORS policy blocked
# Solution: Check backend CORS configuration
# Verify API base URL in frontend matches backend
```

### **Issue 6: Images Not Showing**
```bash
# Error: Post images or profile pictures not displaying
# Solution: 
# 1. Run the image setup script: node setup-images.js
# 2. Check if uploads directory exists: gp-connect-backend/uploads/
# 3. Verify backend serves static files from /uploads route
# 4. Create some posts to generate real images
# 5. Check browser console for 404 errors on image requests
```

## 📱 **Testing Checklist**

### **Backend Tests:**
- [ ] Server starts without errors
- [ ] MongoDB connection successful
- [ ] API endpoints respond correctly
- [ ] Authentication works
- [ ] File uploads work

### **Frontend Tests:**
- [ ] App loads without errors
- [ ] Login/Register works
- [ ] Navigation between tabs works
- [ ] Search functionality works
- [ ] Follow/unfollow works
- [ ] Profile editing works
- [ ] Post creation works
- [ ] Images display correctly (profile pics and post images)
- [ ] Image fallbacks work when images are missing

### **Integration Tests:**
- [ ] User registration creates account
- [ ] Login persists across page refresh
- [ ] Search returns real users
- [ ] Follow/unfollow updates database
- [ ] Posts appear in feed
- [ ] Profile pictures upload correctly

## 🌐 **Production Deployment (Optional)**

### **Backend Deployment:**
```bash
# Build for production
cd gp-connect-backend
npm run build  # If build script exists

# Set production environment
export NODE_ENV=production
export PORT=5000
export MONGO_URI=mongodb://your-production-db-url
export JWT_SECRET=your_production_secret
```

### **Frontend Deployment:**
```bash
# Build for production
cd gp-connect
npm run build

# Serve static files
# Files will be in dist/ directory
```

## 📞 **Support & Troubleshooting**

### **If Setup Fails:**
1. **Check prerequisites** - Ensure all software is installed
2. **Verify ports** - Make sure ports 3000 and 5000 are free
3. **Check MongoDB** - Ensure MongoDB service is running
4. **Review logs** - Check console output for specific errors
5. **Clean install** - Delete node_modules and reinstall

### **Getting Help:**
- Check the console logs for error messages
- Verify all environment variables are set
- Ensure MongoDB is running and accessible
- Check network connectivity
- Review the original setup documentation

## 🎯 **Quick Start Commands**

```bash
# Complete setup in one go:
git clone <repository-url>
cd Capstone/gp-connect-backend && npm install
cd ../gp-connect && npm install

# Start services:
# Terminal 1: cd gp-connect-backend && npm start
# Terminal 2: cd gp-connect && npm run dev

# Access: http://localhost:3000
```

## ✅ **Success Indicators**

You'll know the setup is successful when:
- ✅ Both servers start without errors
- ✅ MongoDB connection is established
- ✅ Frontend loads at `http://localhost:3000`
- ✅ You can register/login successfully
- ✅ All features work (search, follow, posts, profiles)
- ✅ No console errors in browser or terminal

---

**🎉 That's it! Your teammate should now have a fully functional GP-Connect application running locally.**
