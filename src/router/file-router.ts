import { Router } from "express";
import { fileController } from "../controller/file.controller.js";
import { authenticate } from "../infrastructure/auth/middleware/authenticate.js";
import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

const fileRouter = Router();

fileRouter.use(authenticate);

fileRouter.post("/upload", upload.single("file"), fileController.uploadFile);
fileRouter.get("/:id", fileController.getFile);
fileRouter.delete("/:id", fileController.deleteFile);

fileRouter.get("/message/:messageId/attachments", fileController.getMessageAttachments);
fileRouter.get("/conversation/:conversationId/files", fileController.getConversationFiles);

export default fileRouter;