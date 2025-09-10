import redis from '../config/redis';
import { SocketUser } from '../types/websocket';

export class PresenceService {
  static async addUserToBoard(boardId: string, user: SocketUser): Promise<void> {
    const key = `board_presence:${boardId}`;
    const userData = JSON.stringify({
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      joinedAt: new Date()
    });
    
    await redis.hset(key, user.id, userData);
    await redis.expire(key, 3600); // Expire after 1 hour
  }

  static async removeUserFromBoard(boardId: string, userId: string): Promise<void> {
    const key = `board_presence:${boardId}`;
    await redis.hdel(key, userId);
  }

  static async getBoardUsers(boardId: string): Promise<SocketUser[]> {
    const key = `board_presence:${boardId}`;
    const users = await redis.hgetall(key);
    
    return Object.values(users).map(userData => JSON.parse(userData as string));
  }

  static async cleanupExpiredPresence(): Promise<void> {
    // This would be called periodically to clean up stale presence data
    // For now, we rely on Redis expiration
  }

  static async setUserTyping(cardId: string, user: SocketUser, isTyping: boolean): Promise<void> {
    const key = `typing:${cardId}`;
    
    if (isTyping) {
      await redis.hset(key, user.id, JSON.stringify({
        username: user.username,
        avatar: user.avatar,
        timestamp: new Date()
      }));
      await redis.expire(key, 30); // Expire after 30 seconds
    } else {
      await redis.hdel(key, user.id);
    }
  }

  static async getTypingUsers(cardId: string): Promise<any[]> {
    const key = `typing:${cardId}`;
    const users = await redis.hgetall(key);
    
    return Object.entries(users).map(([userId, userData]) => ({
      userId,
      ...JSON.parse(userData as string)
    }));
  }
}
