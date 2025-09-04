import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import db from '../db/db.js';
import { users, userSessions } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { messageHandler } from './handlers/messageHandler.js';
import { notificationHandler } from './handlers/notificationHandler.js';
import { presenceHandler } from './handlers/presenceHandler.js';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: {
    id: string;
    username: string;
    role: string;
  };
}

export class SocketService {
  private io: SocketIOServer;
  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds
  private socketUsers: Map<string, string> = new Map(); // socketId -> userId

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupConnectionHandling();
  }

  private setupMiddleware() {
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        
        // Verify session exists and is valid
        const session = await db()
          .select()
          .from(userSessions)
          .where(eq(userSessions.userId, decoded.userId))
          .limit(1);

        if (session.length === 0 || !session[0] || session[0].expiresAt < new Date()) {
          return next(new Error('Invalid or expired session'));
        }

        // Get user details
        const user = await db()
          .select({
            id: users.id,
            username: users.username,
            role: users.role,
            isActive: users.isActive
          })
          .from(users)
          .where(eq(users.id, decoded.userId))
          .limit(1);

        if (user.length === 0 || !user[0] || !user[0].isActive) {
          return next(new Error('User not found or inactive'));
        }

        socket.userId = decoded.userId;
        socket.user = user[0];
        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupConnectionHandling() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`User ${socket.user?.username} connected with socket ${socket.id}`);
      
      // Track connected user
      if (socket.userId) {
        this.addUserSocket(socket.userId, socket.id);
        
        // Join user to their personal room for direct notifications
        socket.join(`user:${socket.userId}`);
        
        // Setup event handlers
        this.setupEventHandlers(socket);
        
        // Handle user presence
        presenceHandler.handleUserConnect(socket, this.io);
      }

      socket.on('disconnect', (reason) => {
        console.log(`User ${socket.user?.username} disconnected: ${reason}`);
        
        if (socket.userId) {
          this.removeUserSocket(socket.userId, socket.id);
          presenceHandler.handleUserDisconnect(socket, this.io);
        }
      });
    });
  }

  private setupEventHandlers(socket: AuthenticatedSocket) {
    // Message events
    messageHandler.setupMessageHandlers(socket, this.io);
    
    // Notification events
    notificationHandler.setupNotificationHandlers(socket, this.io);
    
    // Presence events
    presenceHandler.setupPresenceHandlers(socket, this.io);
  }

  private addUserSocket(userId: string, socketId: string) {
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId)!.add(socketId);
    this.socketUsers.set(socketId, userId);
  }

  private removeUserSocket(userId: string, socketId: string) {
    const userSockets = this.connectedUsers.get(userId);
    if (userSockets) {
      userSockets.delete(socketId);
      if (userSockets.size === 0) {
        this.connectedUsers.delete(userId);
      }
    }
    this.socketUsers.delete(socketId);
  }

  // Public methods for emitting events
  public emitToUser(userId: string, event: string, data: any) {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  public emitToRoom(room: string, event: string, data: any) {
    this.io.to(room).emit(event, data);
  }

  public emitToAll(event: string, data: any) {
    this.io.emit(event, data);
  }

  public isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  public getConnectedUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }

  public getUserSocketCount(userId: string): number {
    return this.connectedUsers.get(userId)?.size || 0;
  }

  public getIO(): SocketIOServer {
    return this.io;
  }
}

// Singleton instance
let socketService: SocketService | null = null;

export const initializeSocketService = (server: HTTPServer): SocketService => {
  if (!socketService) {
    socketService = new SocketService(server);
  }
  return socketService;
};

export const getSocketService = (): SocketService => {
  if (!socketService) {
    throw new Error('SocketService not initialized. Call initializeSocketService first.');
  }
  return socketService;
};