import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import { sendVerificationEmail } from "../services/emailVerification";
import {
	generateAccessToken,
	generateRefreshToken,
	hashPassword,
	comparePassword,
} from "../utils/auth";

const prisma = new PrismaClient();

const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "secret_refresh";
const REFRESH_COOKIE_NAME = "refreshToken";

const setRefreshCookie = (res: Response, token: string) => {
	res.cookie(REFRESH_COOKIE_NAME, token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "strict",
		path: "/",
		maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
	});
};

interface AuthRequest extends Request {
	user?: {
		id: number;
		email: string;
		name?: string | null;
		password: string;
		subscriptionStatus?: string;
		emailVerified: boolean;
		promoCodeId?: number | null;
		yooSubscriptionId?: string | null;
		subscriptionEndAt?: string | null;
		createdAt: Date;
		updatedAt: Date;
	};
}

export const registerUser = async (req: Request, res: Response) => {
	const { email, password, name, promoCode: code } = req.body;

	if (!email || !password) {
		return res
			.status(400)
			.json({ success: false, message: "Email и пароль обязательны" });
	}

	try {
		const existingUser = await prisma.user.findUnique({ where: { email } });
		if (existingUser) {
			return res
				.status(409)
				.json({ success: false, message: "Пользователь уже существует" });
		}

		let promoCodeRecord = null;
		if (code) {
			promoCodeRecord = await prisma.promoCode.findUnique({ where: { code } });

			// Проверка на повторное использование
			const usedByUser = await prisma.user.findFirst({
				where: { promoCodeId: promoCodeRecord?.id ?? 0 }
			});
			if (usedByUser) {
				return res
					.status(400)
					.json({ success: false, message: "Вы уже использовали промокод" });
			}

			if (
				!promoCodeRecord ||
				!promoCodeRecord.active ||
				(promoCodeRecord.expiresAt && promoCodeRecord.expiresAt < new Date())
			) {
				return res
					.status(400)
					.json({ success: false, message: "Промокод недействителен" });
			}

			if (
				promoCodeRecord.usageLimit &&
				promoCodeRecord.usedCount >= promoCodeRecord.usageLimit
			) {
				return res
					.status(400)
					.json({ success: false, message: "Промокод использован" });
			}
		}

		const hashed = await hashPassword(password);
		const user = await prisma.user.create({
			data: {
				email,
				password: hashed,
				name,
				subscriptionStatus: "inactive",
				promoCodeId: promoCodeRecord?.id ?? null,
			},
		});

		if (!user) {
			return res
				.status(401)
				.json({ success: false, message: "Пользователь не найден" });
		}

		if (promoCodeRecord) {
			await prisma.promoCode.update({
				where: { id: promoCodeRecord.id },
				data: { usedCount: { increment: 1 } },
			});

			// Применяем бонусы промокода
			if (promoCodeRecord.customType === "trial" && promoCodeRecord.bonusDays) {
				const now = new Date();
				const newEnd = user.subscriptionEndAt && user.subscriptionEndAt > now
					? new Date(user.subscriptionEndAt)
					: now;
				newEnd.setDate(newEnd.getDate() + promoCodeRecord.bonusDays);

				await prisma.user.update({
					where: { id: user.id },
					data: { 
						subscriptionEndAt: newEnd,
						subscriptionStatus: "active"
					},
				});
			}
		}

		await sendVerificationEmail({
			...user,
			subscriptionStatus: user.subscriptionStatus ?? undefined,
			yooPaymentId: user.yooPaymentId ?? undefined,
		});

		const accessToken = generateAccessToken({ userId: user.id });
		const refreshToken = generateRefreshToken({ userId: user.id });

		await prisma.user.update({
			where: { id: user.id },
			data: { refreshToken },
		});

		setRefreshCookie(res, refreshToken);

		return res.json({
			success: true,
			message: "Вы успешно зарегистрировались! Проверьте почту",
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				subscriptionStatus: user.subscriptionStatus ?? undefined,
				promoCodeId: promoCodeRecord?.id ?? null,
				yooSubscriptionId: user.yooSubscriptionId
			},
			accessToken,
		});
	} catch (e) {
		console.error(e);
		return res.status(500).json({ success: false, message: "Ошибка сервера" });
	}
};

