import { Router } from "express";
import { messageController } from "../controller/message.controller.js";
import { authenticate } from "../infrastructure/auth/middleware/authenticate.js";

const messageRouter = Router();

messageRouter.use(authenticate);

messageRouter.post("/send", messageController.sendMessage);
messageRouter.get("/conversations/:conversationId", messageController.getMessages);
messageRouter.put("/:messageId", messageController.editMessage);
messageRouter.delete("/:messageId", messageController.deleteMessage);

messageRouter.post("/:messageId/reactions", messageController.addReaction);
messageRouter.delete("/:messageId/reactions", messageController.removeReaction);
messageRouter.put("/:messageId/read", messageController.markAsRead);

messageRouter.get("/conversations", messageController.getConversations);
messageRouter.post("/conversations", messageController.createConversation);
messageRouter.put("/conversations/:conversationId", messageController.updateConversation);

messageRouter.post("/conversations/:conversationId/members", messageController.addMember);
messageRouter.delete("/conversations/:conversationId/members/:userId", messageController.removeMember);

export default messageRouter;