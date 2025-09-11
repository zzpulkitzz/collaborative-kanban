import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import { sequelize } from './models';
import { initializeWebSocket } from './config/websocket';
import { ApiResponse } from './types';
import path from 'path';

// Import routes
import authRoutes from './routes/auth';
import boardRoutes from './routes/boards';
import columnRoutes from './routes/columns';
import cardRoutes from './routes/cards';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with TypeScript types
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.WEBSOCKET_ORIGIN || "http://localhost:3001",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
}));

app.use(cors({
  origin: process.env.WEBSOCKET_ORIGIN || "http://localhost:3001",
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

if (process.env.NODE_ENV === 'production') {
  // Serve static files from the React build
  app.use(express.static(path.join(__dirname, 'public')));
  
  // Serve React app for all non-API routes
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith("/api")) {
      res.sendFile(path.join(__dirname, "public", "index.html"));
    } else {
      next();
    }
  });
}

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  const response: ApiResponse = {
    success: true,
    data: {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV
    }
  };
  res.status(200).json(response);
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/columns', columnRoutes);
app.use('/api/cards', cardRoutes);

// Initialize WebSocket handlers
initializeWebSocket(io);

// Error handling middleware
interface CustomError extends Error {
  statusCode?: number;
}

app.use((err: CustomError, req: Request, res: Response, next: NextFunction) => {
  console.error('Error stack:', err.stack);
  
  const response: ApiResponse = {
    success: false,
    error: err.message || 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  };
  
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json(response);
});

// 404 handler
app.use((req: Request, res: Response) => {
  const response: ApiResponse = {
    success: false,
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  };
  res.status(404).json(response);
});

const PORT = process.env.PORT || 3001;

// Start server with proper error handling
async function startServer(): Promise<void> {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
    

    
    
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV}`);
      console.log(`🌐 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Unable to start server:', error);
    process.exit(1);
  }
}

startServer();

export { app, server, io };
