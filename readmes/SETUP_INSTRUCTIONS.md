# GP-Connect MERN App Setup Instructions

## Issues Fixed

✅ **Black Screen After Login**: Fixed authentication token management and loading states  
✅ **Search Functionality**: Implemented working search with real backend integration  
✅ **Home Tab Posts**: Fixed posts loading with proper error handling  
✅ **Follow/Unfollow System**: Complete follow system with real-time updates  
✅ **Post Creation**: Posts now save to MongoDB and appear in feeds  
✅ **Error Handling**: Added comprehensive error handling and loading states  

## Quick Setup

### 1. Backend Setup

```bash
cd gp-connect-backend
npm install
```

Create a `.env` file in `gp-connect-backend/` with:
```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://localhost:27017/gp-connect
JWT_SECRET=your_jwt_secret_key_here_make_it_long_and_secure
```

### 2. Frontend Setup

```bash
cd gp-connect
npm install
```

### 3. Database Setup

Make sure MongoDB is running:
```bash
# If using MongoDB locally
mongod

# Or if using MongoDB Atlas, update MONGO_URI in .env
```

### 4. Start the Application

**Terminal 1 (Backend):**
```bash
cd gp-connect-backend
npm start
```

**Terminal 2 (Frontend):**
```bash
cd gp-connect
npm run dev
```

## Features Working

### ✅ Authentication
- Login with email/password
- JWT token storage and verification
- Auto-login on page refresh
- Proper logout functionality

### ✅ Home Feed
- Displays posts from all users
- Loading states and error handling
- Click usernames to view profiles
- Real-time post updates after creation

### ✅ Search Functionality
- Search users by name or enrollment
- Real-time follow/unfollow buttons
- Click users to view their profiles
- Proper error handling and loading states

### ✅ Profile Management
- View your own profile with stats
- View other users' profiles
- Follow/unfollow functionality
- Real-time follower/following counts
- Edit your own profile

### ✅ Post Creation
- Create posts with text and images
- Posts save to MongoDB
- Immediate feed refresh after posting
- Image upload with validation

### ✅ Follow System
- Follow/unfollow users
- Real-time count updates
- Follow status tracking
- Proper API integration

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login user
- `POST /api/auth/register` - Register user
- `POST /api/auth/verify` - Verify OTP

### Profile
- `GET /api/profile/me` - Get current user profile
- `GET /api/profile/:id` - Get user profile by ID
- `PUT /api/profile/:id` - Update profile
- `GET /api/profile/search?query=...` - Search users
- `POST /api/profile/:id/follow` - Follow user
- `POST /api/profile/:id/unfollow` - Unfollow user

### Posts
- `GET /api/posts` - Get all posts
- `POST /api/posts` - Create post
- `GET /api/posts/user/:id` - Get user posts

## Troubleshooting

### Black Screen Issues
- Check browser console for errors
- Verify backend is running on port 5000
- Check MongoDB connection
- Clear localStorage and try logging in again

### Search Not Working
- Verify backend is running
- Check network tab for API errors
- Ensure user is logged in with valid token

### Posts Not Loading
- Check MongoDB connection
- Verify JWT token is valid
- Check backend logs for errors

### Follow/Unfollow Issues
- Verify user is logged in
- Check API endpoints are accessible
- Ensure proper JWT authentication

## Development Notes

- All API calls include JWT authentication
- Error handling is comprehensive with user feedback
- Loading states prevent UI blocking
- Real-time updates for better UX
- Responsive design for mobile and desktop

## Testing

1. Register a new account
2. Login and verify home feed loads
3. Create a post and verify it appears
4. Search for users and test follow/unfollow
5. View other users' profiles
6. Test logout and login again

The application should now work without black screens or missing functionality!
