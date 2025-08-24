import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Создать новое голосование (предложение)
export const createVoting = async (req: Request, res: Response) => {
	const { title, description, creatorId, level, status } = req.body;

	if (!title || !description || !creatorId) {
		return res.status(400).json({ success: false, message: "Нужны title, description, creatorId" });
	}

	try {
		const voting = await prisma.voting.create({
			data: {
				title,
				description,
				creatorId: Number(creatorId),
				// level можно опустить (останется прежнее значение в БД), либо задать дефолт кодом:
				level: typeof level === "number" ? level : 0,
				// amount НЕ передаём — сработает @default(0)
				status: typeof status === "string" ? status : "pending", // если пришёл — используем, иначе дефолт
			},
		});

		return res.status(201).json({ success: true, voting });
	} catch (e) {
		console.error(e);
		return res.status(500).json({ success: false, message: "Ошибка создания голосования" });
	}
};

// Получить все голосования
export const getVotings = async (req: Request, res: Response) => {
	try {
		const page = Number(req.query.page) || 1;
		const limit = Number(req.query.limit) || 10;
		const userId = Number(req.query.userId) || -1;
		const skip = (page - 1) * limit;

		// "Мои" голосования
		const [myVotings, myTotalCount] = await Promise.all([
			prisma.voting.findMany({
				where: { creatorId: userId },
				include: {
					creator: { select: { id: true, name: true, email: true } },
					_count: { select: { votes: true } },
				},
				orderBy: { createdAt: "desc" },
				skip,
				take: limit,
			}),
			prisma.voting.count({ where: { creatorId: userId } }),
		]);
		const myTotalPages = Math.ceil(myTotalCount / limit);

		// Все голосования
		const [allVotings, allTotalCount] = await Promise.all([
			prisma.voting.findMany({
				include: {
					creator: { select: { id: true, name: true, email: true } },
					_count: { select: { votes: true } },
				},
				orderBy: { createdAt: "desc" },
				skip,
				take: limit,
			}),
			prisma.voting.count(),
		]);
		const allTotalPages = Math.ceil(allTotalCount / limit);

		return res.json({
			success: true,
			message: "Предложения успешно получены",
			my: {
				votings: myVotings,
				totalPages: myTotalPages,
				currentPage: page,
				totalCount: myTotalCount,
			},
			all: {
				votings: allVotings,
				totalPages: allTotalPages,
				currentPage: page,
				totalCount: allTotalCount,
			},
		});
	} catch (e) {
		console.error(e);
		return res.status(500).json({ success: false, message: "Ошибка получения списка" });
	}
};

// Получить голосование по id
export const getVotingById = async (req: Request, res: Response) => {
	const { id } = req.params;

	try {
		const voting = await prisma.voting.findUnique({
			where: { id: Number(id) },
			include: {
				creator: { select: { id: true, name: true, email: true } },
				votes: true,
				_count: { select: { votes: true } },
			},
		});

		if (!voting) {
			return res.status(404).json({ success: false, message: "Голосование не найдено" });
		}

		return res.json({ success: true, voting });
	} catch (e) {
		console.error(e);
		return res.status(500).json({ success: false, message: "Ошибка получения голосования" });
	}
};

// Обновить голосование (partial update)
export const updateVoting = async (req: Request, res: Response) => {
	const { id } = req.params;
	const { title, description, level, status } = req.body;

	try {
		const data: any = {};
		if (typeof title === "string") data.title = title;
		if (typeof description === "string") data.description = description;
		if (typeof level === "number") data.level = level;
		if (typeof status === "string") data.status = status;

		// amount намеренно не даём менять руками (это агрегат по голосам)
		const voting = await prisma.voting.update({
			where: { id: Number(id) },
			data,
		});

		return res.json({ success: true, voting });
	} catch (e) {
		console.error(e);
		return res.status(500).json({ success: false, message: "Ошибка обновления голосования" });
	}
};

// Удалить голосование (с безопасной очисткой голосов)
export const deleteVoting = async (req: Request, res: Response) => {
	const { id } = req.params;

	try {
		// Если в схеме нет onDelete: Cascade — чистим явно
		await prisma.vote.deleteMany({ where: { votingId: Number(id) } });
		await prisma.voting.delete({ where: { id: Number(id) } });

		return res.json({ success: true, message: "Голосование удалено" });
	} catch (e) {
		console.error(e);
		return res.status(500).json({ success: false, message: "Ошибка удаления голосования" });
	}
};
