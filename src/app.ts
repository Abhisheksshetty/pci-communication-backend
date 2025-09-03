import express from "express";
import authRouter from "./router/auth-router.js";
import userRouter from "./router/user-router.js";
import messageRouter from "./router/message-router.js";
import eventRouter from "./router/event-router.js";
import fileRouter from "./router/file-router.js";

const app = express();
app.use(express.json());
app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/messages", messageRouter);
app.use("/api/events", eventRouter);
app.use("/api/files", fileRouter);

export default app;
