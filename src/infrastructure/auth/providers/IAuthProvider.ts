import { User } from '../../../db/schema.js';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  username: string;
  fullName?: string;
  phoneNumber?: string;
  role?: 'admin' | 'coach' | 'player' | 'parent' | 'fan';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface TokenPayload {
  userId: string;
  email: string;
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface IAuthProvider {
  authenticate(credentials: LoginCredentials): Promise<{ user: User; tokens: AuthTokens }>;
  validateToken(token: string): Promise<TokenPayload>;
  createUser(data: RegisterData): Promise<{ user: User; tokens: AuthTokens }>;
  refreshToken(refreshToken: string): Promise<AuthTokens>;
  revokeToken(token: string): Promise<void>;
  hashPassword(password: string): Promise<string>;
  verifyPassword(password: string, hashedPassword: string): Promise<boolean>;
}