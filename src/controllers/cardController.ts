import { Response } from 'express';
import { Board, Column, Card, User, AuditLog } from '../models';
import { AuthenticatedRequest } from '../middleware/auth';
import { CreateCardRequest, MoveCardRequest } from '../types/board';
import { ApiResponse } from '../types';
import { io } from '../server';
import redis from '../config/redis';
import {Op} from 'sequelize';
import { sendAssignmentEmail } from '../utils/sendEmail';
export class CardController {
  static async createCard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { title, description, columnId, assigneeId, dueDate, labels,assigneeEmail }: CreateCardRequest = req.body;
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

      if (!column //|| column.board.ownerId !== userId) {
      ){
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
        dueDate,
        labels: labels || [],
        position: cardCount,
        creatorId: userId,
        assigneeEmail: assigneeEmail
      });
      console.log(card.id)
      // Fetch card with associations
      const completeCard = await Card.findByPk(card.id,{
        include: [
          { model: User, as: 'assignee', attributes: ['id', 'username', 'fullName', 'avatar'] },
          { model: User, as: 'creator', attributes: ['id', 'username', 'fullName', 'avatar'] },
          { 
            model: Column, 
            as: 'column',
            include: [{ 
              model: Board, 
              as: 'board',
              attributes: ['id', 'title', 'ownerId']
            }]
          }
        ]
      }
    );
      console.log("ye",assigneeEmail,completeCard)
      if (assigneeEmail && completeCard?.dataValues?.title) {
        console.log("SENDING")
        const assignedByUser = await User.findByPk(userId);
        await sendAssignmentEmail({
          to: assigneeEmail,
          cardTitle: completeCard?.dataValues?.title,
          boardTitle: completeCard.column.board.title,
          assignedBy: assignedByUser?.fullName || assignedByUser?.username || 'Someone',
          type: 'created'
        });
      }
      // Log audit event
      await AuditLog.create({
        action: 'CARD_CREATED',
        entityType: 'card',
        entityId: card.id,
        boardId: column.boardId,
        userId,
        metadata: { title, columnId, assigneeEmail }
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
      const userId = req.user!.id;
      const updates = req.body;
  
      // ✅ Store old values for audit logging
      const oldCard = await Card.findByPk(cardId, {
        include: [
          { model: Column, as: 'column', include: [{ model: Board, as: 'board' }] }
        ]
      });
  
      if (!oldCard) {
        const response: ApiResponse = {
          success: false,
          error: 'Card not found'
        };
        res.status(404).json(response);
        return;
      }
  
      // ✅ Check permissions - board owner OR card creator can edit
      const canEdit = oldCard.column.board.ownerId === userId || oldCard.creatorId === userId;
      if (!canEdit) {
        const response: ApiResponse = {
          success: false,
          error: 'Access denied. Only board owners or card creators can edit cards.'
        };
        res.status(403).json(response);
        return;
      }
  
      // ✅ Use Redis lock for optimistic concurrency control (if you have Redis)
      let lockKey: string | null = null;
      if (process.env.REDIS_URL && redis) {
        lockKey = `card_lock:${cardId}`;
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
      }
  
      try {
        // ✅ Store old values for comparison
        const oldValues = {
          title: oldCard.title,
          description: oldCard.description,
          assigneeId: oldCard.assigneeId,
          assigneeEmail: oldCard.assigneeEmail,
          dueDate: oldCard.dueDate,
          labels: oldCard.labels,
          priority: oldCard.priority
        };
  
        // ✅ Update the card
        await oldCard.update(updates);
  
        // ✅ Fetch updated card with all associations
        const updatedCard = await Card.findByPk(cardId, {
          include: [
            { model: User, as: 'assignee', attributes: ['id', 'username', 'fullName', 'avatar'] },
            { model: User, as: 'creator', attributes: ['id', 'username', 'fullName', 'avatar'] },
            { 
              model: Column, 
              as: 'column',
              include: [{ 
                model: Board, 
                as: 'board',
                attributes: ['id', 'title', 'ownerId']
              }]
            }
          ]
        });
        
        // 🌟 Send email if assigneeEmail changed and is not empty
    if (
      updates.assigneeEmail &&
      updates.assigneeEmail !== oldValues.assigneeEmail &&
      updatedCard?.column?.board?.title
    ) {
      const assignedByUser = await User.findByPk(userId);
      await sendAssignmentEmail({
        to: updates.assigneeEmail,
        cardTitle: updatedCard.title,
        boardTitle: updatedCard.column.board.title,
        assignedBy: assignedByUser?.fullName || assignedByUser?.username || 'Someone',
        type: 'updated'
      });
    }

        // ✅ Log audit event (uncomment when ready)
        const auditAction = updates.assigneeEmail !== oldValues.assigneeEmail ? 'CARD_ASSIGNED' : 'CARD_UPDATED';
        
        await AuditLog.create({
          action: auditAction,
          entityType: 'card',
          entityId: cardId,
          boardId: updatedCard!.column.board.id,
          userId,
          changes: { 
            before: oldValues, 
            after: {
              title: updatedCard!.title,
              description: updatedCard!.description,
              assigneeId: updatedCard!.assigneeId,
              assigneeEmail: updatedCard!.assigneeEmail,
              dueDate: updatedCard!.dueDate,
              labels: updatedCard!.labels,
              priority: updatedCard!.priority
            }
          }
        });
  
        // ✅ Emit real-time update to board members
        const io = req.app.get('io'); // Assuming you store io in app
        if (io) {
          io.to(`board_${updatedCard!.column.board.id}`).emit('card_updated', {
            card: updatedCard,
            boardId: updatedCard!.column.board.id,
            userId,
            changes: updates,
            timestamp: new Date()
          });
  
          // ✅ Send notification to assignee if card was assigned
          if (updates.assigneeEmail && updates.assigneeEmail !== oldValues.assigneeEmail) {
            io.to(`board_${updatedCard!.column.board.id}`).emit('card_assigned', {
              card: updatedCard,
              assigneeEmail: updates.assigneeEmail,
              assignedBy: userId,
              timestamp: new Date()
            });
          }
        }
  
        const response: ApiResponse = {
          success: true,
          data: { card: updatedCard },
          message: 'Card updated successfully'
        };
        res.status(200).json(response);
  
      } finally {
        // ✅ Release Redis lock
        if (lockKey && redis) {
          await redis.del(lockKey);
        }
      }
  
    } catch (error: any) {
      console.error('Update card error:', error);
      
      const response: ApiResponse = {
        success: false,
        error: error.name === 'SequelizeValidationError' 
          ? error.errors.map((e: any) => e.message).join(', ')
          : 'Failed to update card'
      };
      res.status(500).json(response);
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

        if (!card //|| card.column.board.ownerId !== userId) {
        ){const response: ApiResponse = {
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

      if (!card //|| card.column.board.ownerId !== userId) {
      ){
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
