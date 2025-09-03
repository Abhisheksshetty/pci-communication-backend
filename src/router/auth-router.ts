import { Router } from "express";
import { authController } from "../controller/auth.controller.js";
import { authenticate } from "../infrastructure/auth/middleware/authenticate.js";

const authRouter = Router();

// Authentication routes
authRouter.post("/login", authController.login);
authRouter.post("/register", authController.register);
authRouter.post("/refresh", authController.refreshToken);
authRouter.post("/logout", authenticate, authController.logout);
authRouter.get("/me", authenticate, authController.me);

export default authRouter;
