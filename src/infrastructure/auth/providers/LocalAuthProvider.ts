import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import getDb from '../../../db/db.js';
import { users, userSessions, type User } from '../../../db/schema.js';
import {
  IAuthProvider,
  LoginCredentials,
  RegisterData,
  AuthTokens,
  TokenPayload
} from './IAuthProvider.js';

export class LocalAuthProvider implements IAuthProvider {
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly accessTokenExpiry: string;
  private readonly refreshTokenExpiry: string;
  private readonly bcryptRounds: number;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-change-in-production';
    this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';
    this.bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '10');
  }

  async authenticate(credentials: LoginCredentials): Promise<{ user: User; tokens: AuthTokens }> {
    const db = getDb();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, credentials.email))
      .limit(1);

    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isValidPassword = await this.verifyPassword(credentials.password, user.passwordHash!);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    const tokens = await this.generateTokens(user);
    
    await this.createSession(user.id, tokens.refreshToken);

    return { user, tokens };
  }

  async validateToken(token: string): Promise<TokenPayload> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as TokenPayload;
      return payload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  async createUser(data: RegisterData): Promise<{ user: User; tokens: AuthTokens }> {
    const db = getDb();
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email))
      .limit(1);

    if (existingUser.length > 0) {
      throw new Error('User already exists');
    }

    const hashedPassword = await this.hashPassword(data.password);

    const result = await db
      .insert(users)
      .values({
        email: data.email,
        username: data.username,
        fullName: data.fullName,
        phoneNumber: data.phoneNumber,
        passwordHash: hashedPassword,
        role: data.role || 'player',
        isActive: true,
        isEmailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    const newUser = result[0];
    if (!newUser) {
      throw new Error('Failed to create user');
    }

    const tokens = await this.generateTokens(newUser);
    
    await this.createSession(newUser.id, tokens.refreshToken);

    return { user: newUser, tokens };
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = jwt.verify(refreshToken, this.jwtRefreshSecret) as TokenPayload;
      
      const db = getDb();
      const [session] = await db
        .select()
        .from(userSessions)
        .where(eq(userSessions.refreshToken, refreshToken))
        .limit(1);

      if (!session || session.expiresAt < new Date()) {
        throw new Error('Invalid or expired refresh token');
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, payload.userId))
        .limit(1);

      if (!user) {
        throw new Error('User not found');
      }

      const tokens = await this.generateTokens(user);
      
      await db
        .update(userSessions)
        .set({
          refreshToken: tokens.refreshToken,
          expiresAt: new Date(Date.now() + this.parseExpiry(this.refreshTokenExpiry)),
          updatedAt: new Date()
        })
        .where(eq(userSessions.id, session.id));

      return tokens;
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  async revokeToken(token: string): Promise<void> {
    const db = getDb();
    await db
      .update(userSessions)
      .set({
        isValid: false,
        updatedAt: new Date()
      })
      .where(eq(userSessions.refreshToken, token));
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.bcryptRounds);
  }

  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  private async generateTokens(user: User): Promise<AuthTokens> {
    const payload: TokenPayload = {
      id: user.id,
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role
    };

    const accessToken = jwt.sign(payload as object, this.jwtSecret, {
      expiresIn: this.accessTokenExpiry as any
    });

    const refreshToken = jwt.sign(payload as object, this.jwtRefreshSecret, {
      expiresIn: this.refreshTokenExpiry as any
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiry(this.accessTokenExpiry)
    };
  }

  private async createSession(userId: string, refreshToken: string): Promise<void> {
    const expiresAt = new Date(Date.now() + this.parseExpiry(this.refreshTokenExpiry));
    const db = getDb();
    await db.insert(userSessions).values({
      userId,
      refreshToken,
      userAgent: 'Unknown',
      ipAddress: '0.0.0.0',
      expiresAt,
      isValid: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  private parseExpiry(expiry: string): number {
    const units: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
      w: 7 * 24 * 60 * 60 * 1000
    };

    const match = expiry.match(/^(\d+)([smhdw])$/);
    if (!match) {
      return 15 * 60 * 1000;
    }

    const [, valueStr, unit] = match;
    if (!valueStr || !unit || !units[unit]) {
      return 15 * 60 * 1000;
    }
    
    const value = parseInt(valueStr, 10);
    return value * units[unit];
  }
}