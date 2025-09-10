import jwt from 'jsonwebtoken';
import { JwtPayload, AuthenticatedUser } from '../types/auth';

export class JWTUtils {
  private static readonly secret = process.env.JWT_SECRET!;


  static generateToken(user: AuthenticatedUser): string {
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      userId: user.id,
      email: user.email,
      username: user.username
    };

    return jwt.sign(payload, this.secret);
  }

  static verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.secret) as JwtPayload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  static generateRefreshToken(user: AuthenticatedUser): string {
    const payload = {
      userId: user.id,
      type: 'refresh'
    };

    return jwt.sign(payload, this.secret, { expiresIn: '30d' });
  }
}
