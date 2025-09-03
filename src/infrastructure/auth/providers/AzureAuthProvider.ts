import { User } from '../../../db/schema.js';
import {
  IAuthProvider,
  LoginCredentials,
  RegisterData,
  AuthTokens,
  TokenPayload
} from './IAuthProvider.js';

export class AzureAuthProvider implements IAuthProvider {
  private tenantId: string;
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.tenantId = process.env.AZURE_TENANT_ID || '';
    this.clientId = process.env.AZURE_CLIENT_ID || '';
    this.clientSecret = process.env.AZURE_CLIENT_SECRET || '';
  }

  async authenticate(credentials: LoginCredentials): Promise<{ user: User; tokens: AuthTokens }> {
    throw new Error('Azure AD authentication not yet implemented. Use LocalAuthProvider for now.');
  }

  async validateToken(token: string): Promise<TokenPayload> {
    throw new Error('Azure AD token validation not yet implemented. Use LocalAuthProvider for now.');
  }

  async createUser(data: RegisterData): Promise<{ user: User; tokens: AuthTokens }> {
    throw new Error('Azure AD user creation not yet implemented. Use LocalAuthProvider for now.');
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    throw new Error('Azure AD token refresh not yet implemented. Use LocalAuthProvider for now.');
  }

  async revokeToken(token: string): Promise<void> {
    throw new Error('Azure AD token revocation not yet implemented. Use LocalAuthProvider for now.');
  }

  async hashPassword(password: string): Promise<string> {
    throw new Error('Password hashing not applicable for Azure AD authentication.');
  }

  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    throw new Error('Password verification not applicable for Azure AD authentication.');
  }
}