export const loginUser = async (req: Request, res: Response) => {
	const { email, password } = req.body;
	if (!email || !password) {
		return res.status(400).json({ success: false, message: "Email и пароль обязательны" });
	}

	try {
		const user = await prisma.user.findUnique({ where: { email } });

		if (!user) {
			return res.status(401).json({ success: false, message: "Неверный email или пароль" });
		}

		const valid = await comparePassword(password, user.password);
		if (!valid) {
			return res.status(401).json({ success: false, message: "Неверный email или пароль" });
		}

		const accessToken = generateAccessToken({ userId: user.id });
		const refreshToken = generateRefreshToken({ userId: user.id });

		await prisma.user.update({
			where: { id: user.id },
			data: { refreshToken },
		});

		setRefreshCookie(res, refreshToken);

		return res.json({
			success: true,
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				subscriptionStatus: user.subscriptionStatus ?? undefined,
				emailVerified: user.emailVerified,
				yooSubscriptionId: user.yooSubscriptionId,
				subscriptionEndAt: user.subscriptionEndAt
			},
			accessToken,
		});
	} catch (e) {
		console.error(e);
		return res.status(500).json({ success: false, message: "Ошибка сервера" });
	}
};

export const refreshToken = async (req: Request, res: Response) => {
	const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

	if (!refreshToken) {
		return res.status(400).json({ success: false, message: "Refresh токен не найден в cookie" });
	}

	try {
		const payload = jwt.verify(refreshToken, REFRESH_SECRET) as { userId: number };

		const user = await prisma.user.findUnique({ where: { id: payload.userId } });
		if (!user || user.refreshToken !== refreshToken) {
			return res.status(401).json({ success: false, message: "Неверный refresh токен" });
		}

		const newAccessToken = generateAccessToken({ userId: user.id });
		const newRefreshToken = generateRefreshToken({ userId: user.id });

		await prisma.user.update({
			where: { id: user.id },
			data: { refreshToken: newRefreshToken },
		});

		setRefreshCookie(res, newRefreshToken);

		return res.json({ success: true, accessToken: newAccessToken });
	} catch (e) {
		return res.status(401).json({ success: false, message: "Просроченный или неверный refresh токен" });
	}
};

export const verifyEmail = async (req: Request, res: Response) => {
	const token = req.query.token as string;
	const baseUrl = process.env.BASE_URL || "http://localhost:5173";

	if (!token) {
		return res.redirect(`${baseUrl}/email-confirmed?msg=empty`);
	}

	try {
		const record = await prisma.emailVerification.findUnique({ where: { token } });

		if (!record || record.expiresAt < new Date()) {
			return res.redirect(`${baseUrl}/email-confirmed?msg=expired`);
		}

		await prisma.user.update({
			where: { id: record.userId },
			data: { emailVerified: true },
		});

		await prisma.emailVerification.delete({ where: { token } });

		return res.redirect(`${baseUrl}/email-confirmed?msg=success`);
	} catch (e) {
		console.error(e);
		return res.status(500).json({ error: "Ошибка сервера" });
	}
};

export const logoutUser = async (req: Request, res: Response) => {
	res.clearCookie(REFRESH_COOKIE_NAME, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "strict",
		path: "/",
	});

	return res.status(200).json({ success: true, message: "Выход выполнен" });
};

export const checkAccess = async (req: AuthRequest, res: Response) => {
	try {
		const user = req.user;

		if (!user) {
			return res.status(401).json({ success: false, message: "Пользователь не найден", user: null });
		}

		return res.status(200).json({
			success: true,
			message: "Доступ разрешён",
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				subscriptionStatus: user.subscriptionStatus ?? undefined,
				emailVerified: user.emailVerified,
			},
		});
	} catch (error) {
		console.error("Ошибка проверки доступа:", error);
		return res.status(500).json({ success: false, message: "Внутренняя ошибка сервера", user: null });
	}
};

export const getUser = async (req: AuthRequest, res: Response) => {
	try {
		const user = req.user;

		if (!user) {
			return res.status(401).json({ success: false, message: "Пользователь не найден", user: null });
		}

		return res.status(200).json({
			success: true,
			message: "Доступ разрешён",
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				subscriptionStatus: user.subscriptionStatus ?? undefined,
				emailVerified: user.emailVerified,
				yooSubscriptionId: user.yooSubscriptionId,
				subscriptionEndAt: user.subscriptionEndAt
			},
		});
	} catch (error) {
		console.error("Ошибка проверки доступа:", error);
		return res.status(500).json({ success: false, message: "Внутренняя ошибка сервера", user: null });
	}
};

export const resendEmail = async (req: AuthRequest, res: Response) => {
	try {
		const user = req.user;

		if (!user) {
			return res.status(401).json({ success: false, message: "Пользователь не найден" });
		}

		await sendVerificationEmail(user);

		return res.status(200).json({ success: true, message: "Письмо отправлено" });
	} catch (error) {
		console.error("Ошибка проверки доступа:", error);
		return res.status(500).json({ success: false, message: "Ошибка в отправке почты" });
	}
};
