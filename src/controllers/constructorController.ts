import { Request, Response } from "express";
import { prisma } from "../../prisma/client";
import { supabase } from "../services/supabaseClient";

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

type LandingData = {
	components: any[];
	[key: string]: any;
};

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

	if (!userId) {
		return res.status(401).json({ success: false, message: "Неавторизованный пользователь" });
	}

	const slug = landingData.slug;
	if (!slug || typeof slug !== "string") {
		return res.status(400).json({ success: false, message: "Неверный slug" });
	}

	const userLanding = await prisma.landing.findUnique({ where: { userId } });
	if (!userLanding || userLanding.slug !== slug) {
		return res.status(400).json({ success: false, message: "Нельзя менять slug" });
	}

	try {
		if (Array.isArray(landingData.data.components)) {
			// Считаем уже сохранённые картинки (есть fileUrl, нет fileBase64)
			const existingImages = landingData.data.components.filter(
				(c: any) => c.type === "image" && c.fileUrl && !c.fileBase64
			).length;

			// Считаем новые картинки (есть fileBase64)
			const newImages = landingData.data.components.filter(
				(c: any) => c.type === "image" && c.fileBase64
			).length;

			if (existingImages + newImages > 10) {
				return res.status(400).json({ success: false, message: "Максимум 10 изображений" });
			}

			for (const component of landingData.data.components) {
                if (component.type === "image" && component.fileBase64) {
                    if (!component.id) {
                        return res.status(400).json({ success: false, message: "Для картинки нужен id компонента" });
                    }

                    // Удаляем старый файл по URL
                    if (component.fileUrl) {
                        const oldPath = component.fileUrl.split("/storage/v1/object/public/visitor/")[1];
                    
                        if (oldPath) {
                            const { error: removeError } = await supabase.storage.from("visitor").remove([oldPath]);
                            if (removeError) {
                                console.error("Ошибка удаления старого файла:", removeError);
                            }
                        }
                    }

                    const base64Header = component.fileBase64.match(/^data:(image\/(png|jpeg));base64,/);
                    const contentType = base64Header ? base64Header[1] : "image/jpeg";
                    const ext = base64Header ? (base64Header[2] === "jpeg" ? "jpg" : base64Header[2]) : "jpg";

                    const fileName = `user-${userId}/${component.id}-${Date.now()}.${ext}`;

                    const base64Data = component.fileBase64.replace(/^data:.+;base64,/, "");
                    const buffer = Buffer.from(base64Data, "base64");

                    const { error: uploadError } = await supabase.storage
                    .from("visitor")
                    .upload(fileName, buffer, { contentType });

                    if (uploadError) {
                        console.error("Ошибка загрузки файла в Supabase:", uploadError);
                        return res.status(500).json({ success: false, message: "Ошибка загрузки файла" });
                    }

                    const { data } = supabase.storage.from("visitor").getPublicUrl(fileName);
                    component.fileUrl = data.publicUrl;
                    component.fileBase64 = "";
                }
            }
		}

		await prisma.landing.update({
			where: { userId },
			data: { data: landingData.data },
		});

		res.status(200).json({ success: true, data: landingData.data, message: "Лендинг успешно сохранен" });
	} catch (err) {
		console.error(err);
		res.status(500).json({ success: false, message: "Ошибка при сохранении лендинга" });
	}
};

export const deleteLandingComponent = async (req: AuthRequest, res: Response) => {
	const userId = req.user?.id;
	const { componentId } = req.params; // id компонента, который удаляем

	if (!userId) {
		return res.status(401).json({ success: false, message: "Неавторизованный пользователь" });
	}

	try {
		// Находим лендинг пользователя
		const userLanding = await prisma.landing.findUnique({ where: { userId } });
		if (!userLanding) {
			return res.status(404).json({ success: false, message: "Лендинг не найден" });
		}

		let landingData = userLanding.data as unknown as LandingData;
		if (!landingData?.components) {
			return res.status(400).json({ success: false, message: "Нет компонентов для удаления" });
		}

		// Находим компонент
		const componentIndex = landingData.components.findIndex((c: any) => c.id === componentId);
		if (componentIndex === -1) {
			return res.status(404).json({ success: false, message: "Компонент не найден" });
		}

		const component = landingData.components[componentIndex];

		// Если это картинка — удаляем файл из Supabase
		if (component.type === "image" && component.fileUrl) {
			const storagePath = component.fileUrl.split("/storage/v1/object/public/visitor/")[1];
			if (storagePath) {
				const { error: removeError } = await supabase.storage.from("visitor").remove([storagePath]);
				if (removeError) {
					console.error("Ошибка удаления файла из Supabase:", removeError);
					return res.status(500).json({ success: false, message: "Ошибка при удалении файла" });
				}
			}
		}

		// Удаляем компонент из массива
		landingData.components.splice(componentIndex, 1);

		// Сохраняем изменения
		await prisma.landing.update({
			where: { userId },
			data: { data: landingData },
		});

		return res.status(200).json({ success: true, message: "Компонент удален", data: landingData });
	} catch (err) {
		console.error(err);
		res.status(500).json({ success: false, message: "Ошибка при удалении компонента" });
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

		if (landing.user.subscriptionStatus === "inactive" || !landing.user.emailVerified)
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
