import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import connectDB from './config/db.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import authRoutes from './routes/authRoutes.js';
import postRoutes from './routes/postRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import communityRoutes from './routes/communityRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import imageMonitoringRoutes from './routes/imageMonitoring.js';
import initializeCommunities from './utils/initializeCommunities.js';
import { configureChatSocket } from './socket/chatSocket.js';
import cloudinaryService from './services/cloudinaryService.js';

// Load environment variables
dotenv.config();

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174'];

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  },
});

// Get __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(express.json({ limit: '1mb' }));
app.use(cors({ 
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Debug routes (only in development)
if (process.env.NODE_ENV !== 'production') {
  const debugRoutes = (await import('./routes/debugRoutes.js')).default;
  app.use('/api', debugRoutes);
}

// Make io available to routes via middleware
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/image-monitoring', imageMonitoringRoutes);


// Socket.IO connection handling with JWT authentication
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach user ID to socket
    socket.userId = decoded.id;
    next();
  } catch (error) {
    next(new Error('Authentication error: Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id, 'User ID:', socket.userId);

  // Join user's personal room for direct notifications
  socket.join(`user_${socket.userId}`);

  // Join community room
  socket.on('joinCommunity', (data) => {
    const { communityId } = data;
    socket.join(`community_${communityId}`);
    console.log(`User ${socket.userId} joined community ${communityId}`);
  });

  // Leave community room
  socket.on('leaveCommunity', (data) => {
    const { communityId } = data;
    socket.leave(`community_${communityId}`);
    console.log(`User ${socket.userId} left community ${communityId}`);
  });



  // Handle post like updates
  socket.on('post-like', (data) => {
    const { postId, userId, liked, likesCount, likes } = data;
    // Broadcast to all connected users
    io.emit('post:likeUpdate', {
      postId,
      userId,
      liked,
      likesCount,
      likes
    });
    console.log(`Post like update broadcasted for post ${postId}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id, 'User ID:', socket.userId);
  });
});

try {
  await configureChatSocket({ io, app });
} catch (error) {
  console.error('[socket] Failed to initialize chat namespace:', error.message);
}

// Error Handling Middleware
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  
  // Initialize Cloudinary service
  try {
    cloudinaryService.configure();
    console.log('Cloudinary service initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Cloudinary service:', error.message);
    // Don't exit - the app can still run without Cloudinary
  }
  
  await initializeCommunities();

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

// Export app for testing
export default app;
