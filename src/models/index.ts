import sequelize from '../config/database';
import User from './User';
import Board from './Board';
import Column from './Column';
import Card from './Card';
import AuditLog from './AuditLog';
import Notification from './Notifications';

// Define associations
const setupAssociations = (): void => {
  // User associations - Owner relationships
  User.hasMany(Board, { foreignKey: 'ownerId', as: 'ownedBoards', onDelete: 'CASCADE' });
  Board.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });

  // User associations - Card relationships (with aliases for multiple relationships)
  User.hasMany(Card, { foreignKey: 'assigneeId', as: 'assignedCards' });
  Card.belongsTo(User, { foreignKey: 'assigneeId', as: 'assignee' }); // ✅ Card assignee

  User.hasMany(Card, { foreignKey: 'creatorId', as: 'createdCards' }); // ✅ Missing association
  Card.belongsTo(User, { foreignKey: 'creatorId', as: 'creator' }); // ✅ Card creator

  // User audit log associations
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

  User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
  Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  Board.hasMany(Notification, { foreignKey: 'boardId', as: 'notifications' });
  Notification.belongsTo(Board, { foreignKey: 'boardId', as: 'board' });

  Card.hasMany(Notification, { foreignKey: 'cardId', as: 'notifications' });
  Notification.belongsTo(Card, { foreignKey: 'cardId', as: 'card' });

  // Additional card associations for audit logs
 /*  Card.hasMany(AuditLog, { foreignKey: 'entityId', as: 'auditLogs', scope: { entityType: 'card' } }); */
  /* AuditLog.belongsTo(Card, { 
    foreignKey: 'entityId', 
    as: 'card',
    constraints: false // ✅ Important for polymorphic relationship
  }); */
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
