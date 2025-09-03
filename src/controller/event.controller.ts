import { Request, Response } from "express";
import { eq, and, or, desc, gte, lte, between, sql } from "drizzle-orm";
import db from "../db/db.js";
import { events, eventParticipants, users, notifications } from "../db/schema.js";
import { AuthenticatedRequest } from "../infrastructure/auth/middleware/authenticate.js";

export class EventController {
  async createEvent(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const {
        title,
        description,
        type,
        location,
        startTime,
        endTime,
        isAllDay,
        maxParticipants,
        isPublic = true,
        requiresRsvp = false,
        metadata,
        inviteUserIds,
      } = req.body;

      if (!title || !type || !startTime || !endTime) {
        res.status(400).json({
          error: "Title, type, start time, and end time are required",
        });
        return;
      }

      const startDate = new Date(startTime);
      const endDate = new Date(endTime);

      if (endDate <= startDate) {
        res.status(400).json({
          error: "End time must be after start time",
        });
        return;
      }

      const event = await db().transaction(async (tx) => {
        const [newEvent] = await tx
          .insert(events)
          .values({
            title,
            description,
            type,
            location,
            startTime: startDate,
            endTime: endDate,
            isAllDay: isAllDay || false,
            createdById: req.user!.userId,
            maxParticipants,
            isPublic,
            requiresRsvp,
            metadata,
            status: "scheduled",
          })
          .returning();

        await tx.insert(eventParticipants).values({
          eventId: newEvent!.id,
          userId: req.user!.userId,
          status: "accepted",
          role: "organizer",
        });

        if (inviteUserIds && Array.isArray(inviteUserIds)) {
          const uniqueInvites = [...new Set(inviteUserIds.filter((id: string) => id !== req.user!.userId))];

          if (uniqueInvites.length > 0) {
            await tx.insert(eventParticipants).values(
              uniqueInvites.map((userId: string) => ({
                eventId: newEvent!.id,
                userId,
                status: "invited" as const,
                role: "participant" as const,
              }))
            );

            await tx.insert(notifications).values(
              uniqueInvites.map((userId: string) => ({
                userId,
                type: "system" as const,
                title: "Event Invitation",
                body: `You've been invited to ${title}`,
                data: { eventId: newEvent!.id },
              }))
            );
          }
        }

        return newEvent;
      });

      res.status(201).json({ event });
    } catch (error) {
      console.error("Create event error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to create event",
      });
    }
  }

  async getEvents(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const { type, status, startDate, endDate, isPublic, myEventsOnly, limit = "50", offset = "0" } = req.query;

      let query = db()
        .select({
          event: events,
          creator: {
            id: users.id,
            username: users.username,
            fullName: users.fullName,
            avatarUrl: users.avatarUrl,
          },
          participantCount: sql<number>`
            (SELECT COUNT(*) FROM ${eventParticipants} 
             WHERE ${eventParticipants.eventId} = ${events.id}
             AND ${eventParticipants.status} = 'accepted')`,
        })
        .from(events)
        .innerJoin(users, eq(events.createdById, users.id))
        .$dynamic();

      const conditions = [];

      if (type && typeof type === "string") {
        conditions.push(eq(events.type, type as any));
      }

      if (status && typeof status === "string") {
        conditions.push(eq(events.status, status as any));
      }

      if (startDate && typeof startDate === "string") {
        const start = new Date(startDate);
        conditions.push(gte(events.startTime, start));
      }

      if (endDate && typeof endDate === "string") {
        const end = new Date(endDate);
        conditions.push(lte(events.endTime, end));
      }

      if (isPublic !== undefined) {
        conditions.push(eq(events.isPublic, isPublic === "true"));
      }

      if (myEventsOnly === "true") {
        const myEventIds = db()
          .select({ eventId: eventParticipants.eventId })
          .from(eventParticipants)
          .where(eq(eventParticipants.userId, req.user.userId));

        conditions.push(sql`${events.id} IN (${myEventIds})`);
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const result = await query
        .orderBy(events.startTime)
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string));

      res.status(200).json({ events: result });
    } catch (error) {
      console.error("Get events error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to fetch events",
      });
    }
  }

  async getEventById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const { eventId } = req.params;

      const event = await db()
        .select({
          event: events,
          creator: {
            id: users.id,
            username: users.username,
            fullName: users.fullName,
            avatarUrl: users.avatarUrl,
          },
          participants: sql<any[]>`
            COALESCE(
              JSON_AGG(
                JSON_BUILD_OBJECT(
                  'id', p.user_id,
                  'username', u.username,
                  'fullName', u.full_name,
                  'avatarUrl', u.avatar_url,
                  'status', p.status,
                  'role', p.role
                )
              ) FILTER (WHERE p.user_id IS NOT NULL),
              '[]'::json
            )`,
        })
        .from(events)
        .innerJoin(users, eq(events.createdById, users.id))
        .leftJoin(eventParticipants, eq(eventParticipants.eventId, events.id))
        .leftJoin(users as any, eq(eventParticipants.userId, users.id))
        .where(eq(events.id, eventId as string))
        .groupBy(events.id, users.id)
        .limit(1);

      if (!event || event.length === 0) {
        res.status(404).json({ error: "Event not found" });
        return;
      }

      const isParticipant = await db()
        .select()
        .from(eventParticipants)
        .where(and(eq(eventParticipants.eventId, eventId as string), eq(eventParticipants.userId, req.user.userId)))
        .limit(1);

      if (!event[0]!.event.isPublic && isParticipant.length === 0) {
        res.status(403).json({ error: "This is a private event" });
        return;
      }

      res.status(200).json({ event: event[0] });
    } catch (error) {
      console.error("Get event by id error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to fetch event",
      });
    }
  }

  async updateEvent(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const { eventId } = req.params;

      const eventCheck = await db()
        .select({ createdById: events.createdById })
        .from(events)
        .where(eq(events.id, eventId as string))
        .limit(1);

      if (!eventCheck || eventCheck.length === 0) {
        res.status(404).json({ error: "Event not found" });
        return;
      }

      const participantCheck = await db()
        .select({ role: eventParticipants.role })
        .from(eventParticipants)
        .where(and(eq(eventParticipants.eventId, eventId as string), eq(eventParticipants.userId, req.user.userId)))
        .limit(1);

      const canUpdate =
        eventCheck[0]!.createdById === req.user.userId ||
        participantCheck[0]?.role === "organizer" ||
        req.user.role === "admin";

      if (!canUpdate) {
        res.status(403).json({ error: "You do not have permission to update this event" });
        return;
      }

      const updateData: any = { updatedAt: new Date() };
      const allowedFields = [
        "title",
        "description",
        "type",
        "location",
        "status",
        "startTime",
        "endTime",
        "isAllDay",
        "maxParticipants",
        "isPublic",
        "requiresRsvp",
        "metadata",
      ];

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          if (field === "startTime" || field === "endTime") {
            updateData[field] = new Date(req.body[field]);
          } else {
            updateData[field] = req.body[field];
          }
        }
      }

      if (updateData.startTime && updateData.endTime && updateData.endTime <= updateData.startTime) {
        res.status(400).json({ error: "End time must be after start time" });
        return;
      }

      const updatedEvent = await db().update(events).set(updateData).where(eq(events.id, eventId as string)).returning();

      if (req.body.status === "cancelled") {
        const participants = await db()
          .select({ userId: eventParticipants.userId })
          .from(eventParticipants)
          .where(eq(eventParticipants.eventId, eventId as string));

        if (participants.length > 0) {
          await db().insert(notifications).values(
            participants.map((p) => ({
              userId: p.userId,
              type: "system" as const,
              title: "Event Cancelled",
              body: `The event "${updatedEvent[0]!.title}" has been cancelled`,
              data: { eventId },
            }))
          );
        }
      }

      res.status(200).json({ event: updatedEvent[0] });
    } catch (error) {
      console.error("Update event error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to update event",
      });
    }
  }

  async deleteEvent(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const { eventId } = req.params;

      const eventCheck = await db()
        .select({
          createdById: events.createdById,
          title: events.title,
        })
        .from(events)
        .where(eq(events.id, eventId as string))
        .limit(1);

      if (!eventCheck || eventCheck.length === 0) {
        res.status(404).json({ error: "Event not found" });
        return;
      }

      const canDelete = eventCheck[0]!.createdById === req.user.userId || req.user.role === "admin";

      if (!canDelete) {
        res.status(403).json({ error: "You do not have permission to delete this event" });
        return;
      }

      const participants = await db()
        .select({ userId: eventParticipants.userId })
        .from(eventParticipants)
        .where(eq(eventParticipants.eventId, eventId as string));

      await db().delete(events).where(eq(events.id, eventId as string));

      if (participants.length > 0) {
        await db().insert(notifications).values(
          participants
            .filter((p) => p.userId !== req.user!.userId)
            .map((p) => ({
              userId: p.userId,
              type: "system" as const,
              title: "Event Deleted",
              body: `The event "${eventCheck[0]!.title}" has been deleted`,
              data: { eventId },
            }))
        );
      }

      res.status(200).json({ message: "Event deleted successfully" });
    } catch (error) {
      console.error("Delete event error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to delete event",
      });
    }
  }

  async respondToEvent(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const { eventId } = req.params;
      const { status, notes } = req.body;

      if (!status) {
        res.status(400).json({ error: "Response status is required" });
        return;
      }

      const validStatuses = ["accepted", "declined", "maybe"];
      if (!validStatuses.includes(status)) {
        res.status(400).json({ error: "Invalid response status" });
        return;
      }

      const participation = await db()
        .update(eventParticipants)
        .set({
          status,
          notes,
          responseAt: new Date(),
        })
        .where(and(eq(eventParticipants.eventId, eventId as string), eq(eventParticipants.userId, req.user.userId)))
        .returning();

      if (participation.length === 0) {
        const event = await db().select().from(events).where(eq(events.id, eventId as string)).limit(1);

        if (!event || event.length === 0) {
          res.status(404).json({ error: "Event not found" });
          return;
        }

        if (!event[0]!.isPublic) {
          res.status(403).json({ error: "You are not invited to this event" });
          return;
        }

        const newParticipation = await db()
          .insert(eventParticipants)
          .values({
            eventId: eventId as string,
            userId: req.user.userId,
            status,
            notes,
            role: "participant" as const,
            responseAt: new Date(),
          })
          .returning();

        res.status(201).json({ participation: newParticipation[0] });
      } else {
        res.status(200).json({ participation: participation[0] });
      }
    } catch (error) {
      console.error("Respond to event error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to respond to event",
      });
    }
  }

  async getEventParticipants(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const { eventId } = req.params;
      const { status } = req.query;

      let query = db()
        .select({
          participant: eventParticipants,
          user: {
            id: users.id,
            username: users.username,
            fullName: users.fullName,
            avatarUrl: users.avatarUrl,
            role: users.role,
          },
        })
        .from(eventParticipants)
        .innerJoin(users, eq(eventParticipants.userId, users.id))
        .where(eq(eventParticipants.eventId, eventId as string))
        .$dynamic();

      if (status && typeof status === "string") {
        query = query.where(eq(eventParticipants.status, status as any));
      }

      const participants = await query;

      res.status(200).json({ participants });
    } catch (error) {
      console.error("Get event participants error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to fetch participants",
      });
    }
  }

  async checkIn(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const { eventId } = req.params;

      const participation = await db()
        .update(eventParticipants)
        .set({
          status: "attended",
          checkInAt: new Date(),
        })
        .where(
          and(
            eq(eventParticipants.eventId, eventId as string),
            eq(eventParticipants.userId, req.user.userId),
            eq(eventParticipants.status, "accepted")
          )
        )
        .returning();

      if (participation.length === 0) {
        res.status(400).json({
          error: "You must accept the event invitation before checking in",
        });
        return;
      }

      res.status(200).json({
        message: "Successfully checked in",
        participation: participation[0],
      });
    } catch (error) {
      console.error("Check-in error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to check in",
      });
    }
  }

  async inviteUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const { eventId } = req.params;
      const { userIds } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        res.status(400).json({ error: "User IDs are required" });
        return;
      }

      const participantCheck = await db()
        .select({ role: eventParticipants.role })
        .from(eventParticipants)
        .where(and(eq(eventParticipants.eventId, eventId as string), eq(eventParticipants.userId, req.user.userId)))
        .limit(1);

      const eventInfo = await db()
        .select({
          title: events.title,
          createdById: events.createdById,
        })
        .from(events)
        .where(eq(events.id, eventId as string))
        .limit(1);

      if (!eventInfo || eventInfo.length === 0) {
        res.status(404).json({ error: "Event not found" });
        return;
      }

      const canInvite =
        eventInfo[0]!.createdById === req.user.userId ||
        participantCheck[0]?.role === "organizer" ||
        req.user.role === "admin";

      if (!canInvite) {
        res.status(403).json({ error: "You do not have permission to invite users" });
        return;
      }

      const existingParticipants = await db()
        .select({ userId: eventParticipants.userId })
        .from(eventParticipants)
        .where(eq(eventParticipants.eventId, eventId as string));

      const existingIds = new Set(existingParticipants.map((p) => p.userId));
      const newUserIds = userIds.filter((id) => !existingIds.has(id));

      if (newUserIds.length === 0) {
        res.status(400).json({ error: "All users are already invited" });
        return;
      }

      await db().transaction(async (tx) => {
        await tx.insert(eventParticipants).values(
          newUserIds.map((userId: string) => ({
            eventId: eventId as string,
            userId,
            status: "invited" as const,
            role: "participant" as const,
          }))
        );

        await tx.insert(notifications).values(
          newUserIds.map((userId: string) => ({
            userId,
            type: "system" as const,
            title: "Event Invitation",
            body: `You've been invited to ${eventInfo[0]!.title}`,
            data: { eventId },
          }))
        );
      });

      res.status(201).json({
        message: `Successfully invited ${newUserIds.length} users`,
      });
    } catch (error) {
      console.error("Invite users error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to invite users",
      });
    }
  }
}

export const eventController = new EventController();
