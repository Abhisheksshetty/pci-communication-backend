import { IAuthProvider } from '../providers/IAuthProvider.js';
import { LocalAuthProvider } from '../providers/LocalAuthProvider.js';
import { AzureAuthProvider } from '../providers/AzureAuthProvider.js';
import { User } from '../../../db/schema.js';
import { LoginCredentials, RegisterData, AuthTokens, TokenPayload } from '../providers/IAuthProvider.js';

export class AuthService {
  private provider: IAuthProvider;

  constructor() {
    this.provider = this.createProvider();
  }

  private createProvider(): IAuthProvider {
    const providerType = process.env.AUTH_PROVIDER || 'local';
    
    switch (providerType) {
      case 'azure':
      case 'azure_ad':
        return new AzureAuthProvider();
      case 'local':
      default:
        return new LocalAuthProvider();
    }
  }

  async login(credentials: LoginCredentials): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      return await this.provider.authenticate(credentials);
    } catch (error) {
      throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async register(data: RegisterData): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      return await this.provider.createUser(data);
    } catch (error) {
      throw new Error(`Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async validateToken(token: string): Promise<TokenPayload> {
    try {
      return await this.provider.validateToken(token);
    } catch (error) {
      throw new Error(`Token validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      return await this.provider.refreshToken(refreshToken);
    } catch (error) {
      throw new Error(`Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async logout(token: string): Promise<void> {
    try {
      await this.provider.revokeToken(token);
    } catch (error) {
      throw new Error(`Logout failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getProvider(): IAuthProvider {
    return this.provider;
  }
}

export const authService = new AuthService();