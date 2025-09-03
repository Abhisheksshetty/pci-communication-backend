import { Request, Response } from "express";
import { eq, and, or, desc, sql } from "drizzle-orm";
import db from "../db/db.js";
import { attachments, messages, conversationMembers, users } from "../db/schema.js";
import { AuthenticatedRequest } from "../infrastructure/auth/middleware/authenticate.js";
import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";

export class FileController {
  private uploadDir = path.join(process.cwd(), "uploads");

  constructor() {
    this.ensureUploadDir();
  }

  private async ensureUploadDir(): Promise<void> {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: "No file provided" });
        return;
      }

      const { messageId, conversationId } = req.body;

      if (messageId) {
        const message = await db()
          .select({ conversationId: messages.conversationId })
          .from(messages)
          .where(eq(messages.id, messageId as string))
          .limit(1);

        if (message.length === 0) {
          res.status(404).json({ error: "Message not found" });
          return;
        }

        const memberCheck = await db()
          .select()
          .from(conversationMembers)
          .where(
            and(
              eq(conversationMembers.conversationId, message[0]!.conversationId),
              eq(conversationMembers.userId, req.user.userId)
            )
          )
          .limit(1);

        if (memberCheck.length === 0) {
          res.status(403).json({ error: "You are not a member of this conversation" });
          return;
        }
      }

      const fileId = crypto.randomUUID();
      const fileExtension = path.extname(req.file.originalname);
      const fileName = `${fileId}${fileExtension}`;
      const filePath = path.join(this.uploadDir, fileName);

      await fs.writeFile(filePath, req.file.buffer);

      const fileUrl = `/api/files/${fileId}`;
      const thumbnailUrl = this.isImage(req.file.mimetype) ? fileUrl : null;

      if (messageId) {
        const attachment = await db()
          .insert(attachments)
          .values({
            messageId,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            url: fileUrl,
            thumbnailUrl,
            metadata: {
              uploadedBy: req.user.userId,
              originalName: req.file.originalname,
              storagePath: fileName,
            },
          })
          .returning();

        res.status(201).json({ attachment: attachment[0] });
      } else {
        res.status(201).json({
          file: {
            id: fileId,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            url: fileUrl,
            thumbnailUrl,
          },
        });
      }
    } catch (error) {
      console.error("Upload file error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to upload file",
      });
    }
  }

  async getFile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const { id } = req.params as { id: string };

      const files = await fs.readdir(this.uploadDir);
      const matchingFile = files.find((file) => file.startsWith(id));

      if (!matchingFile) {
        const attachment = await db()
          .select({
            attachment: attachments,
            conversationId: messages.conversationId,
          })
          .from(attachments)
          .innerJoin(messages, eq(attachments.messageId, messages.id))
          .where(sql`${attachments.metadata}->>'storagePath' LIKE ${id + "%"}`)
          .limit(1);

        if (attachment.length === 0) {
          res.status(404).json({ error: "File not found" });
          return;
        }

        const memberCheck = await db()
          .select()
          .from(conversationMembers)
          .where(
            and(
              eq(conversationMembers.conversationId, attachment[0]!.conversationId),
              eq(conversationMembers.userId, req.user.userId)
            )
          )
          .limit(1);

        if (memberCheck.length === 0) {
          res.status(403).json({ error: "You do not have access to this file" });
          return;
        }
      }

      if (!matchingFile) {
        res.status(404).json({ error: "File not found" });
        return;
      }

      const filePath = path.join(this.uploadDir, matchingFile);
      const fileBuffer = await fs.readFile(filePath);

      const mimeType = this.getMimeType(path.extname(matchingFile));
      res.contentType(mimeType);
      res.send(fileBuffer);
    } catch (error) {
      console.error("Get file error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to retrieve file",
      });
    }
  }

  async deleteFile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const { id } = req.params;

      const attachment = await db()
        .select({
          attachment: attachments,
          message: {
            senderId: messages.senderId,
            conversationId: messages.conversationId,
          },
        })
        .from(attachments)
        .innerJoin(messages, eq(attachments.messageId, messages.id))
        .where(eq(attachments.id, id as string))
        .limit(1);

      if (attachment.length === 0) {
        res.status(404).json({ error: "Attachment not found" });
        return;
      }

      const memberCheck = await db()
        .select({ role: conversationMembers.role })
        .from(conversationMembers)
        .where(
          and(
            eq(conversationMembers.conversationId, attachment[0]!.message.conversationId),
            eq(conversationMembers.userId, req.user.userId)
          )
        )
        .limit(1);

      const canDelete =
        attachment[0]!.message.senderId === req.user.userId ||
        memberCheck[0]?.role === "admin" ||
        memberCheck[0]?.role === "owner" ||
        req.user.role === "admin";

      if (!canDelete) {
        res.status(403).json({ error: "You do not have permission to delete this file" });
        return;
      }

      const metadata = attachment[0]!.attachment.metadata as any;
      if (metadata?.storagePath) {
        const filePath = path.join(this.uploadDir, metadata.storagePath);
        try {
          await fs.unlink(filePath);
        } catch (err) {
          console.error("Failed to delete file from disk:", err);
        }
      }

      await db()
        .delete(attachments)
        .where(eq(attachments.id, id as string));

      res.status(200).json({ message: "File deleted successfully" });
    } catch (error) {
      console.error("Delete file error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to delete file",
      });
    }
  }

  async getMessageAttachments(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const { messageId } = req.params as { messageId: string };

      const message = await db()
        .select({ conversationId: messages.conversationId })
        .from(messages)
        .where(eq(messages.id, messageId as string))
        .limit(1);

      if (message.length === 0) {
        res.status(404).json({ error: "Message not found" });
        return;
      }

      const memberCheck = await db()
        .select()
        .from(conversationMembers)
        .where(
          and(
            eq(conversationMembers.conversationId, message[0]!.conversationId),
            eq(conversationMembers.userId, req.user.userId)
          )
        )
        .limit(1);

      if (memberCheck.length === 0) {
        res.status(403).json({ error: "You are not a member of this conversation" });
        return;
      }

      const messageAttachments = await db()
        .select()
        .from(attachments)
        .where(eq(attachments.messageId, messageId as string));

      res.status(200).json({ attachments: messageAttachments });
    } catch (error) {
      console.error("Get message attachments error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to fetch attachments",
      });
    }
  }

  async getConversationFiles(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const { conversationId } = req.params as { conversationId: string };
      const { type, limit = "50", offset = "0" } = req.query;

      const memberCheck = await db()
        .select()
        .from(conversationMembers)
        .where(
          and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, req.user.userId))
        )
        .limit(1);

      if (memberCheck.length === 0) {
        res.status(403).json({ error: "You are not a member of this conversation" });
        return;
      }

      let query = db()
        .select({
          attachment: attachments,
          message: {
            id: messages.id,
            senderId: messages.senderId,
            createdAt: messages.createdAt,
          },
          sender: {
            id: users.id,
            username: users.username,
            fullName: users.fullName,
            avatarUrl: users.avatarUrl,
          },
        })
        .from(attachments)
        .innerJoin(messages, eq(attachments.messageId, messages.id))
        .innerJoin(users, eq(messages.senderId, users.id))
        .where(and(eq(messages.conversationId, conversationId), eq(messages.isDeleted, false)))
        .$dynamic();

      if (type && typeof type === "string") {
        const typeMap: Record<string, string[]> = {
          image: ["image/jpeg", "image/png", "image/gif", "image/webp"],
          video: ["video/mp4", "video/webm", "video/ogg"],
          audio: ["audio/mpeg", "audio/wav", "audio/ogg"],
          document: [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ],
        };

        const mimeTypes = typeMap[type];
        if (mimeTypes) {
          query = query.where(sql`${attachments.mimeType} = ANY(${mimeTypes})`);
        }
      }

      const files = await query
        .orderBy(desc(messages.createdAt))
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string));

      res.status(200).json({ files });
    } catch (error) {
      console.error("Get conversation files error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to fetch files",
      });
    }
  }

  private isImage(mimeType: string): boolean {
    return mimeType.startsWith("image/");
  }

  private getMimeType(extension: string): string {
    const mimeTypes: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".pdf": "application/pdf",
      ".doc": "application/msword",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".mp3": "audio/mpeg",
      ".wav": "audio/wav",
      ".txt": "text/plain",
      ".json": "application/json",
      ".zip": "application/zip",
    };

    return mimeTypes[extension.toLowerCase()] || "application/octet-stream";
  }
}

export const fileController = new FileController();
