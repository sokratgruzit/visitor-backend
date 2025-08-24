import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../../prisma/client";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "secret_access";

export interface AuthRequest extends Request {
    userId?: number;
    user?: {
        id: number;
        email: string;
        name?: string | null;
        password: string;
        subscriptionStatus?: string;
        subscriptionEndAt?: Date | null;
        yooPaymentId?: string | null;
        refreshToken?: string | null;
        emailVerified: boolean;
        createdAt: Date;
        updatedAt: Date;
    };
}

export async function authMiddleware(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: "Токен не предоставлен" });

    const token = authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Токен отсутствует" });

    try {
        const payload = jwt.verify(token, ACCESS_SECRET) as { userId: number };
        if (!payload.userId) throw new Error("Некорректный токен");

        req.userId = payload.userId;

        // Загружаем пользователя из базы
        const user = await prisma.user.findUnique({
            where: { id: payload.userId },
            select: {
                id: true,
                email: true,
                name: true,
                password: true,
                subscriptionStatus: true,
                subscriptionEndAt: true,
                yooSubscriptionId: true,
                emailVerified: true,
                yooPaymentId: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!user) return res.status(401).json({ message: "Пользователь не найден" });

        // Ленивое обновление подписки
        if (user.subscriptionStatus === "active" && user.subscriptionEndAt && user.subscriptionEndAt < new Date()) {
            await prisma.user.update({
                where: { id: user.id },
                data: { subscriptionStatus: "inactive" },
            });
            user.subscriptionStatus = "inactive";
        }

        req.user = {
            ...user,
            subscriptionStatus: user.subscriptionStatus ?? undefined,
        };

        next();
    } catch {
        return res.status(401).json({ message: "Неверный или просроченный токен" });
    }
}
