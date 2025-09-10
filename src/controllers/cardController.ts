import { Response } from 'express';
import { Board, Column, Card, User, AuditLog } from '../models';
import { AuthenticatedRequest } from '../middleware/auth';
import { CreateCardRequest, MoveCardRequest } from '../types/board';
import { ApiResponse } from '../types';
import { io } from '../server';
import redis from '../config/redis';
import {Op} from 'sequelize';
export class CardController {
  static async createCard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { title, description, columnId, assigneeId, dueDate, labels }: CreateCardRequest = req.body;
      const userId = req.user!.id;

      if (!title || !columnId) {
        const response: ApiResponse = {
          success: false,
          error: 'Title and columnId are required'
        };
        res.status(400).json(response);
        return;
      }

      // Verify column access
      const column = await Column.findOne({
        where: { id: columnId },
        include: [{ model: Board, as: 'board' }]
      });

      if (!column || column.board.ownerId !== userId) {
        const response: ApiResponse = {
          success: false,
          error: 'Column not found or access denied'
        };
        res.status(404).json(response);
        return;
      }

      // Get card count for positioning
      const cardCount = await Card.count({ where: { columnId } });

      const card = await Card.create({
        title,
        description,
        columnId,
        assigneeId,
        dueDate,
        labels: labels || [],
        position: cardCount
      });

      // Fetch card with associations
      const completeCard = await Card.findByPk(card.id, {
        include: [
          { model: User, as: 'assignee', attributes: ['id', 'username', 'fullName', 'avatar'] },
          { model: Column, as: 'column' }
        ]
      });

      // Log audit event
      await AuditLog.create({
        action: 'CARD_CREATED',
        entityType: 'card',
        entityId: card.id,
        boardId: column.boardId,
        userId,
        metadata: { title, columnId, assigneeId }
      });

      // Emit real-time update
      io.to(`board_${column.boardId}`).emit('card_created', {
        card: completeCard,
        boardId: column.boardId,
        userId,
        timestamp: new Date()
      });

