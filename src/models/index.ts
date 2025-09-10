import sequelize from '../config/database';
import User from './User';
import Board from './Board';
import Column from './Column';
import Card from './Card';
import AuditLog from './AuditLog';

// Define associations
const setupAssociations = (): void => {
  // User associations
  User.hasMany(Board, { foreignKey: 'ownerId', as: 'ownedBoards' });
  Board.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });

  User.hasMany(Card, { foreignKey: 'assigneeId', as: 'assignedCards' });
  Card.belongsTo(User, { foreignKey: 'assigneeId', as: 'assignee' });

  User.hasMany(AuditLog, { foreignKey: 'userId', as: 'auditLogs' });
  AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  // Board associations
  Board.hasMany(Column, { foreignKey: 'boardId', as: 'columns', onDelete: 'CASCADE' });
  Column.belongsTo(Board, { foreignKey: 'boardId', as: 'board' });

  Board.hasMany(AuditLog, { foreignKey: 'boardId', as: 'auditLogs', onDelete: 'CASCADE' });
  AuditLog.belongsTo(Board, { foreignKey: 'boardId', as: 'board' });

  // Column associations
  Column.hasMany(Card, { foreignKey: 'columnId', as: 'cards', onDelete: 'CASCADE' });
  Card.belongsTo(Column, { foreignKey: 'columnId', as: 'column' });
};

// Setup associations
setupAssociations();

export {
  sequelize,
  User,
  Board,
  Column,
  Card,
  AuditLog,
  setupAssociations
};
