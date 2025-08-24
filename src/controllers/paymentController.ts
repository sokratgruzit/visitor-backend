import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { addMonths } from "date-fns";

const prisma = new PrismaClient();

const YCASSA_SHOP_ID = process.env.YCASSA_SHOP_ID || "";
const YCASSA_SECRET_KEY = process.env.YCASSA_SECRET_KEY || "";
const BASE_URL = process.env.BASE_URL || "http://localhost:5173";

interface AuthRequest extends Request {
    user?: {
        id: number;
        email: string;
        name?: string | null;
        password: string;
        subscriptionStatus?: string;
        yooPaymentId?: string;
        yooSubscriptionId?: string;
        refreshToken?: string | null;
        promoCodeId?: number | null;
        emailVerified: boolean;
        createdAt: Date;
        updatedAt: Date;
    };
}

interface YooPaymentResponse {
    id: string;
    confirmation?: { 
        confirmation_url?: string;
        type?: string;
        return_url?: string;
    };
    message?: string;
    status?: string;
    payment_method?: { 
        id: string;
        type?: string;
        saved?: boolean;
    };
}

// Создание платежа и сохранение возможности автоплатежа
export const createPayment = async (req: AuthRequest, res: Response) => {
	const user = req.user;

	if (!user) return res.status(401).json({ success: false, message: "Пользователь не найден" });

	const { product, amount, targetId } = req.body;
	if (!product || !amount) return res.status(400).json({ success: false, message: "Не указаны обязательные данные" });

	try {
		let finalAmount = amount;

		// Промокод
		if (user.promoCodeId) {
			const promo = await prisma.promoCode.findUnique({ where: { id: user.promoCodeId } });
			if (promo?.discountPct) {
				finalAmount = amount * (1 - promo.discountPct / 100);
			}
		}

		let rUrl = "/";

		if (product === "subscription") {
			rUrl = "/dashboard/account";
		}
		
		if (product === "animation") {
			rUrl = "/dashboard";
		}

		if (product === "voting") {
			rUrl = "/dashboard/voting";
		}

		const paymentData = {
			amount: { value: finalAmount.toFixed(2), currency: "RUB" },
			confirmation: { type: "redirect", return_url: `${BASE_URL}${rUrl}` },
			capture: true,
			description: `Цель платежа: ${product}`,
			payment_method_data: { type: "bank_card" },
			save_payment_method: true,
			metadata: { userId: user.id.toString(), product, targetId: targetId?.toString() },
		}

		// Идемпотентность
		const idempotenceKey = crypto.randomUUID()

		const response = await fetch("https://api.yookassa.ru/v3/payments", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": "Basic " + Buffer.from(`${YCASSA_SHOP_ID}:${YCASSA_SECRET_KEY}`).toString("base64"),
				"Idempotence-Key": idempotenceKey,
			},
			body: JSON.stringify(paymentData),
		})

		const data: YooPaymentResponse = await response.json()

		if (data.confirmation?.confirmation_url) {
			// Подписка
			if (product === "subscription") {
				await prisma.user.update({
					where: { id: user.id },
					data: {
						subscriptionStatus: "pending",
						yooPaymentId: data.id,
						yooSubscriptionId: data.payment_method?.id || null,
					},
				})
			}

			if (product === "animation" && targetId) {
				await prisma.animation.update({ 
					where: { id: Number(targetId) },
					data: {
						status: "development"
					}
				});	
			}

			// Голосование
			if (product === "voting" && targetId) {
				// Сохраняем черновик голоса (будет активирован в webhook "payment.succeeded")
				await prisma.vote.create({
					data: {
						userId: user.id,
						votingId: Number(targetId),
						amount: finalAmount,
						createdAt: new Date(),
					},
				});
			}

			return res.json({
				success: true,
				confirmationUrl: data.confirmation.confirmation_url,
				finalAmount,
			});
		} else {
			return res.json({ success: false, message: data.message || "Ошибка создания платежа" })
		}
	} catch (err) {
		console.error("Ошибка при создании платежа:", err)
		return res.status(500).json({ success: false, message: "Ошибка сервера" })
	}
}

// Webhook YooKassa для автоплатежей
export const yookassaWebhook = async (req: Request, res: Response) => {
	const event = req.body;

	const paymentId = event.object?.id;
	const product = event.object?.metadata?.product;
	const targetId = event.object?.metadata?.targetId;

	if (!paymentId) return res.status(400).json({ success: false, message: "Платеж не найден" });

	// Найдем пользователя по платежу, если это подписка
	let user;
	if (product === "subscription") {
		user = await prisma.user.findFirst({ where: { yooPaymentId: paymentId } });
		if (!user) return res.status(404).json({ success: false, message: "Пользователь не найден" });

		if (event.event === "payment.succeeded") {
			await prisma.user.update({
				where: { id: user.id },
				data: {
					subscriptionStatus: "active",
					subscriptionEndAt: addMonths(new Date(event.object.captured_at), 1),
					yooSubscriptionId: event.object.payment_method?.id || undefined,
				},
			});
		}

		if (event.event === "payment.failed") {
			await prisma.user.update({
				where: { id: user.id },
				data: { subscriptionStatus: "inactive" },
			});
		}
	}

	// Голосование
	if (product === "voting" && targetId) {
		const voteUserId = Number(event.object.metadata.userId);
		const votingId = Number(targetId);

		const vote = await prisma.vote.findFirst({
			where: { userId: voteUserId, votingId },
			orderBy: { createdAt: "desc" },
		});

		if (vote && event.event === "payment.succeeded") {
			await prisma.voting.update({
				where: { id: votingId },
				data: { amount: { increment: vote.amount } },
			});
		}

		// при failed платежах агрегатную сумму менять не нужно
	}

	res.status(200).json({ success: true, message: "Webhook обработан" });
};

