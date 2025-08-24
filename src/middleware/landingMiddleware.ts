import { Request, Response, NextFunction } from "express";
import { prisma } from "../../prisma/client";

export async function landingAccessMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const { slug } = req.params;
    if (!slug) return res.status(400).json({ success: false, message: "Slug обязателен" });

    try {
        const landing = await prisma.landing.findUnique({ where: { slug } });
        if (!landing) return res.status(404).json({ success: false, message: "Лендинг не найден" });

        const user = await prisma.user.findUnique({
            where: { id: landing.userId },
            select: { id: true, subscriptionStatus: true, subscriptionEndAt: true, emailVerified: true },
        });
        if (!user) return res.status(404).json({ success: false, message: "Пользователь лендинга не найден" });

        if (user.subscriptionStatus === "active" && user.subscriptionEndAt && user.subscriptionEndAt < new Date()) {
            await prisma.user.update({ where: { id: user.id }, data: { subscriptionStatus: "inactive" } });
            user.subscriptionStatus = "inactive";
        }

        if (user.subscriptionStatus === "inactive" || !user.emailVerified) {
            return res.status(403).json({ success: false, message: "Пользователь неактивен или не подтвердил почту" });
        }

        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Ошибка при проверке доступа к лендингу" });
    }
}
