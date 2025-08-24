import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const createPromoCode = async (req: Request, res: Response) => {
    const { code, description, discountPct, bonusDays, customType, usageLimit, expiresAt, marketerId } = req.body;

    try {
        const existing = await prisma.promoCode.findUnique({ where: { code } });
        if (existing) {
            return res.status(409).json({ success: false, message: "Промокод уже существует" });
        }

        const promoCode = await prisma.promoCode.create({
            data: {
                code,
                description,
                discountPct,
                bonusDays,
                customType,
                usageLimit,
                expiresAt: expiresAt ? new Date(expiresAt) : null,
                marketerId
            }
        });

        return res.status(201).json({ success: true, promoCode });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "Ошибка создания промокода" });
    }
};

export const getPromoCodes = async (req: Request, res: Response) => {
    try {
        const promoCodes = await prisma.promoCode.findMany({
            include: { marketer: true }
        });
        return res.json({ success: true, promoCodes });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "Ошибка получения списка" });
    }
};

export const getPromoCodeById = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const promoCode = await prisma.promoCode.findUnique({
            where: { id: Number(id) },
            include: { marketer: true }
        });

        if (!promoCode) {
            return res.status(404).json({ success: false, message: "Промокод не найден" });
        }

        return res.json({ success: true, promoCode });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "Ошибка получения промокода" });
    }
};

export const updatePromoCode = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { description, discountPct, bonusDays, customType, usageLimit, active, expiresAt, marketerId } = req.body;

    try {
        const promoCode = await prisma.promoCode.update({
            where: { id: Number(id) },
            data: {
                description,
                discountPct,
                bonusDays,
                customType,
                usageLimit,
                active,
                expiresAt: expiresAt ? new Date(expiresAt) : null,
                marketerId
            }
        });

        return res.json({ success: true, promoCode });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "Ошибка обновления промокода" });
    }
};

export const deletePromoCode = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        await prisma.promoCode.delete({ where: { id: Number(id) } });
        return res.json({ success: true, message: "Промокод удалён" });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "Ошибка удаления промокода" });
    }
};

export const applyPromoCode = async (req: Request, res: Response) => {
    const { userId, code } = req.body;
    if (!userId || !code) {
        return res.status(400).json({ success: false, message: "Нужны userId и код промокода" });
    }

    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ success: false, message: "Пользователь не найден" });

        const promoCodeRecord = await prisma.promoCode.findUnique({ where: { code } });
        if (!promoCodeRecord || !promoCodeRecord.active || (promoCodeRecord.expiresAt && promoCodeRecord.expiresAt < new Date())) {
            return res.status(400).json({ success: false, message: "Промокод недействителен" });
        }

        // Проверка повторного использования
        if (user.promoCodeId === promoCodeRecord.id) {
            return res.status(400).json({ success: false, message: "Вы уже использовали этот промокод" });
        }

        if (promoCodeRecord.usageLimit && promoCodeRecord.usedCount >= promoCodeRecord.usageLimit) {
            return res.status(400).json({ success: false, message: "Промокод использован" });
        }

        // Применяем бонусы
        const updateData: any = { promoCodeId: promoCodeRecord.id };

        if (promoCodeRecord.customType === "trial" && promoCodeRecord.bonusDays) {
            const now = new Date();
            const newEnd = user.subscriptionEndAt && user.subscriptionEndAt > now ? new Date(user.subscriptionEndAt) : now;
            newEnd.setDate(newEnd.getDate() + promoCodeRecord.bonusDays);
            updateData.subscriptionEndAt = newEnd;
            updateData.subscriptionStatus = "active";
        }

        await prisma.user.update({
            where: { id: userId },
            data: updateData
        });

        await prisma.promoCode.update({
            where: { id: promoCodeRecord.id },
            data: { usedCount: { increment: 1 } },
        });

        return res.json({ success: true, message: "Промокод применён", promoCode: promoCodeRecord });

    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "Ошибка сервера" });
    }
};

