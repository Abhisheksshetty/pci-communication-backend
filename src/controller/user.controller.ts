import { Request, Response } from 'express';
import { eq, like, or, and } from 'drizzle-orm';
import db from '../db/db.js';
import { users, userContacts } from '../db/schema.js';
import { AuthenticatedRequest } from '../infrastructure/auth/middleware/authenticate.js';

export class UserController {
  async getAllUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { search, role, status, limit = '10', offset = '0' } = req.query;
      
      let query = db().select({
        id: users.id,
        email: users.email,
        username: users.username,
        fullName: users.fullName,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        role: users.role,
        status: users.status,
        statusMessage: users.statusMessage,
        lastSeenAt: users.lastSeenAt,
        isActive: users.isActive,
        createdAt: users.createdAt
      }).from(users).$dynamic();
      
      const conditions = [];
      
      if (search && typeof search === 'string') {
        conditions.push(
          or(
            like(users.username, `%${search}%`),
            like(users.email, `%${search}%`),
            like(users.fullName, `%${search}%`)
          )
        );
      }
      
      if (role && typeof role === 'string') {
        conditions.push(eq(users.role, role));
      }
      
      if (status && typeof status === 'string') {
        conditions.push(eq(users.status, status as 'online' | 'offline' | 'away' | 'busy' | 'invisible'));
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      const result = await query
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string));
      
      res.status(200).json({ users: result });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to fetch users' 
      });
    }
  }

  async getUserById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!id) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }
      
      const user = await db().select({
        id: users.id,
        email: users.email,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        fullName: users.fullName,
        displayName: users.displayName,
        bio: users.bio,
        avatarUrl: users.avatarUrl,
        phoneNumber: users.phoneNumber,
        role: users.role,
        status: users.status,
        statusMessage: users.statusMessage,
        lastSeenAt: users.lastSeenAt,
        isEmailVerified: users.isEmailVerified,
        isPhoneVerified: users.isPhoneVerified,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
      
      if (user.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      
      res.status(200).json({ user: user[0] });
    } catch (error) {
      console.error('Get user by id error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to fetch user' 
      });
    }
  }

  async updateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!id) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }
      
      if (req.user?.userId !== id && req.user?.role !== 'admin') {
        res.status(403).json({ error: 'Forbidden: You can only update your own profile' });
        return;
      }
      
      const updateData: Record<string, any> = {};
      const allowedFields = [
        'firstName', 'lastName', 'fullName', 'displayName', 
        'bio', 'avatarUrl', 'phoneNumber', 'statusMessage',
        'status', 'notificationSettings'
      ];
      
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }
      
      if (req.user?.role === 'admin' && req.body.role) {
        updateData.role = req.body.role;
      }
      
      if (req.user?.role === 'admin' && req.body.isActive !== undefined) {
        updateData.isActive = req.body.isActive;
      }
      
      updateData.updatedAt = new Date();
      
      const updatedUser = await db()
        .update(users)
        .set(updateData)
        .where(eq(users.id, id))
        .returning({
          id: users.id,
          email: users.email,
          username: users.username,
          fullName: users.fullName,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          role: users.role,
          status: users.status,
          statusMessage: users.statusMessage,
          updatedAt: users.updatedAt
        });
      
      if (updatedUser.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      
      res.status(200).json({ user: updatedUser[0] });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to update user' 
      });
    }
  }

  async deleteUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!id) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }
      
      if (req.user?.role !== 'admin') {
        res.status(403).json({ error: 'Forbidden: Only admins can delete users' });
        return;
      }
      
      if (req.user?.userId === id) {
        res.status(400).json({ error: 'You cannot delete your own account' });
        return;
      }
      
      const deletedUser = await db()
        .delete(users)
        .where(eq(users.id, id))
        .returning({ id: users.id });
      
      if (deletedUser.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      
      res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to delete user' 
      });
    }
  }

  async updateStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }
      
      const { status, statusMessage } = req.body;
      
      if (!status) {
        res.status(400).json({ error: 'Status is required' });
        return;
      }
      
      const validStatuses = ['online', 'offline', 'away', 'busy', 'invisible'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({ error: 'Invalid status value' });
        return;
      }
      
      const updateData: {
        status: 'online' | 'offline' | 'away' | 'busy' | 'invisible';
        lastSeenAt: Date;
        updatedAt: Date;
        statusMessage?: string | null;
      } = {
        status: status as 'online' | 'offline' | 'away' | 'busy' | 'invisible',
        lastSeenAt: new Date(),
        updatedAt: new Date()
      };
      
      if (statusMessage !== undefined) {
        updateData.statusMessage = statusMessage;
      }
      
      const updatedUser = await db()
        .update(users)
        .set(updateData)
        .where(eq(users.id, req.user.userId))
        .returning({
          id: users.id,
          status: users.status,
          statusMessage: users.statusMessage,
          lastSeenAt: users.lastSeenAt
        });
      
      res.status(200).json({ user: updatedUser[0] });
    } catch (error) {
      console.error('Update status error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to update status' 
      });
    }
  }

  async getContacts(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }
      
      const { type } = req.query;
      
      let query = db().select({
        id: userContacts.id,
        contactId: userContacts.contactId,
        nickname: userContacts.nickname,
        isFavorite: userContacts.isFavorite,
        isBlocked: userContacts.isBlocked,
        addedAt: userContacts.addedAt,
        contact: {
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          status: users.status,
          statusMessage: users.statusMessage
        }
      })
      .from(userContacts)
      .innerJoin(users, eq(userContacts.contactId, users.id))
      .where(eq(userContacts.userId, req.user.userId))
      .$dynamic();
      
      const contacts = await query;
      
      res.status(200).json({ contacts });
    } catch (error) {
      console.error('Get contacts error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to fetch contacts' 
      });
    }
  }

  async addContact(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }
      
      const { contactId, nickname, isFavorite = false } = req.body;
      
      if (!contactId) {
        res.status(400).json({ error: 'Contact ID is required' });
        return;
      }
      
      if (contactId === req.user.userId) {
        res.status(400).json({ error: 'You cannot add yourself as a contact' });
        return;
      }
      
      const existingContact = await db()
        .select()
        .from(userContacts)
        .where(
          and(
            eq(userContacts.userId, req.user.userId),
            eq(userContacts.contactId, contactId)
          )
        )
        .limit(1);
      
      if (existingContact.length > 0) {
        res.status(409).json({ error: 'Contact already exists' });
        return;
      }
      
      const newContact = await db()
        .insert(userContacts)
        .values({
          userId: req.user.userId,
          contactId,
          nickname,
          isFavorite
        })
        .returning();
      
      res.status(201).json({ contact: newContact[0] });
    } catch (error) {
      console.error('Add contact error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to add contact' 
      });
    }
  }

  async removeContact(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }
      
      const contactId = req.params.contactId;
      
      if (!contactId) {
        res.status(400).json({ error: 'Contact ID is required' });
        return;
      }
      
      const deletedContact = await db()
        .delete(userContacts)
        .where(
          and(
            eq(userContacts.userId, req.user.userId),
            eq(userContacts.contactId, contactId)
          )
        )
        .returning({ id: userContacts.id });
      
      if (deletedContact.length === 0) {
        res.status(404).json({ error: 'Contact not found' });
        return;
      }
      
      res.status(200).json({ message: 'Contact removed successfully' });
    } catch (error) {
      console.error('Remove contact error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to remove contact' 
      });
    }
  }

  async blockContact(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }
      
      const contactId = req.params.contactId;
      const { isBlocked = true } = req.body;
      
      if (!contactId) {
        res.status(400).json({ error: 'Contact ID is required' });
        return;
      }
      
      const updatedContact = await db()
        .update(userContacts)
        .set({ 
          isBlocked
        })
        .where(
          and(
            eq(userContacts.userId, req.user.userId),
            eq(userContacts.contactId, contactId)
          )
        )
        .returning();
      
      if (updatedContact.length === 0) {
        res.status(404).json({ error: 'Contact not found' });
        return;
      }
      
      res.status(200).json({ 
        message: isBlocked ? 'Contact blocked successfully' : 'Contact unblocked successfully',
        contact: updatedContact[0]
      });
    } catch (error) {
      console.error('Block contact error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to block/unblock contact' 
      });
    }
  }

  async createRole(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'admin') {
        res.status(403).json({ error: 'Only admins can create roles' });
        return;
      }

      const { name, permissions, description } = req.body;

      if (!name) {
        res.status(400).json({ error: 'Role name is required' });
        return;
      }

      const predefinedRoles = ['admin', 'moderator', 'user', 'guest'];
      
      if (predefinedRoles.includes(name.toLowerCase())) {
        res.status(409).json({ error: 'Role already exists as a predefined role' });
        return;
      }

      res.status(201).json({ 
        message: 'Role creation is handled through user role assignment',
        availableRoles: predefinedRoles
      });
    } catch (error) {
      console.error('Create role error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to create role' 
      });
    }
  }

  async getRoles(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'admin') {
        res.status(403).json({ error: 'Only admins can view roles' });
        return;
      }

      const roles = [
        { 
          id: 'admin', 
          name: 'Admin', 
          description: 'Full system access',
          permissions: ['all']
        },
        { 
          id: 'moderator', 
          name: 'Moderator', 
          description: 'Moderate content and users',
          permissions: ['moderate_content', 'manage_users']
        },
        { 
          id: 'user', 
          name: 'User', 
          description: 'Standard user access',
          permissions: ['read', 'write', 'participate']
        },
        { 
          id: 'guest', 
          name: 'Guest', 
          description: 'Limited read-only access',
          permissions: ['read']
        }
      ];

      const roleUsage = await db()
        .select({
          role: users.role,
          count: users.id
        })
        .from(users)
        .groupBy(users.role);

      const rolesWithCounts = roles.map(role => ({
        ...role,
        userCount: roleUsage.filter(u => u.role === role.id).length || 0
      }));

      res.status(200).json({ roles: rolesWithCounts });
    } catch (error) {
      console.error('Get roles error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to fetch roles' 
      });
    }
  }

  async updateRole(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'admin') {
        res.status(403).json({ error: 'Only admins can update roles' });
        return;
      }

      const { roleId } = req.params;
      
      res.status(200).json({ 
        message: 'Predefined roles cannot be modified. Use user role assignment instead.',
        roleId 
      });
    } catch (error) {
      console.error('Update role error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to update role' 
      });
    }
  }

  async deleteRole(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'admin') {
        res.status(403).json({ error: 'Only admins can delete roles' });
        return;
      }

      const { roleId } = req.params;
      
      res.status(400).json({ 
        message: 'Predefined roles cannot be deleted. Use user role assignment instead.',
        roleId 
      });
    } catch (error) {
      console.error('Delete role error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to delete role' 
      });
    }
  }
}

export const userController = new UserController();