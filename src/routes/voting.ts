import { Router } from "express";
import {
  createVoting,
  getVotings,
  getVotingById,
  updateVoting,
  deleteVoting,
} from "../controllers/votingController";

import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

// Создание голосования
router.post("/", authMiddleware, createVoting);

// Получение всех голосований
router.get("/", getVotings);

// Получение одного голосования по id
router.get("/:id", getVotingById);

// Обновление голосования
router.patch("/:id", authMiddleware, updateVoting);

// Удаление голосования
router.delete("/:id", authMiddleware, deleteVoting);

export default router;
