import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import { AuditAction } from '../types/board';

interface AuditLogAttributes {
  id: string;
  action: AuditAction;
  entityType: 'board' | 'column' | 'card';
  entityId: string;
  boardId: string;
  userId: string;
  changes?: any;
  metadata?: any;
  createdAt?: Date;
}

interface AuditLogCreationAttributes extends Optional<AuditLogAttributes, 'id' | 'createdAt'> {}

class AuditLog extends Model<AuditLogAttributes, AuditLogCreationAttributes> implements AuditLogAttributes {
  public id!: string;
  public action!: AuditAction;
  public entityType!: 'board' | 'column' | 'card';
  public entityId!: string;
  public boardId!: string;
  public userId!: string;
  public changes?: any;
  public metadata?: any;

  public readonly createdAt!: Date;

  // Virtual fields for associations
  public user?: any;
  public board?: any;
}

AuditLog.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    action: {
      type: DataTypes.ENUM(
        'BOARD_CREATED', 'BOARD_UPDATED', 'BOARD_DELETED',
        'COLUMN_CREATED', 'COLUMN_UPDATED', 'COLUMN_DELETED',
        'CARD_CREATED', 'CARD_UPDATED', 'CARD_MOVED', 'CARD_DELETED', 'CARD_ASSIGNED'
      ),
      allowNull: false
    },
    entityType: {
      type: DataTypes.ENUM('board', 'column', 'card'),
      allowNull: false
    },
    entityId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    boardId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'boards',
        key: 'id'
      }
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    changes: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true
    }
  },
  {
    sequelize,
    modelName: 'AuditLog',
    tableName: 'audit_logs',
    updatedAt: false, // Only track creation time
    /* indexes: [
      {
        fields: ['boardId']
      },
      {
        fields: ['userId']
      },
      {
        fields: ['entityType', 'entityId']
      },
      {
        fields: ['action']
      },
      {
        fields: ['createdAt']
      }
    ] */
  }
);

export default AuditLog;
