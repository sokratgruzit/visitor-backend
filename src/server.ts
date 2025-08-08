import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

import authRouter from "./routes/auth";
import constructorRouter from "./routes/constructor";

dotenv.config();

const app = express();
app.use(cors({
    origin: "http://localhost:5173", // <— точно укажи адрес фронта
    credentials: true,               // <— разрешить куки и заголовки авторизации
}));
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/constructor", constructorRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
});
