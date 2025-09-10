import { Server as SocketIOServer, Socket } from 'socket.io';
import { JwtPayload } from '../types/auth';
import { SocketUser, WebSocketEvent } from '../types/websocket';
import { PresenceService } from '../services/presenceService';
import jwt from 'jsonwebtoken';

interface AuthenticatedSocket extends Socket {
  user?: SocketUser;
  currentBoards?: Set<string>;
}

export function initializeWebSocket(io: SocketIOServer): void {
  // Authentication middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
      socket.user = {
        id: decoded.userId,
        username: decoded.username,
        email: decoded.email
      };
      socket.currentBoards = new Set();
      next();
    } catch (error) {
      next(new Error('Invalid authentication token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`✅ User ${socket.user?.username} connected with socket ${socket.id}`);

    // Join board room
    socket.on('join_board', async (boardId: string) => {
      try {
        socket.join(`board_${boardId}`);
        socket.currentBoards?.add(boardId);
        
        // Add user to presence
        if (socket.user) {
          await PresenceService.addUserToBoard(boardId, socket.user);
          
          // Get current users and notify others
          const boardUsers = await PresenceService.getBoardUsers(boardId);
          
          // Send current users to the joining user
          socket.emit('board_users', { boardId, users: boardUsers });
          
          // Notify others about new user
          socket.to(`board_${boardId}`).emit('user_joined', {
            boardId,
            user: socket.user,
            timestamp: new Date()
          });
        }
        
        console.log(`User ${socket.user?.username} joined board ${boardId}`);
      } catch (error) {
        console.error('Error joining board:', error);
        socket.emit('error', { message: 'Failed to join board' });
      }
    });

    // Leave board room
    socket.on('leave_board', async (boardId: string) => {
      try {
        socket.leave(`board_${boardId}`);
        socket.currentBoards?.delete(boardId);
        
        if (socket.user) {
          await PresenceService.removeUserFromBoard(boardId, socket.user.id);
          
          // Notify others about user leaving
          socket.to(`board_${boardId}`).emit('user_left', {
            boardId,
            userId: socket.user.id,
            username: socket.user.username,
            timestamp: new Date()
          });
        }
        
        console.log(`User ${socket.user?.username} left board ${boardId}`);
      } catch (error) {
        console.error('Error leaving board:', error);
      }
    });

    // Handle typing indicators
    socket.on('typing_start', async (data: { cardId: string; boardId: string }) => {
      try {
        if (socket.user) {
          await PresenceService.setUserTyping(data.cardId, socket.user, true);
          
          socket.to(`board_${data.boardId}`).emit('user_typing', {
            cardId: data.cardId,
            userId: socket.user.id,
            username: socket.user.username,
            isTyping: true,
            timestamp: new Date()
          });
        }
      } catch (error) {
        console.error('Error handling typing start:', error);
      }
    });

    socket.on('typing_stop', async (data: { cardId: string; boardId: string }) => {
      try {
        if (socket.user) {
          await PresenceService.setUserTyping(data.cardId, socket.user, false);
          
          socket.to(`board_${data.boardId}`).emit('user_typing', {
            cardId: data.cardId,
            userId: socket.user.id,
            username: socket.user.username,
            isTyping: false,
            timestamp: new Date()
          });
        }
      } catch (error) {
        console.error('Error handling typing stop:', error);
      }
    });

    // Handle optimistic updates acknowledgment
    socket.on('optimistic_update_ack', (data: { eventId: string; success: boolean }) => {
      // Handle optimistic update acknowledgments
      console.log(`Optimistic update ${data.eventId}: ${data.success ? 'success' : 'failed'}`);
    });

    // Handle disconnection
    socket.on('disconnect', async (reason: string) => {
      console.log(`❌ User ${socket.user?.username} disconnected: ${reason}`);
      
      // Clean up presence for all boards user was in
      if (socket.user && socket.currentBoards) {
        for (const boardId of socket.currentBoards) {
          try {
            await PresenceService.removeUserFromBoard(boardId, socket.user.id);
            
            // Notify others about user leaving
            socket.to(`board_${boardId}`).emit('user_left', {
              boardId,
              userId: socket.user.id,
              username: socket.user.username,
              timestamp: new Date()
            });
          } catch (error) {
            console.error('Error cleaning up presence on disconnect:', error);
          }
        }
      }
    });

    // Handle ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong');
    });
  });

  // Periodic cleanup of expired presence data
  setInterval(async () => {
    try {
      await PresenceService.cleanupExpiredPresence();
    } catch (error) {
      console.error('Error during presence cleanup:', error);
    }
  }, 60000); // Every minute

  console.log('🔌 WebSocket server initialized with enhanced features');
}