// Проверка статуса платежа (можно использовать на фронте)
export const checkPaymentStatus = async (req: AuthRequest, res: Response) => {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, message: "Пользователь не найден" });
    if (!user.yooPaymentId) return res.status(400).json({ success: false, message: "Нет платежа для проверки" });

    try {
        const response = await fetch(`https://api.yookassa.ru/v3/payments/${user.yooPaymentId}`, {
            headers: {
                "Authorization": "Basic " + Buffer.from(`${YCASSA_SHOP_ID}:${YCASSA_SECRET_KEY}`).toString("base64"),
            },
        });

        const data: YooPaymentResponse = await response.json();

        if (data.status === "succeeded") {
            await prisma.user.update({
                where: { id: user.id },
                data: { subscriptionStatus: "active", subscriptionEndAt: addMonths(new Date(), 1) },
            });
        }

        return res.json({ success: true, status: user.subscriptionStatus, data });
    } catch (err) {
        console.error("Ошибка проверки платежа:", err);
        return res.status(500).json({ success: false, message: "Ошибка сервера" });
    }
};

export const getUserPaymentHistory = async (req: AuthRequest, res: Response) => {
	const user = req.user;
	if (!user) return res.status(401).json({ success: false, message: "Пользователь не найден" });

	try {
		const response = await fetch(`https://api.yookassa.ru/v3/payments?limit=50`, {
			headers: {
				"Authorization": "Basic " + Buffer.from(`${YCASSA_SHOP_ID}:${YCASSA_SECRET_KEY}`).toString("base64"),
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			const errData = await response.json();
			return res.status(response.status).json({ success: false, message: errData.message || "Ошибка получения истории платежей" });
		}

		const data = await response.json();

		// фильтруем по userId в metadata
		const userPayments = data.items?.filter((p: any) => p.metadata?.userId === user.id.toString()) || [];

		return res.json({ success: true, payments: userPayments });
	} catch (err) {
		console.error("Ошибка получения истории платежей:", err);
		return res.status(500).json({ success: false, message: "Ошибка сервера" });
	}
};

export const cancelSubscription = async (req: AuthRequest, res: Response) => {
	const user = req.user;
    
	if (!user || !user.yooSubscriptionId) 
		return res.status(400).json({ success: false, message: "Нет активного метода автоплатежа" });

	try {
		// Удаляем сохранённый метод оплаты
		const response = await fetch(`https://api.yookassa.ru/v3/payment_methods/${user.yooSubscriptionId}`, {
			method: "DELETE",
			headers: {
				"Authorization": "Basic " + Buffer.from(`${YCASSA_SHOP_ID}:${YCASSA_SECRET_KEY}`).toString("base64"),
				"Content-Type": "application/json",
			},
		});

		const data = await response.json();

		if (response.ok) {
			await prisma.user.update({
				where: { id: user.id },
				data: { subscriptionStatus: "inactive", yooSubscriptionId: null },
			});
			return res.json({ success: true, message: "Автоплатёж отменён, подписка деактивирована" });
		} else {
			console.error("Ошибка отмены автоплатежа:", data);
			return res.status(400).json({ success: false, message: data.message || "Ошибка отмены автоплатежа" });
		}
	} catch (err) {
		console.error(err);
		return res.status(500).json({ success: false, message: "Ошибка сервера" });
	}
};

export const resumeSubscription = async (req: AuthRequest, res: Response) => {
    const user = req.user;
    if (!user || !user.yooSubscriptionId) return res.status(400).json({ success: false, message: "Нет подписки для возобновления" });

    try {
        const response = await fetch(`https://api.yookassa.ru/v3/subscriptions/${user.yooSubscriptionId}/resume`, {
            method: "POST",
            headers: {
                "Authorization": "Basic " + Buffer.from(`${YCASSA_SHOP_ID}:${YCASSA_SECRET_KEY}`).toString("base64"),
            },
        });

        if (response.ok) {
            await prisma.user.update({
                where: { id: user.id },
                data: { subscriptionStatus: "active", subscriptionEndAt: addMonths(new Date(), 1) },
            });
            return res.json({ success: true, message: "Подписка возобновлена" });
        } else {
            const data = await response.json();
            return res.status(400).json({ success: false, message: data.message || "Ошибка возобновления подписки" });
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Ошибка сервера" });
    }
};

