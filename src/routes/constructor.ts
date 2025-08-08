import { Router } from "express";
import { saveLanding, checkSlug, addSlug, getLandingBySlug, getMyLanding } from "../controllers/constructorController";
import { authMiddleware } from "../middleware/authMiddleware";
import { requireVerifiedEmail } from "../middleware/requireVerifiedEmail";
import { requireActiveUser } from "../middleware/requireActiveUser";

const router = Router();

router.post("/save-landing", authMiddleware, requireVerifiedEmail, requireActiveUser, saveLanding);
router.post("/add-slug", authMiddleware, requireVerifiedEmail, requireActiveUser, addSlug);
router.get("/check-slug", checkSlug);
router.get("/landing/:slug", getLandingBySlug);
router.get("/landing-data", authMiddleware, getMyLanding);

export default router;
