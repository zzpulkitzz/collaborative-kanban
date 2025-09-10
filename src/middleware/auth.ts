import { Request, Response, NextFunction } from 'express';
import { JWTUtils } from '../utils/jwt';
import { User } from '../models';
import { ApiResponse } from '../types';
import { AuthenticatedUser } from '../types/auth';

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      const response: ApiResponse = {
        success: false,
        error: 'Access token required'
      };
      res.status(401).json(response);
      return;
    }

    const decoded = JWTUtils.verifyToken(token);
    
    // Verify user still exists and is active
    const user = await User.findByPk(decoded.userId);
    if (!user || !user.isActive) {
      const response: ApiResponse = {
        success: false,
        error: 'User not found or inactive'
      };
      res.status(401).json(response);
      return;
    }

    // Update last seen
    await user.updateLastSeen();

    req.user = user.toSafeJSON();
    next();
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: 'Invalid token'
    };
    res.status(403).json(response);
  }
};

export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = JWTUtils.verifyToken(token);
      const user = await User.findByPk(decoded.userId);
      
      if (user && user.isActive) {
        await user.updateLastSeen();
        req.user = user.toSafeJSON();
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};
