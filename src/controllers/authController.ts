import { Request, Response } from 'express';
import { User } from '../models';
import { JWTUtils } from '../utils/jwt';
import { LoginRequest, RegisterRequest } from '../types/auth';
import { ApiResponse } from '../types';
import { AuthenticatedRequest } from '../middleware/auth';
import { Op } from 'sequelize';

export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { username, email, password, fullName }: RegisterRequest = req.body;

      // Validate required fields
      if (!username || !email || !password) {
        const response: ApiResponse = {
          success: false,
          error: 'Username, email, and password are required'
        };
        res.status(400).json(response);
        return;
      }

      // Check if user already exists
      const existingUser = await User.findOne({
        where: {
          [Op.or]: [{ email }, { username }]
        }
      });

      if (existingUser) {
        const field = existingUser.email === email ? 'email' : 'username';
        const response: ApiResponse = {
          success: false,
          error: `User with this ${field} already exists`
        };
        res.status(409).json(response);
        return;
      }

      // Create new user
      const user = await User.create({
        username,
        email,
        password,
        fullName
      });

      // Generate tokens
      const token = JWTUtils.generateToken(user.toSafeJSON());
      const refreshToken = JWTUtils.generateRefreshToken(user.toSafeJSON());

      const response: ApiResponse = {
        success: true,
        data: {
          user: user.toSafeJSON(),
          token,
          refreshToken
        },
        message: 'User registered successfully'
      };

      res.status(201).json(response);
    } catch (error: any) {
      console.error('Registration error:', error);
      
      let errorMessage = 'Registration failed';
      if (error.name === 'SequelizeValidationError') {
        errorMessage = error.errors.map((e: any) => e.message).join(', ');
      }

      const response: ApiResponse = {
        success: false,
        error: errorMessage
      };
      res.status(400).json(response);
    }
  }

  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password }: LoginRequest = req.body;

      if (!email || !password) {
        const response: ApiResponse = {
          success: false,
          error: 'Email and password are required'
        };
        res.status(400).json(response);
        return;
      }

      // Find user by email
      const user = await User.findOne({ where: { email } });
      if (!user) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid email or password'
        };
        res.status(401).json(response);
        return;
      }

      // Check if user is active
      if (!user.isActive) {
        const response: ApiResponse = {
          success: false,
          error: 'Account is deactivated'
        };
        res.status(401).json(response);
        return;
      }

      // Verify password
      const isPasswordValid = await user.checkPassword(password);
      if (!isPasswordValid) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid email or password'
        };
        res.status(401).json(response);
        return;
      }

      // Update last seen
      await user.updateLastSeen();

      // Generate tokens
      const token = JWTUtils.generateToken(user.toSafeJSON());
      const refreshToken = JWTUtils.generateRefreshToken(user.toSafeJSON());

      const response: ApiResponse = {
        success: true,
        data: {
          user: user.toSafeJSON(),
          token,
          refreshToken
        },
        message: 'Login successful'
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Login error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Login failed'
      };
      res.status(500).json(response);
    }
  }

  static async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = await User.findByPk(req.user!.id);
      
      if (!user) {
        const response: ApiResponse = {
          success: false,
          error: 'User not found'
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: { user: user.toSafeJSON() }
      };
      res.status(200).json(response);
    } catch (error) {
      console.error('Get profile error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to get profile'
      };
      res.status(500).json(response);
    }
  }

  static async updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { fullName, avatar } = req.body;
      const userId = req.user!.id;

      const user = await User.findByPk(userId);
      if (!user) {
        const response: ApiResponse = {
          success: false,
          error: 'User not found'
        };
        res.status(404).json(response);
        return;
      }

      // Update allowed fields
      if (fullName !== undefined) user.fullName = fullName;
      if (avatar !== undefined) user.avatar = avatar;

      await user.save();

      const response: ApiResponse = {
        success: true,
        data: { user: user.toSafeJSON() },
        message: 'Profile updated successfully'
      };
      res.status(200).json(response);
    } catch (error) {
      console.error('Update profile error:', error);
      const response: ApiResponse = {
        success: false,
        error: 'Failed to update profile'
      };
      res.status(500).json(response);
    }
  }

  static async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
    // In a production app, you might want to blacklist the token
    // For now, we'll just send a success response
    const response: ApiResponse = {
      success: true,
      message: 'Logged out successfully'
    };
    res.status(200).json(response);
  }
}