      const response: ApiResponse = {
        success: true,
        data: { card: completeCard },
        message: 'Card created successfully'
      };
      res.status(201).json(response);
    } catch (error: any) {
      console.error('Create card error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.name === 'SequelizeValidationError' 
          ? error.errors.map((e: any) => e.message).join(', ')
          : 'Failed to create card'
      };
      res.status(400).json(response);
    }
  }

  static async updateCard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { cardId } = req.params;
      const { title, description, assigneeId, dueDate, labels, priority } = req.body;
      const userId = req.user!.id;

      // Use Redis lock for optimistic concurrency control
      const lockKey = `card_lock:${cardId}`;
      const lockValue = `${userId}:${Date.now()}`;
      
      const locked = await redis.set(lockKey, lockValue, 'PX', 5000, 'NX');
      if (!locked) {
        const response: ApiResponse = {
          success: false,
          error: 'Card is currently being edited by another user'
        };
        res.status(409).json(response);
        return;
      }

      try {
        const card = await Card.findOne({
          where: { id: cardId },
          include: [
            { model: Column, as: 'column', include: [{ model: Board, as: 'board' }] },
            { model: User, as: 'assignee', attributes: ['id', 'username', 'fullName', 'avatar'] }
          ]
        });

        if (!card || card.column.board.ownerId !== userId) {
          const response: ApiResponse = {
            success: false,
            error: 'Card not found or access denied'
          };
          res.status(404).json(response);
          return;
        }

        const oldValues = {
          title: card.title,
          description: card.description,
          assigneeId: card.assigneeId,
          dueDate: card.dueDate,
          labels: card.labels,
          priority: card.priority
        };

        // Update card fields
        if (title !== undefined) card.title = title;
        if (description !== undefined) card.description = description;
        if (assigneeId !== undefined) card.assigneeId = assigneeId;
        if (dueDate !== undefined) card.dueDate = dueDate;
        if (labels !== undefined) card.labels = labels;
        if (priority !== undefined) card.priority = priority;

        await card.save();

        // Reload with associations
        await card.reload({
          include: [
            { model: Column, as: 'column' },
            { model: User, as: 'assignee', attributes: ['id', 'username', 'fullName', 'avatar'] }
          ]
        });

        // Log audit event
        await AuditLog.create({
          action: assigneeId !== oldValues.assigneeId ? 'CARD_ASSIGNED' : 'CARD_UPDATED',
          entityType: 'card',
          entityId: card.id,
          boardId: card.column.boardId,
          userId,
          changes: { before: oldValues, after: { title, description, assigneeId, dueDate, labels, priority } }
        });

        // Emit real-time update
        io.to(`board_${card.column.boardId}`).emit('card_updated', {
          card,
          boardId: card.column.boardId,
          userId,
          changes: { title, description, assigneeId, dueDate, labels, priority },
          timestamp: new Date()
        });

        const response: ApiResponse = {
          success: true,
          data: { card },
          message: 'Card updated successfully'
        };
        res.status(200).json(response);
      } finally {
        // Release lock
        await redis.del(lockKey);
      }
    } catch (error: any) {
      console.error('Update card error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.name === 'SequelizeValidationError' 
          ? error.errors.map((e: any) => e.message).join(', ')
          : 'Failed to update card'
      };
      res.status(400).json(response);
    }
  }

  static async moveCard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { cardId, targetColumnId, newPosition }: MoveCardRequest = req.body;
      const userId = req.user!.id;

      // Use Redis lock
      const lockKey = `card_lock:${cardId}`;
      const lockValue = `${userId}:${Date.now()}`;
      
      const locked = await redis.set(lockKey, lockValue, 'PX', 5000, 'NX');
      if (!locked) {
        const response: ApiResponse = {
          success: false,
          error: 'Card is currently being moved by another user'
        };
        res.status(409).json(response);
        return;
      }

      try {
        const card = await Card.findOne({
          where: { id: cardId },
          include: [
            { model: Column, as: 'column', include: [{ model: Board, as: 'board' }] },
            { model: User, as: 'assignee', attributes: ['id', 'username', 'fullName', 'avatar'] }
          ]
        });

        if (!card || card.column.board.ownerId !== userId) {
          const response: ApiResponse = {
            success: false,
            error: 'Card not found or access denied'
          };
          res.status(404).json(response);
          return;
        }

        const sourceColumnId = card.columnId;
        const boardId = card.column.boardId;

        // Update card position and column
        card.columnId = targetColumnId;
        card.position = newPosition;
        await card.save();

        // Update positions of other cards in both columns
        if (sourceColumnId !== targetColumnId) {
          // Update positions in source column
          await Card.update(
            { position: Card.sequelize!.literal('position - 1') },
            { where: { columnId: sourceColumnId, position: { [Op.gt]: card.position } } }
          );

          // Update positions in target column
          await Card.update(
            { position: Card.sequelize!.literal('position + 1') },
            { where: { columnId: targetColumnId, position: { [Op.gte]: newPosition }, id: { [Op.ne]: cardId } } }
          );
        } else {
          // Same column reorder logic
          // Implementation depends on drag direction
        }

        // Reload card with new associations
        await card.reload({
          include: [
            { model: Column, as: 'column' },
            { model: User, as: 'assignee', attributes: ['id', 'username', 'fullName', 'avatar'] }
          ]
        });

        // Log audit event
        await AuditLog.create({
          action: 'CARD_MOVED',
          entityType: 'card',
          entityId: card.id,
          boardId,
          userId,
          changes: {
            from: { columnId: sourceColumnId },
            to: { columnId: targetColumnId, position: newPosition }
          }
        });

        // Emit real-time update
        io.to(`board_${boardId}`).emit('card_moved', {
          card,
          sourceColumnId,
          targetColumnId,
          newPosition,
          boardId,
          userId,
          timestamp: new Date()
        });

        const response: ApiResponse = {
          success: true,
          data: { card },
          message: 'Card moved successfully'
        };
        res.status(200).json(response);
      } finally {
        await redis.del(lockKey);
      }
    } catch (error) {
      console.error('Move card error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to move card'
      };
      res.status(500).json(response);
    }
  }

  static async deleteCard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { cardId } = req.params;
      const userId = req.user!.id;

      const card = await Card.findOne({
        where: { id: cardId },
        include: [{ model: Column, as: 'column', include: [{ model: Board, as: 'board' }] }]
      });

      if (!card || card.column.board.ownerId !== userId) {
        const response: ApiResponse = {
          success: false,
          error: 'Card not found or access denied'
        };
        res.status(404).json(response);
        return;
      }

      // Log audit event
      await AuditLog.create({
        action: 'CARD_DELETED',
        entityType: 'card',
        entityId: card.id,
        boardId: card.column.boardId,
        userId,
        metadata: { title: card.title, columnId: card.columnId }
      });

      const boardId = card.column.boardId;
      await card.destroy();

      // Emit real-time update
      io.to(`board_${boardId}`).emit('card_deleted', {
        cardId,
        boardId,
        userId,
        timestamp: new Date()
      });

      const response: ApiResponse = {
        success: true,
        message: 'Card deleted successfully'
      };
      res.status(200).json(response);
    } catch (error) {
      console.error('Delete card error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to delete card'
      };
      res.status(500).json(response);
    }
  }
}
