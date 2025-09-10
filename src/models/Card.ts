import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface CardAttributes {
  id: string;
  title: string;
  description?: string;
  position: number;
  columnId: string;
  assigneeId?: string;
  dueDate?: Date;
  labels?: string[];
  priority: 'low' | 'medium' | 'high';
  version: number;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

interface CardCreationAttributes extends Optional<CardAttributes, 'id' | 'priority' | 'version' | 'createdAt' | 'updatedAt'> {}

class Card extends Model<CardAttributes, CardCreationAttributes> implements CardAttributes {
  public id!: string;
  public title!: string;
  public description?: string;
  public position!: number;
  public columnId!: string;
  public assigneeId?: string;
  public dueDate?: Date;
  public labels?: string[];
  public priority!: 'low' | 'medium' | 'high';
  public version!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly deletedAt?: Date;

  // Virtual fields for associations
  public column?: any;
  public assignee?: any;
}

Card.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        len: {
          args: [1, 200],
          msg: 'Card title must be between 1 and 200 characters'
        }
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: {
          args: [0],
          msg: 'Position must be greater than or equal to 0'
        }
      }
    },
    columnId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'columns',
        key: 'id'
      }
    },
    assigneeId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    dueDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    labels: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: []
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high'),
      defaultValue: 'medium',
      allowNull: false
    },
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      allowNull: false
    }
  },
  {
    sequelize,
    modelName: 'Card',
    tableName: 'cards',
   /*  indexes: [
      {
        fields: ['columnId']
      },
      {
        fields: ['assigneeId']
      },
      {
        fields: ['dueDate']
      },
      {
        fields: ['priority']
      },
      {
        unique: true,
        fields: ['columnId', 'position'],
        name: 'unique_column_card_position'
      }
    ], */
    hooks: {
      beforeUpdate: (card: Card) => {
        // Increment version for optimistic concurrency control
        card.version += 1;
      }
    }
  }
);

export default Card;
