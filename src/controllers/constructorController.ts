import { Request, Response } from "express";
import { prisma } from "../../prisma/client";

interface AuthRequest extends Request {
	user?: {
		id: number;
		email: string;
		name?: string | null;
		password: string;
		isActive: boolean;
		refreshToken?: string | null;
		emailVerified: boolean;
		createdAt: Date;
		updatedAt: Date;
	};
}

// Добавление slug (один раз)
export const addSlug = async (req: AuthRequest, res: Response) => {
	const userId = req.user?.id;
	const { slug } = req.body;

	if (!userId) return res.status(401).json({ success: false, message: "Неавторизованный пользователь" });
	if (!slug || typeof slug !== "string") return res.status(400).json({ success: false, message: "Неверный slug" });

	const isValid = /^[a-z0-9-]+$/.test(slug);
	if (!isValid) return res.status(400).json({ success: false, message: "Slug содержит недопустимые символы" });

	try {
		const existingSlug = await prisma.landing.findUnique({ where: { slug } });
		if (existingSlug) return res.status(409).json({ success: false, message: "Этот slug уже занят" });

		const userLanding = await prisma.landing.findUnique({ where: { userId } });
		if (userLanding && userLanding.slug) {
			return res.status(400).json({ success: false, message: "Slug уже установлен и не может быть изменён" });
		}

		const landing = await prisma.landing.create({
			data: {
				userId,
				slug,
				data: {},
			},
		});

		return res.status(201).json({ success: true, id: landing.id });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ success: false, message: "Ошибка при добавлении slug" });
	}
};

// Сохранение лендинга (slug не меняется)
export const saveLanding = async (req: AuthRequest, res: Response) => {
	const userId = req.user?.id;
	const landingData = req.body;

	if (!userId) return res.status(401).json({ success: false, message: "Неавторизованный пользователь" });

	const slug = landingData.slug;
	if (!slug || typeof slug !== "string") return res.status(400).json({ success: false, message: "Неверный slug" });

	const userLanding = await prisma.landing.findUnique({ where: { userId } });
	if (!userLanding || userLanding.slug !== slug) {
		return res.status(400).json({ success: false, message: "Нельзя менять slug" });
	}

	try {
		await prisma.landing.update({
			where: { userId },
			data: { data: landingData.data },
		});

		res.status(200).json({ success: true, message: "Лендинг успешно сохранен" });
	} catch (err) {
		console.error(err);
		res.status(500).json({ success: false, message: "Ошибка при сохранении лендинга" });
	}
};

// Проверка доступности slug
export const checkSlug = async (req: Request, res: Response) => {
	const { slug } = req.query;

	if (!slug || typeof slug !== "string")
		return res.status(400).json({ success: false, message: "Slug обязателен" });

	const isValid = /^[a-z0-9-]+$/.test(slug);
	if (!isValid) return res.status(400).json({ success: false, message: "Slug содержит недопустимые символы" });

	try {
		const existing = await prisma.landing.findUnique({
			where: { slug },
			select: { id: true },
		});
		res.status(200).json({ success: true, available: !existing });
	} catch (err) {
		console.error(err);
		res.status(500).json({ success: false, message: "Ошибка при проверке slug" });
	}
};

export const getLandingBySlug = async (req: Request, res: Response) => {
	const { slug } = req.params;

	if (!slug || typeof slug !== "string")
		return res.status(400).json({ success: false, message: "Slug обязателен" });

	try {
		const landing = await prisma.landing.findUnique({
			where: { slug },
			include: { user: true },
		});

		if (!landing)
			return res.status(404).json({ success: false, message: "Лендинг не найден" });

		if (!landing.user.isActive || !landing.user.emailVerified)
			return res.status(403).json({ success: false, message: "Пользователь неактивен или не подтвердил почту" });

		res.status(200).json({ success: true, data: landing.data });
	} catch (err) {
		console.error(err);
		res.status(500).json({ success: false, message: "Ошибка при получении лендинга" });
	}
};

export const getMyLanding = async (req: AuthRequest, res: Response) => {
	const userId = req.user?.id;

	if (!userId) return res.status(401).json({ success: false, message: "Неавторизованный пользователь" });

	try {
		const landing = await prisma.landing.findUnique({
			where: { userId },
		});
        
		if (!landing) {
			return res.status(404).json({ success: false, message: "Лендинг не найден" });
		}

		res.status(200).json({ success: true, data: landing.data, slug: landing.slug });
	} catch (err) {
		console.error(err);
		res.status(500).json({ success: false, message: "Ошибка при получении лендинга" });
	}
};
