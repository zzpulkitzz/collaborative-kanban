import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ColumnAttributes {
  id: string;
  title: string;
  position: number;
  boardId: string;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

interface ColumnCreationAttributes extends Optional<ColumnAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class Column extends Model<ColumnAttributes, ColumnCreationAttributes> implements ColumnAttributes {
  public id!: string;
  public title!: string;
  public position!: number;
  public boardId!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly deletedAt?: Date;

  // Virtual fields for associations
  public cards?: any[];
  public board?: any;
}

Column.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        len: {
          args: [1, 50],
          msg: 'Column title must be between 1 and 50 characters'
        }
      }
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
    boardId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'boards',
        key: 'id'
      }
    }
  },
  {
    sequelize,
    modelName: 'Column',
    tableName: 'columns',
    /* indexes: [
      {
        fields: ['boardId']
      },
      {
        fields: ['position']
      },
      {
        unique: true,
        fields: ['boardId', 'position'],
        name: 'unique_board_column_position'
      }
    ] */
  }
);

export default Column;
