import { Request, Response, NextFunction } from "express";

export function requireActiveUser(req: Request, res: Response, next: NextFunction) {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Не авторизован" });
    if (!user.isActive) return res.status(403).json({ error: "Подписка не активна" });
    next();
}