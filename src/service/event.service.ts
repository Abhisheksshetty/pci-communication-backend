import { eq, and, or, desc, asc, gte, lte, between, sql } from "drizzle-orm";
import db from "../db/db.js";
import { events, eventParticipants, notifications, users } from "../db/schema.js";

export interface CreateEventData {
  title: string;
  description?: string;
  type: "training" | "match" | "meeting" | "social" | "other";
  location?: string;
  startTime: Date;
  endTime: Date;
  isAllDay?: boolean;
  createdById: string;
  maxParticipants?: number;
  isPublic?: boolean;
  requiresRsvp?: boolean;
  metadata?: any;
}

export interface EventFilter {
  type?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  isPublic?: boolean;
  userId?: string;
}

export class EventService {
  async createEvent(data: CreateEventData, inviteUserIds?: string[]): Promise<any> {
    return await db().transaction(async (tx: any) => {
      const [event] = await tx
        .insert(events)
        .values({
          ...data,
          status: "scheduled",
        })
        .returning();

      await tx.insert(eventParticipants).values({
        eventId: event.id,
        userId: data.createdById,
        status: "accepted",
        role: "organizer",
      });

      if (inviteUserIds && inviteUserIds.length > 0) {
        const uniqueInvites = [...new Set(inviteUserIds.filter((id) => id !== data.createdById))];

        if (uniqueInvites.length > 0) {
          await tx.insert(eventParticipants).values(
            uniqueInvites.map((userId) => ({
              eventId: event.id,
              userId,
              status: "invited",
              role: "participant",
            }))
          );

          await this.notifyParticipants(tx, uniqueInvites, "Event Invitation", `You've been invited to ${data.title}`, {
            eventId: event.id,
          });
        }
      }

      return event;
    });
  }

