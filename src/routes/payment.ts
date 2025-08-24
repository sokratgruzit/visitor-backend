import express, { Router } from "express";
import { 
    createPayment, 
    checkPaymentStatus, 
    yookassaWebhook, 
    cancelSubscription, 
    resumeSubscription,
    getUserPaymentHistory
} from "../controllers/paymentController";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.post("/yookassa", authMiddleware, createPayment);
router.get("/yookassa/status", authMiddleware, checkPaymentStatus);
router.post("/yookassa/webhook", express.json(), yookassaWebhook);
router.post("/yookassa/cancel", authMiddleware, cancelSubscription);
router.post("/yookassa/resume", authMiddleware, resumeSubscription);
router.get("/yookassa/history", authMiddleware, getUserPaymentHistory);

export default router;
