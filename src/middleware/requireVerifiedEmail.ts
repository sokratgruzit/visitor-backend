import { Request, Response, NextFunction } from "express";

interface AuthRequest extends Request {
    user?: {
        id: number;
		email: string;
		name?: string | null;
		password: string;
		subscriptionStatus?: string;
		yooPaymentId?: string;
		refreshToken?: string | null;
		emailVerified: boolean;
		createdAt: Date;
		updatedAt: Date;
    };
}

export function requireVerifiedEmail(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    if (!req.user) {
        return res.status(401).json({ error: "Пользователь не авторизован" });
    }

    if (!req.user.emailVerified) {
        return res.status(403).json({ error: "Email не подтвержден" });
    }

    next();
}
