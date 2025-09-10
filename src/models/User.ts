import { DataTypes, Model, Optional } from 'sequelize';
import bcrypt from 'bcryptjs';
import sequelize from '../config/database';
import { AuthenticatedUser } from '../types/auth';

interface UserAttributes extends AuthenticatedUser {
  password: string;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'isActive' | 'lastSeen' | 'createdAt' | 'updatedAt'> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: string;
  public username!: string;
  public email!: string;
  public password!: string;
  public fullName?: string;
  public avatar?: string;
  public isActive!: boolean;
  public lastSeen!: Date;
  
  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly deletedAt?: Date;

  // Instance method to check password
  public async checkPassword(password: string): Promise<boolean> {
    return await bcrypt.compare(password, this.password);
  }

  // Instance method to get safe user data (without password)
  public toSafeJSON(): AuthenticatedUser {
    const { password, createdAt, updatedAt, deletedAt, ...safeUser } = this.toJSON();
    return safeUser as AuthenticatedUser;
  }

  // Update last seen timestamp
  public async updateLastSeen(): Promise<void> {
    this.lastSeen = new Date();
    await this.save();
  }
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    username: {
      type: DataTypes.STRING(30),
      allowNull: false,
      unique: {
        name: 'unique_username',
        msg: 'Username already exists'
      },
      validate: {
        len: {
          args: [3, 30],
          msg: 'Username must be between 3 and 30 characters'
        },
        isAlphanumeric: {
          msg: 'Username can only contain letters and numbers'
        }
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: {
        name: 'unique_email',
        msg: 'Email already exists'
      },
      validate: {
        isEmail: {
          msg: 'Must be a valid email address'
        }
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: {
          args: [6, 100],
          msg: 'Password must be at least 6 characters long'
        }
      }
    },
    fullName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        len: {
          args: [1, 100],
          msg: 'Full name cannot exceed 100 characters'
        }
      }
    },
    avatar: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        isUrl: {
          msg: 'Avatar must be a valid URL'
        }
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    lastSeen: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false
    }
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    /* indexes: [
      {
        unique: true,
        fields: ['username']
      },
      {
        unique: true,
        fields: ['email']
      },
      {
        fields: ['isActive']
      }
    ], */
    hooks: {
      beforeCreate: async (user: User) => {
        if (user.password) {
          user.password = await bcrypt.hash(user.password, 12);
        }
      },
      beforeUpdate: async (user: User) => {
        if (user.changed('password')) {
          user.password = await bcrypt.hash(user.password, 12);
        }
      }
    }
  }
);

export default User;
