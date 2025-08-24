import { Request, Response } from "express";
import { prisma } from "../../prisma/client";
import { supabase } from "../services/supabaseClient";

interface AuthRequest extends Request {
	user?: {
		id: number;
		email: string;
		name?: string | null;
		password: string;
        isAdmin?: boolean;
		subscriptionStatus?: string;
		emailVerified: boolean;
		promoCodeId?: number | null;
		yooSubscriptionId?: string | null;
		subscriptionEndAt?: string | null;
		createdAt: Date;
		updatedAt: Date;
	};
}

// Создать анимацию
export const createAnimation = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { name, status, data, fileBase64 } = req.body;

    if (!userId) return res.status(401).json({ success: false, message: "Неавторизованный пользователь" });
    if (!name) return res.status(400).json({ success: false, message: "Название обязательно" });
    
    const exists = await prisma.animation.findFirst({
        where: { name },
    });

    if (exists) {
        return res.status(400).json({ success: false, message: "Анимация с таким именем уже существует" });
    }
    
    let fileUrl: string | null = null;

    try {
        if (fileBase64) {
            const base64Header = fileBase64.match(/^data:(image\/(png|jpeg));base64,/);
            const contentType = base64Header ? base64Header[1] : "image/jpeg";
            const ext = base64Header ? (base64Header[2] === "jpeg" ? "jpg" : base64Header[2]) : "jpg";

            const fileName = `animations/user-${userId}/${Date.now()}.${ext}`;
            const base64Data = fileBase64.replace(/^data:.+;base64,/, "");
            const buffer = Buffer.from(base64Data, "base64");

            const { error: uploadError } = await supabase.storage
                .from("visitor")
                .upload(fileName, buffer, { contentType });

            if (uploadError) {
                console.error("Ошибка загрузки файла:", uploadError);
                return res.status(500).json({ success: false, message: "Ошибка загрузки файла" });
            }

            const { data: publicData } = supabase.storage.from("visitor").getPublicUrl(fileName);
            fileUrl = publicData.publicUrl;
        }

        const animation = await prisma.animation.create({
            data: {
                userId,
                name,
                status: status || "moderation",
                data: data || {},
                fileUrl,
            },
        });

        return res.status(201).json({ success: true, animation, message: "Анимация успешно создана" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Ошибка при создании анимации" });
    }
};

// Обновить анимацию
export const updateAnimation = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { id } = req.params;
    const { name, status, data, fileBase64 } = req.body;

    try {
        const animation = await prisma.animation.findUnique({ where: { id: Number(id) } });
        if (!animation) {
            return res.status(404).json({ success: false, message: "Анимация не найдена" });
        }
        
        // Проверка прав
        if (animation.userId && animation.userId !== userId) {
            return res.status(403).json({ success: false, message: "Нет прав на редактирование этой анимации" });
        }

        let fileUrl = animation.fileUrl;

        // Если статус меняем на production → удалить файл
        if (status === "production" && fileUrl) {
            const oldPath = fileUrl.split("/storage/v1/object/public/visitor/")[1];
            if (oldPath) {
                const { error: removeError } = await supabase.storage.from("visitor").remove([oldPath]);
                if (removeError) {
                    console.error("Ошибка удаления файла при переводе в production:", removeError);
                } else {
                    fileUrl = null; // файл удалили
                }
            }
        }

        // Если прилетает новая картинка
        if (fileBase64 && status !== "production") {
            if (fileUrl) {
                const oldPath = fileUrl.split("/storage/v1/object/public/visitor/")[1];
                if (oldPath) {
                    const { error: removeError } = await supabase.storage.from("visitor").remove([oldPath]);
                    if (removeError) console.error("Ошибка удаления старого файла:", removeError);
                }
            }

            const base64Header = fileBase64.match(/^data:(image\/(png|jpeg));base64,/);
            const contentType = base64Header ? base64Header[1] : "image/jpeg";
            const ext = base64Header ? (base64Header[2] === "jpeg" ? "jpg" : base64Header[2]) : "jpg";

            const fileName = `animations/user-${userId ?? "anonymous"}/${id}-${Date.now()}.${ext}`;
            const base64Data = fileBase64.replace(/^data:.+;base64,/, "");
            const buffer = Buffer.from(base64Data, "base64");

            const { error: uploadError } = await supabase.storage
                .from("visitor")
                .upload(fileName, buffer, { contentType });

            if (uploadError) {
                console.error("Ошибка загрузки файла:", uploadError);
                return res.status(500).json({ success: false, message: "Ошибка загрузки файла" });
            }

            const { data: publicData } = supabase.storage.from("visitor").getPublicUrl(fileName);
            fileUrl = publicData.publicUrl;
        }

        const updated = await prisma.animation.update({
            where: { id: Number(id) },
            data: {
                name: name ?? animation.name,
                status: status ?? animation.status,
                data: data ?? animation.data,
                fileUrl,
                userId: userId ?? animation.userId,
            },
        });

        return res.status(200).json({ success: true, animation: updated, message: "Анимация успешно обновлена" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Ошибка при обновлении анимации" });
    }
};

// Получить анимацию по id
export const getAnimationById = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id; // может быть undefined для публичных

    try {
        const animation = await prisma.animation.findUnique({ where: { id: Number(id) } });
        if (!animation) {
            return res.status(404).json({ success: false, message: "Анимация не найдена" });
        }

        // Проверка прав
        if (animation.userId && animation.userId !== userId) {
            return res.status(403).json({ success: false, message: "Нет доступа к этой анимации" });
        }

        return res.status(200).json({ success: true, animation, message: "Анимация найдена" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Ошибка при получении анимации" });
    }
};

// Получить все анимации
export const getAllAnimations = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    try {
        const animations = await prisma.animation.findMany({
            where: {
                OR: [
                    { userId: null },        
                    { userId: userId }, 
                ],
            },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                userId: true,
                name: true,
                status: true,
                fileUrl: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return res.status(200).json({ success: true, animations, message: "Анимации получены" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Ошибка при получении анимаций" });
    }
};

// Удалить анимацию
export const deleteAnimation = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin; // если есть поле isAdmin
    const { id } = req.params;

    try {
        const animation = await prisma.animation.findUnique({ where: { id: Number(id) } });
        if (!animation) {
            return res.status(404).json({ success: false, message: "Анимация не найдена" });
        }

        // Проверка прав на удаление
        if (animation.userId && animation.userId !== userId && (!isAdmin || animation.status === "moderation")) {
            return res.status(403).json({ success: false, message: "Нет прав на удаление этой анимации" });
        }

        if (!animation.userId && !isAdmin) {
            return res.status(403).json({ success: false, message: "Публичную анимацию может удалить только админ" });
        }

        // Удаляем файл из Supabase
        if (animation.fileUrl) {
            const storagePath = animation.fileUrl.split("/storage/v1/object/public/visitor/")[1];
            if (storagePath) {
                const { error: removeError } = await supabase.storage.from("visitor").remove([storagePath]);
                if (removeError) {
                    console.error("Ошибка удаления файла:", removeError);
                    return res.status(500).json({ success: false, message: "Ошибка при удалении файла" });
                }
            }
        }

        await prisma.animation.delete({ where: { id: Number(id) } });
        return res.status(200).json({ success: true, message: "Анимация удалена" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Ошибка при удалении анимации" });
    }
};

