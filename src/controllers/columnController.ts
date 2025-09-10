import { Response } from 'express';
import { Board, Column, Card, User, AuditLog } from '../models';
import { AuthenticatedRequest } from '../middleware/auth';
import { CreateColumnRequest } from '../types/board';
import { ApiResponse } from '../types';
import { io } from '../server';

export class ColumnController {
  static async createColumn(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { title, boardId }: CreateColumnRequest = req.body;
      const userId = req.user!.id;

      if (!title || !boardId) {
        const response: ApiResponse = {
          success: false,
          error: 'Title and boardId are required'
        };
        res.status(400).json(response);
        return;
      }

      // Verify board ownership
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

      // Get column count for positioning
      const columnCount = await Column.count({ where: { boardId } });

      const column = await Column.create({
        title,
        boardId,
        position: columnCount
      });

      // Log audit event
      await AuditLog.create({
        action: 'COLUMN_CREATED',
        entityType: 'column',
        entityId: column.id,
        boardId,
        userId,
        metadata: { title, position: columnCount }
      });

      // Emit real-time update
      io.to(`board_${boardId}`).emit('column_created', {
        column,
        boardId,
        userId,
        timestamp: new Date()
      });

      const response: ApiResponse = {
        success: true,
        data: { column },
        message: 'Column created successfully'
      };
      res.status(201).json(response);
    } catch (error: any) {
      console.error('Create column error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.name === 'SequelizeValidationError' 
          ? error.errors.map((e: any) => e.message).join(', ')
          : 'Failed to create column'
      };
      res.status(400).json(response);
    }
  }

  static async updateColumn(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { columnId } = req.params;
      const { title } = req.body;
      const userId = req.user!.id;

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

      const oldTitle = column.title;
      column.title = title;
      await column.save();

      // Log audit event
      await AuditLog.create({
        action: 'COLUMN_UPDATED',
        entityType: 'column',
        entityId: column.id,
        boardId: column.boardId,
        userId,
        changes: { before: { title: oldTitle }, after: { title } }
      });

      // Emit real-time update
      io.to(`board_${column.boardId}`).emit('column_updated', {
        column,
        boardId: column.boardId,
        userId,
        timestamp: new Date()
      });

      const response: ApiResponse = {
        success: true,
        data: { column },
        message: 'Column updated successfully'
      };
      res.status(200).json(response);
    } catch (error: any) {
      console.error('Update column error:', error);
      const response: ApiResponse = {
        success: false,
        error: error.name === 'SequelizeValidationError' 
          ? error.errors.map((e: any) => e.message).join(', ')
          : 'Failed to update column'
      };
      res.status(400).json(response);
    }
  }

  static async deleteColumn(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { columnId } = req.params;
      const userId = req.user!.id;

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

      // Log audit event
      await AuditLog.create({
        action: 'COLUMN_DELETED',
        entityType: 'column',
        entityId: column.id,
        boardId: column.boardId,
        userId,
        metadata: { title: column.title, position: column.position }
      });

      const boardId = column.boardId;
      await column.destroy();

      // Emit real-time update
      io.to(`board_${boardId}`).emit('column_deleted', {
        columnId,
        boardId,
        userId,
        timestamp: new Date()
      });

      const response: ApiResponse = {
        success: true,
        message: 'Column deleted successfully'
      };
      res.status(200).json(response);
    } catch (error) {
      console.error('Delete column error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to delete column'
      };
      res.status(500).json(response);
    }
  }

  static async reorderColumns(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { boardId } = req.params;
      const { columnIds } = req.body; // Array of column IDs in new order
      const userId = req.user!.id;

      // Verify board ownership
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

      // Update column positions
      const updatePromises = columnIds.map((columnId: string, index: number) =>
        Column.update({ position: index }, { where: { id: columnId, boardId } })
      );

      await Promise.all(updatePromises);

      // Emit real-time update
      io.to(`board_${boardId}`).emit('columns_reordered', {
        boardId,
        columnIds,
        userId,
        timestamp: new Date()
      });

      const response: ApiResponse = {
        success: true,
        message: 'Columns reordered successfully'
      };
      res.status(200).json(response);
    } catch (error) {
      console.error('Reorder columns error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to reorder columns'
      };
      res.status(500).json(response);
    }
  }
}
