export interface LoginRequest {
    email: string;
    password: string;
  }
  
  export interface RegisterRequest {
    username: string;
    email: string;
    password: string;
    fullName?: string;
  }
  
  export interface JwtPayload {
    userId: string;
    email: string;
    username: string;
    iat: number;
    exp: number;
  }
  
  export interface AuthenticatedUser {
    id: string;
    username: string;
    email: string;
    fullName?: string;
    avatar?: string;
    isActive: boolean;
    lastSeen: Date;
  }
  