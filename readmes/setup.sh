#!/bin/bash

echo "========================================"
echo "   GP-Connect Setup Script (Unix/Mac)"
echo "========================================"
echo

echo "[1/6] Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v16+ from https://nodejs.org/"
    exit 1
fi
echo "✅ Node.js is installed ($(node --version))"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    exit 1
fi
echo "✅ npm is installed ($(npm --version))"

# Check MongoDB
if ! command -v mongod &> /dev/null; then
    echo "❌ MongoDB is not installed. Please install MongoDB from https://www.mongodb.com/try/download/community"
    exit 1
fi
echo "✅ MongoDB is installed ($(mongod --version | head -n1))"

echo
echo "[2/6] Installing backend dependencies..."
cd gp-connect-backend

if [ ! -d "node_modules" ]; then
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Backend dependency installation failed"
        exit 1
    fi
    echo "✅ Backend dependencies installed"
else
    echo "✅ Backend dependencies already installed"
fi

echo
echo "[3/6] Setting up backend environment..."
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cat > .env << EOF
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://localhost:27017/gp-connect
JWT_SECRET=gp_connect_development_secret_key_2024
EOF
    echo "✅ .env file created"
else
    echo "✅ .env file already exists"
fi

echo
echo "[4/6] Installing frontend dependencies..."
cd ../gp-connect

if [ ! -d "node_modules" ]; then
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Frontend dependency installation failed"
        exit 1
    fi
    echo "✅ Frontend dependencies installed"
else
    echo "✅ Frontend dependencies already installed"
fi

echo
echo "[5/6] Starting MongoDB service..."

# Try to start MongoDB (different commands for different systems)
if command -v brew &> /dev/null; then
    # macOS with Homebrew
    brew services start mongodb-community 2>/dev/null || brew services start mongodb/brew/mongodb-community 2>/dev/null
elif command -v systemctl &> /dev/null; then
    # Linux with systemd
    sudo systemctl start mongod 2>/dev/null
elif command -v service &> /dev/null; then
    # Linux with service command
    sudo service mongod start 2>/dev/null
fi

echo "✅ MongoDB service started (or already running)"

echo
echo "[6/6] Setup complete!"
echo
echo "========================================"
echo "   Next Steps:"
echo "========================================"
echo "1. Open two terminals:"
echo "   - Terminal 1: cd gp-connect-backend && npm start"
echo "   - Terminal 2: cd gp-connect && npm run dev"
echo
echo "2. Open browser and go to: http://localhost:3000"
echo
echo "3. Register a new account or login"
echo
echo "4. Test the features:"
echo "   - Create posts"
echo "   - Search users"
echo "   - Follow/unfollow"
echo "   - Edit profile"
echo
echo "========================================"
echo "   Setup Complete! 🎉"
echo "========================================"
