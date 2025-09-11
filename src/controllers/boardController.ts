import { Response } from 'express';
import { Board, Column, Card, User, AuditLog } from '../models';
import { AuthenticatedRequest } from '../middleware/auth';
import { CreateBoardRequest, UpdateBoardRequest } from '../types/board';
import { ApiResponse } from '../types';
import { io } from '../server';

export class BoardController {
  static async createBoard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { title, description, backgroundColor }: CreateBoardRequest = req.body;
      const userId = req.user!.id;

      if (!title) {
        const response: ApiResponse = {
          success: false,
          error: 'Board title is required'
        };
        res.status(400).json(response);
        return;
      }

      // Get user's board count for positioning
      const boardCount = await Board.count({ where: { ownerId: userId } });

      const board = await Board.create({
        title,
        description,
        backgroundColor: backgroundColor || '#0079bf',
        ownerId: userId,
        position: boardCount
      });

      // Create default columns
      const defaultColumns = [
        { title: 'To Do', position: 0 },
        { title: 'In Progress', position: 1 },
        { title: 'Done', position: 2 }
      ];

      const columns = await Column.bulkCreate(
        defaultColumns.map(col => ({
          ...col,
          boardId: board.id
        }))
      );

      // Log audit event
      await AuditLog.create({
        action: 'BOARD_CREATED',
        entityType: 'board',
        entityId: board.id,
        boardId: board.id,
        userId,
        metadata: { title }
      });

      // Fetch complete board with associations
      const completeBoard = await Board.findByPk(board.id, {
        include: [
          {
            model: Column,
            as: 'columns',
            include: [{
              model: Card,
              as: 'cards',
              include: [{ model: User, as: 'assignee', attributes: ['id', 'username', 'fullName', 'avatar'] }]
            }]
          },
          { model: User, as: 'owner', attributes: ['id', 'username', 'fullName', 'avatar'] }
        ],
        order: [
          [{ model: Column, as: 'columns' }, 'position', 'ASC'],
          [{ model: Column, as: 'columns' }, { model: Card, as: 'cards' }, 'position', 'ASC']
        ]
      });

      const response: ApiResponse = {
        success: true,
        data: { board: completeBoard },
        message: 'Board created successfully'
      };
      res.status(201).json(response);
    } catch (error: any) {
      console.error('Create board error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.name === 'SequelizeValidationError' 
          ? error.errors.map((e: any) => e.message).join(', ')
          : 'Failed to create board'
      };
      res.status(400).json(response);
    }
  }

  static async getBoards(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      
      const boards = await Board.findAll({
        where: { ownerId: userId },
        include: [
          { model: User, as: 'owner', attributes: ['id', 'username', 'fullName', 'avatar'] }
        ],
        order: [['position', 'ASC'], ['createdAt', 'DESC']]
      });

      const response: ApiResponse = {
        success: true,
        data: { boards }
      };
      res.status(200).json(response);
    } catch (error) {
      console.error('Get boards error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to fetch boards'
      };
      res.status(500).json(response);
    }
  }

  static async getBoard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { boardId } = req.params;
      const userId = req.user!.id;
      console.log("yoooo")
      console.log(userId, boardId)
      const board = await Board.findOne({
         where: {id: boardId}, //{ id: boardId, ownerId: userId },
        include: [
          {
            model: Column,
            as: 'columns',
            include: [{
              model: Card,
              as: 'cards',
              include: [{ model: User, as: 'assignee', attributes: ['id', 'username', 'fullName', 'avatar'] }]
            }]
          },
          { model: User, as: 'owner', attributes: ['id', 'username', 'fullName', 'avatar'] }
        ],
        order: [
          [{ model: Column, as: 'columns' }, 'position', 'ASC'],
          [{ model: Column, as: 'columns' }, { model: Card, as: 'cards' }, 'position', 'ASC']
        ]
      });

      if (!board) {
        const response: ApiResponse = {
          success: false,
          error: 'Board not found or access denied'
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: { board }
      };
      res.status(200).json(response);
    } catch (error) {
      console.error('Get board error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to fetch board'
      };
      res.status(500).json(response);
    }
  }

  static async updateBoard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { boardId } = req.params;
      const { title, description, backgroundColor }: UpdateBoardRequest = req.body;
      const userId = req.user!.id;

      const board = await Board.findOne({
        where: { id: boardId, ownerId: userId }
      });

      if (!board) {
        const response: ApiResponse = {
          success: false,
          error: 'Board not found or access denied'
        };
        res.status(404).json(response);
        return;
      }

      const oldValues = { title: board.title, description: board.description, backgroundColor: board.backgroundColor };

      // Update board
      if (title !== undefined) board.title = title;
      if (description !== undefined) board.description = description;
      if (backgroundColor !== undefined) board.backgroundColor = backgroundColor;

      await board.save();

      // Log audit event
      await AuditLog.create({
        action: 'BOARD_UPDATED',
        entityType: 'board',
        entityId: board.id,
        boardId: board.id,
        userId,
        changes: { before: oldValues, after: { title, description, backgroundColor } }
      });

      // Emit real-time update
      io.to(`board_${boardId}`).emit('board_updated', {
        boardId,
        userId,
        changes: { title, description, backgroundColor },
        timestamp: new Date()
      });

      const response: ApiResponse = {
        success: true,
        data: { board },
        message: 'Board updated successfully'
      };
      res.status(200).json(response);
    } catch (error: any) {
      console.error('Update board error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.name === 'SequelizeValidationError' 
          ? error.errors.map((e: any) => e.message).join(', ')
          : 'Failed to update board'
      };
      res.status(400).json(response);
    }
  }

  static async deleteBoard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { boardId } = req.params;
      const userId = req.user!.id;

      const board = await Board.findOne({
        where: { id: boardId, ownerId: userId }
      });

      if (!board) {
        const response: ApiResponse = {
          success: false,
          error: 'Board not found or access denied'
        };
        res.status(404).json(response);
        return;
      }

      // Log audit event before deletion
      await AuditLog.create({
        action: 'BOARD_DELETED',
        entityType: 'board',
        entityId: board.id,
        boardId: board.id,
        userId,
        metadata: { title: board.title }
      });

      // Delete board (cascades to columns and cards)
      await board.destroy();

      // Emit real-time update
      io.to(`board_${boardId}`).emit('board_deleted', {
        boardId,
        userId,
        timestamp: new Date()
      });

      const response: ApiResponse = {
        success: true,
        message: 'Board deleted successfully'
      };
      res.status(200).json(response);
    } catch (error) {
      console.error('Delete board error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to delete board'
      };
      res.status(500).json(response);
    }
  }
}
