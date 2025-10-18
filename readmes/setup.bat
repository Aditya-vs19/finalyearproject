@echo off
echo ========================================
echo    GP-Connect Setup Script (Windows)
echo ========================================
echo.

echo [1/6] Checking prerequisites...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed. Please install Node.js v16+ from https://nodejs.org/
    pause
    exit /b 1
)
echo ✅ Node.js is installed

npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ npm is not installed
    pause
    exit /b 1
)
echo ✅ npm is installed

mongod --version >nul 2>&1
if errorlevel 1 (
    echo ❌ MongoDB is not installed. Please install MongoDB from https://www.mongodb.com/try/download/community
    pause
    exit /b 1
)
echo ✅ MongoDB is installed

echo.
echo [2/6] Installing backend dependencies...
cd gp-connect-backend
if not exist node_modules (
    npm install
    if errorlevel 1 (
        echo ❌ Backend dependency installation failed
        pause
        exit /b 1
    )
    echo ✅ Backend dependencies installed
) else (
    echo ✅ Backend dependencies already installed
)

echo.
echo [3/6] Setting up backend environment...
if not exist .env (
    echo Creating .env file...
    echo NODE_ENV=development > .env
    echo PORT=5000 >> .env
    echo MONGO_URI=mongodb://localhost:27017/gp-connect >> .env
    echo JWT_SECRET=gp_connect_development_secret_key_2024 >> .env
    echo ✅ .env file created
) else (
    echo ✅ .env file already exists
)

echo.
echo [4/6] Installing frontend dependencies...
cd ..\gp-connect
if not exist node_modules (
    npm install
    if errorlevel 1 (
        echo ❌ Frontend dependency installation failed
        pause
        exit /b 1
    )
    echo ✅ Frontend dependencies installed
) else (
    echo ✅ Frontend dependencies already installed
)

echo.
echo [5/6] Starting MongoDB service...
net start MongoDB >nul 2>&1
if errorlevel 1 (
    echo ⚠️  MongoDB service might already be running or needs manual start
) else (
    echo ✅ MongoDB service started
)

echo.
echo [6/6] Setup complete!
echo.
echo ========================================
echo    Next Steps:
echo ========================================
echo 1. Open two command prompts/terminals:
echo    - Terminal 1: cd gp-connect-backend && npm start
echo    - Terminal 2: cd gp-connect && npm run dev
echo.
echo 2. Open browser and go to: http://localhost:3000
echo.
echo 3. Register a new account or login
echo.
echo 4. Test the features:
echo    - Create posts
echo    - Search users
echo    - Follow/unfollow
echo    - Edit profile
echo.
echo ========================================
echo    Setup Complete! 🎉
echo ========================================
pause
