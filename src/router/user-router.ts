import { Router } from "express";
import { userController } from "../controller/user.controller.js";
import { authenticate } from "../infrastructure/auth/middleware/authenticate.js";

const userRouter = Router();

userRouter.use(authenticate);

userRouter.get("/", userController.getAllUsers);
userRouter.get("/:id", userController.getUserById);
userRouter.put("/:id", userController.updateUser);
userRouter.delete("/:id", userController.deleteUser);

userRouter.put("/status/update", userController.updateStatus);

userRouter.get("/contacts/list", userController.getContacts);
userRouter.post("/contacts/add", userController.addContact);
userRouter.delete("/contacts/:contactId", userController.removeContact);
userRouter.put("/contacts/:contactId/block", userController.blockContact);

export default userRouter;