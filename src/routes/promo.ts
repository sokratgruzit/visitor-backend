import { Router } from "express";
import { createPromoCode, getPromoCodes, getPromoCodeById, updatePromoCode, deletePromoCode } from "../controllers/promoCodeController";
import { applyPromoCode } from "../controllers/promoCodeController"; // <- новый экшен
import { adminMiddleware } from "../middleware/adminMiddleware";
import { authMiddleware } from "../middleware/authMiddleware";
import { requireVerifiedEmail } from "../middleware/requireVerifiedEmail";
import { requireActiveUser } from "../middleware/requireActiveUser";

const router = Router();

// Админские операции
router.post("/", authMiddleware, adminMiddleware, createPromoCode);
router.get("/", authMiddleware, adminMiddleware, getPromoCodes);
router.get("/:id", authMiddleware, adminMiddleware, getPromoCodeById);
router.patch("/:id", authMiddleware, adminMiddleware, updatePromoCode);
router.delete("/:id", authMiddleware, adminMiddleware, deletePromoCode);

// Применение промокода пользователем
router.post("/apply", authMiddleware, requireVerifiedEmail, requireActiveUser, applyPromoCode);

export default router;
