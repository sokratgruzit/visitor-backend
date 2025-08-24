import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

import authRouter from "./routes/auth";
import constructorRouter from "./routes/constructor";
import paymentRouter from "./routes/payment";
import promoRouter from "./routes/promo";
import votingRouter from "./routes/voting";
import animationsRouter from "./routes/animations";

dotenv.config();

const app = express();
app.use(cors({
	origin: "http://localhost:5173", // <— точно укажи адрес фронта
	credentials: true,               // <— разрешить куки и заголовки авторизации
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/constructor", constructorRouter);
app.use("/api/payment", paymentRouter);
app.use("/app/promo", promoRouter);
app.use("/api/votings", votingRouter);
app.use("/api/animations", animationsRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
	console.log(`Server started on http://localhost:${PORT}`);
});
