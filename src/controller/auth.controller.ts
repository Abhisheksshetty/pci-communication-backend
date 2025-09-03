import { Request, Response } from 'express';
import { authService } from '../infrastructure/auth/services/AuthService.js';
import { LoginCredentials, RegisterData } from '../infrastructure/auth/providers/IAuthProvider.js';
import { AuthenticatedRequest } from '../infrastructure/auth/middleware/authenticate.js';

export class AuthController {
  async login(req: Request, res: Response): Promise<void> {
    try {
      const credentials: LoginCredentials = {
        email: req.body.email,
        password: req.body.password
      };

      if (!credentials.email || !credentials.password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      const { user, tokens } = await authService.login(credentials);

      res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          avatarUrl: user.avatarUrl
        },
        tokens
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(401).json({ 
        error: error instanceof Error ? error.message : 'Authentication failed' 
      });
    }
  }

  async register(req: Request, res: Response): Promise<void> {
    try {
      const registerData: RegisterData = {
        email: req.body.email,
        password: req.body.password,
        username: req.body.username,
        fullName: req.body.fullName,
        phoneNumber: req.body.phoneNumber,
        role: req.body.role || 'player'
      };

      if (!registerData.email || !registerData.password || !registerData.username) {
        res.status(400).json({ 
          error: 'Email, password, and username are required' 
        });
        return;
      }

      if (registerData.password.length < 8) {
        res.status(400).json({ 
          error: 'Password must be at least 8 characters long' 
        });
        return;
      }

      const { user, tokens } = await authService.register(registerData);

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          avatarUrl: user.avatarUrl
        },
        tokens
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(400).json({ 
        error: error instanceof Error ? error.message : 'Registration failed' 
      });
    }
  }

  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({ error: 'Refresh token is required' });
        return;
      }

      const tokens = await authService.refreshToken(refreshToken);
      
      res.status(200).json({ tokens });
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(401).json({ 
        error: error instanceof Error ? error.message : 'Token refresh failed' 
      });
    }
  }

  async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        res.status(400).json({ error: 'Authorization header is required' });
        return;
      }

      const token = authHeader.split(' ')[1];
      
      if (!token) {
        res.status(400).json({ error: 'Token is required' });
        return;
      }

      await authService.logout(token);
      
      res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Logout failed' 
      });
    }
  }

  async me(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      res.status(200).json({ user: req.user });
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get user info' 
      });
    }
  }
}

export const authController = new AuthController();