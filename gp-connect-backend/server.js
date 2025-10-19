import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import authRoutes from './routes/authRoutes.js';
import postRoutes from './routes/postRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import communityRoutes from './routes/communityRoutes.js';
import path from 'path';
import { fileURLToPath } from 'url';
import initializeCommunities from './utils/initializeCommunities.js';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    methods: ['GET', 'POST']
  }
});

// Get __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(express.json()); // Body parser for JSON data
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174'] })); // Enable CORS for frontend

// Serve static files from the 'uploads' directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/community', communityRoutes);

// Socket.IO connection handling with JWT authentication
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    // Verify JWT token
    const jwt = await import('jsonwebtoken');
    const decoded = jwt.default.verify(token, process.env.JWT_SECRET);
    
    // Attach user ID to socket
    socket.userId = decoded.id;
    next();
  } catch (error) {
    next(new Error('Authentication error: Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id, 'User ID:', socket.userId);

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

// Make io available to routes
app.set('io', io);

// Error Handling Middleware
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  await initializeCommunities();

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
