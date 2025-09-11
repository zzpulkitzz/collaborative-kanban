import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { User } from '../models';

// Store active users per board
const boardPresence = new Map<string, Map<string, UserPresence>>();

interface UserPresence {
  userId: string;
  username: string;
  fullName?: string;
  avatar?: string;
  joinedAt: Date;
  socketId: string;
}

export const initializeWebSocket = (io: Server) => {
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      const user = await User.findByPk(decoded.userId);
      
      if (!user) {
        return next(new Error('User not found'));
      }

      (socket as any).userId = user.id;
      (socket as any).userData = {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        avatar: user.avatar
      };
      
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔗 User ${(socket as any).userData.username} connected`);

    // Handle joining a board
    socket.on('join_board', (boardId: string) => {
      console.log(`👋 ${(socket as any).userData.username} joined board ${boardId}`);
      
      // Leave any previous board rooms
      Array.from(socket.rooms)
        .filter(room => room.startsWith('board_'))
        .forEach(room => socket.leave(room));

      // Join the new board room
      const roomName = `board_${boardId}`;
      socket.join(roomName);

      // Add user to presence tracking
      if (!boardPresence.has(boardId)) {
        boardPresence.set(boardId, new Map());
      }

      const boardUsers = boardPresence.get(boardId)!;
      boardUsers.set((socket as any).userData.id, {
        userId: (socket as any).userData.id,
        username: (socket as any).userData.username,
        fullName: (socket as any).userData.fullName,
        avatar: (socket as any).userData.avatar,
        joinedAt: new Date(),
        socketId: socket.id
      });

      // Broadcast updated presence to all users in the board
      const presenceList = Array.from(boardUsers.values()).map(user => ({
        userId: user.userId,
        username: user.username,
        fullName: user.fullName,
        avatar: user.avatar,
        joinedAt: user.joinedAt
      }));

      // Notify all users in the board about updated presence
      io.to(roomName).emit('presence_updated', {
        users: presenceList,
        totalUsers: presenceList.length
      });

      // Notify others about new user joining (optional notification)
      socket.to(roomName).emit('user_joined', {
        user: {
          userId: (socket as any).userData.id,
          username: (socket as any).userData.username,
          fullName: (socket as any).userData.fullName
        }
      });
    });

    // Handle leaving a board
    socket.on('leave_board', (boardId: string) => {
      handleUserLeaveBoard(socket, boardId);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`📡 User ${(socket as any).userData.username} disconnected`);
      
      // Remove user from all board presence
      boardPresence.forEach((users, boardId) => {
        if (users.has((socket as any).userData.id)) {
          users.delete((socket as any).userData.id);
          
          // Broadcast updated presence
          const presenceList = Array.from(users.values()).map(user => ({
            userId: user.userId,
            username: user.username,
            fullName: user.fullName,
            avatar: user.avatar,
            joinedAt: user.joinedAt
          }));

          io.to(`board_${boardId}`).emit('presence_updated', {
            users: presenceList,
            totalUsers: presenceList.length
          });

          // Notify about user leaving
          io.to(`board_${boardId}`).emit('user_left', {
            user: {
              userId: (socket as any).userData.id,
              username: (socket as any).userData.username
            }
          });
        }
      });
    });

    // Your existing card/board event handlers remain the same...
    socket.on('card_created', (data) => {
      socket.to(`board_${data.boardId}`).emit('card_created', data);
    });

    socket.on('card_moved', (data) => {
      socket.to(`board_${data.boardId}`).emit('card_moved', data);
    });

    socket.on('card_updated', (data) => {
      socket.to(`board_${data.boardId}`).emit('card_updated', data);
    });
  });

  // Helper function to handle user leaving board
  const handleUserLeaveBoard = (socket: any, boardId: string) => {
    const roomName = `board_${boardId}`;
    socket.leave(roomName);

    const boardUsers = boardPresence.get(boardId);
    if (boardUsers && boardUsers.has(socket.userData.id)) {
      boardUsers.delete(socket.userData.id);

      const presenceList = Array.from(boardUsers.values()).map(user => ({
        userId: user.userId,
        username: user.username,
        fullName: user.fullName,
        avatar: user.avatar,
        joinedAt: user.joinedAt
      }));

      io.to(roomName).emit('presence_updated', {
        users: presenceList,
        totalUsers: presenceList.length
      });
    }
  };
};
