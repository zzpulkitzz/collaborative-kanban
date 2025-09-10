import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface BoardAttributes {
  id: string;
  title: string;
  description?: string;
  backgroundColor?: string;
  ownerId: string;
  isPublic: boolean;
  position: number;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

interface BoardCreationAttributes extends Optional<BoardAttributes, 'id' | 'isPublic' | 'position' | 'createdAt' | 'updatedAt'> {}

class Board extends Model<BoardAttributes, BoardCreationAttributes> implements BoardAttributes {
  public id!: string;
  public title!: string;
  public description?: string;
  public backgroundColor?: string;
  public ownerId!: string;
  public isPublic!: boolean;
  public position!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly deletedAt?: Date;

  // Virtual fields for associations
  public columns?: any[];
  public owner?: any;
}

Board.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: {
          args: [1, 100],
          msg: 'Board title must be between 1 and 100 characters'
        }
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    backgroundColor: {
      type: DataTypes.STRING(7),
      allowNull: true,
      defaultValue: '#0079bf',
      validate: {
        is: {
          args: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
          msg: 'Background color must be a valid hex color'
        }
      }
    },
    ownerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    isPublic: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    position: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false
    }
  },
  {
    sequelize,
    modelName: 'Board',
    tableName: 'boards',
    /* indexes: [
      {
        fields: ['ownerId']
      },
      {
        fields: ['isPublic']
      },
      {
        fields: ['position']
      }
    ] */
  }
);

export default Board;
