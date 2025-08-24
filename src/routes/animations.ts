import { Router } from "express";
import { 
    createAnimation,
    updateAnimation,
    getAnimationById,
    getAllAnimations,
    deleteAnimation
} from "../controllers/animationsController";
import { authMiddleware } from "../middleware/authMiddleware";
import { requireVerifiedEmail } from "../middleware/requireVerifiedEmail";
import { requireActiveUser } from "../middleware/requireActiveUser";

const router = Router();

// --- только для владельца ---
router.post("/", authMiddleware, requireVerifiedEmail, requireActiveUser, createAnimation);
router.put("/:id", authMiddleware, requireVerifiedEmail, requireActiveUser, updateAnimation);
router.delete("/:id", authMiddleware, requireVerifiedEmail, requireActiveUser, deleteAnimation);

// --- публичные ---
router.get("/:id", getAnimationById);
router.get("/", authMiddleware, getAllAnimations);

export default router;
