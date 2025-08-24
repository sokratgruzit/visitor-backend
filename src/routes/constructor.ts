import { Router } from "express";
import { 
	saveLanding, 
	checkSlug, 
	addSlug, 
	getLandingBySlug, 
	getMyLanding, 
	deleteLandingComponent 
} from "../controllers/constructorController";
import { authMiddleware } from "../middleware/authMiddleware";
import { requireVerifiedEmail } from "../middleware/requireVerifiedEmail";
import { requireActiveUser } from "../middleware/requireActiveUser";
import { landingAccessMiddleware } from "../middleware/landingMiddleware";

const router = Router();

router.post("/save-landing", authMiddleware, requireVerifiedEmail, requireActiveUser, saveLanding);
router.post("/add-slug", authMiddleware, requireVerifiedEmail, requireActiveUser, addSlug);
router.get("/check-slug", checkSlug);
router.get("/landing/:slug", landingAccessMiddleware, getLandingBySlug);
router.get("/landing-data", authMiddleware, getMyLanding);
router.delete("/delete-component/:componentId", authMiddleware, requireVerifiedEmail, requireActiveUser, deleteLandingComponent);

export default router;
