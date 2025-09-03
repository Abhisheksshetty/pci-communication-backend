import { Router } from "express";
import { eventController } from "../controller/event.controller.js";
import { authenticate } from "../infrastructure/auth/middleware/authenticate.js";

const eventRouter = Router();

eventRouter.use(authenticate);

eventRouter.post("/", eventController.createEvent);
eventRouter.get("/", eventController.getEvents);
eventRouter.get("/:eventId", eventController.getEventById);
eventRouter.put("/:eventId", eventController.updateEvent);
eventRouter.delete("/:eventId", eventController.deleteEvent);

eventRouter.post("/:eventId/respond", eventController.respondToEvent);
eventRouter.post("/:eventId/checkin", eventController.checkIn);

eventRouter.get("/:eventId/participants", eventController.getEventParticipants);
eventRouter.post("/:eventId/invite", eventController.inviteUsers);

export default eventRouter;