  async updateEventStatus(eventId: string, status: any): Promise<any> {
    const [updatedEvent] = await db()
      .update(events)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventId))
      .returning();

    if (status === "cancelled" || status === "postponed") {
      const participants = await this.getEventParticipants(eventId);
      const userIds = participants.map((p) => p.userId);

      if (userIds.length > 0) {
        await this.notifyParticipants(
          db,
          userIds,
          `Event ${status === "cancelled" ? "Cancelled" : "Postponed"}`,
          `The event "${updatedEvent?.title}" has been ${status}`,
          { eventId }
        );
      }
    }

    return updatedEvent;
  }

  async getUpcomingEvents(userId: string, days: number = 7): Promise<any[]> {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const upcomingEvents = await db()
      .select({
        event: events,
        participation: eventParticipants,
        creator: {
          id: users.id,
          username: users.username,
          fullName: users.fullName,
        },
      })
      .from(eventParticipants)
      .innerJoin(events, eq(eventParticipants.eventId, events.id))
      .innerJoin(users, eq(events.createdById, users.id))
      .where(
        and(
          eq(eventParticipants.userId, userId),
          eq(eventParticipants.status, "accepted"),
          between(events.startTime, startDate, endDate),
          eq(events.status, "scheduled")
        )
      )
      .orderBy(asc(events.startTime));

    return upcomingEvents;
  }

  async getEventsByFilter(filter: EventFilter): Promise<any[]> {
    let query = db()
      .select({
        event: events,
        participantCount: sql<number>`
          (SELECT COUNT(*) FROM ${eventParticipants} 
           WHERE ${eventParticipants.eventId} = ${events.id}
           AND ${eventParticipants.status} = 'accepted')`,
        creator: {
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(events)
      .innerJoin(users, eq(events.createdById, users.id))
      .$dynamic();

    const conditions = [];

    if (filter.type) {
      conditions.push(eq(events.type, filter.type as any));
    }

    if (filter.status) {
      conditions.push(eq(events.status, filter.status as any));
    }

    if (filter.startDate) {
      conditions.push(gte(events.startTime, filter.startDate));
    }

    if (filter.endDate) {
      conditions.push(lte(events.endTime, filter.endDate));
    }

    if (filter.isPublic !== undefined) {
      conditions.push(eq(events.isPublic, filter.isPublic));
    }

    if (filter.userId) {
      const userEventIds = db()
        .select({ eventId: eventParticipants.eventId })
        .from(eventParticipants)
        .where(eq(eventParticipants.userId, filter.userId));

      conditions.push(sql`${events.id} IN (${userEventIds})`);
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return await query.orderBy(events.startTime);
  }

  async getEventParticipants(eventId: string, status?: string): Promise<any[]> {
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
      .where(eq(eventParticipants.eventId, eventId))
      .$dynamic();

    if (status) {
      query = query.where(eq(eventParticipants.status, status as any));
    }

    return await query;
  }

  async respondToEvent(
    eventId: string,
    userId: string,
    response: "accepted" | "declined" | "maybe",
    notes?: string
  ): Promise<any> {
    const existing = await db()
      .select()
      .from(eventParticipants)
      .where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.userId, userId)))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db()
        .update(eventParticipants)
        .set({
          status: response,
          notes,
          responseAt: new Date(),
        })
        .where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.userId, userId)))
        .returning();

      return updated;
    } else {
      const [event] = await db().select().from(events).where(eq(events.id, eventId)).limit(1);

      if (!event || !event.isPublic) {
        throw new Error("Event not found or not public");
      }

      const [newParticipant] = await db()
        .insert(eventParticipants)
        .values({
          eventId,
          userId,
          status: response,
          notes,
          role: "participant",
          responseAt: new Date(),
        })
        .returning();

      return newParticipant;
    }
  }

  async checkInToEvent(eventId: string, userId: string): Promise<any> {
    const [checkedIn] = await db()
      .update(eventParticipants)
      .set({
        status: "attended",
        checkInAt: new Date(),
      })
      .where(
        and(
          eq(eventParticipants.eventId, eventId),
          eq(eventParticipants.userId, userId),
          eq(eventParticipants.status, "accepted")
        )
      )
      .returning();

    if (!checkedIn) {
      throw new Error("Must accept event invitation before checking in");
    }

    return checkedIn;
  }

  async getEventStats(eventId: string): Promise<any> {
    const stats = await db()
      .select({
        total: sql<number>`COUNT(*)`,
        accepted: sql<number>`COUNT(*) FILTER (WHERE ${eventParticipants.status} = 'accepted')`,
        declined: sql<number>`COUNT(*) FILTER (WHERE ${eventParticipants.status} = 'declined')`,
        maybe: sql<number>`COUNT(*) FILTER (WHERE ${eventParticipants.status} = 'maybe')`,
        invited: sql<number>`COUNT(*) FILTER (WHERE ${eventParticipants.status} = 'invited')`,
        attended: sql<number>`COUNT(*) FILTER (WHERE ${eventParticipants.status} = 'attended')`,
        noShow: sql<number>`COUNT(*) FILTER (WHERE ${eventParticipants.status} = 'no_show')`,
      })
      .from(eventParticipants)
      .where(eq(eventParticipants.eventId, eventId));

    return stats[0];
  }

  async getConflictingEvents(userId: string, startTime: Date, endTime: Date): Promise<any[]> {
    const conflicts = await db()
      .select({
        event: events,
        participation: eventParticipants,
      })
      .from(eventParticipants)
      .innerJoin(events, eq(eventParticipants.eventId, events.id))
      .where(
        and(
          eq(eventParticipants.userId, userId),
          or(eq(eventParticipants.status, "accepted"), eq(eventParticipants.status, "maybe")),
          eq(events.status, "scheduled"),
          or(
            and(lte(events.startTime, startTime), gte(events.endTime, startTime)),
            and(lte(events.startTime, endTime), gte(events.endTime, endTime)),
            and(gte(events.startTime, startTime), lte(events.endTime, endTime))
          )
        )
      );

    return conflicts;
  }

  async sendEventReminders(hoursBeforeEvent: number = 24): Promise<void> {
    const reminderTime = new Date();
    reminderTime.setHours(reminderTime.getHours() + hoursBeforeEvent);

    const upcomingEvents = await db()
      .select({
        event: events,
        participants: sql<any[]>`
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'userId', ${eventParticipants.userId},
              'status', ${eventParticipants.status}
            )
          )`,
      })
      .from(events)
      .innerJoin(eventParticipants, eq(eventParticipants.eventId, events.id))
      .where(
        and(
          eq(events.status, "scheduled"),
          between(events.startTime, new Date(), reminderTime),
          eq(eventParticipants.status, "accepted")
        )
      )
      .groupBy(events.id);

    for (const event of upcomingEvents) {
      const participants = event.participants as any[];
      const userIds = participants.map((p) => p.userId);

      if (userIds.length > 0) {
        const timeUntilEvent = Math.round((event.event.startTime.getTime() - Date.now()) / (1000 * 60 * 60));

        await this.notifyParticipants(
          db,
          userIds,
          "Event Reminder",
          `${event.event.title} starts in ${timeUntilEvent} hours`,
          { eventId: event.event.id }
        );
      }
    }
  }

  private async notifyParticipants(tx: any, userIds: string[], title: string, body: string, data: any): Promise<void> {
    await tx.insert(notifications).values(
      userIds.map((userId) => ({
        userId,
        type: "system" as const,
        title,
        body,
        data,
      }))
    );
  }
}

export const eventService = new EventService();
