import { Router } from "express";
import {
    registerUser,
    loginUser,
    refreshToken,
    verifyEmail,
    checkAccess,
    getUser,
    resendEmail,
    logoutUser
} from "../controllers/authController";
import { authMiddleware } from "../middleware/authMiddleware";
import { requireVerifiedEmail } from "../middleware/requireVerifiedEmail";
import { requireActiveUser } from "../middleware/requireActiveUser";

const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/refresh", refreshToken);
router.get("/logout", logoutUser);
router.get("/verify-email", verifyEmail);
router.get("/gate", authMiddleware, requireVerifiedEmail, requireActiveUser, checkAccess);
router.get("/get-user", authMiddleware, getUser);
router.get("/resend-email", authMiddleware, resendEmail);

export default router;
