import crypto from "crypto";
import nodemailer from "nodemailer";

import { prisma } from "../../prisma/client";

interface UserType {
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
}

export async function sendVerificationEmail(user: UserType) {
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 час

    await prisma.emailVerification.create({
        data: {
            token,
            userId: user.id,
            expiresAt: expires,
        },
    });

    const baseUrl = process.env.APP_URL || "http://localhost:4000";
    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;
    const message = `Нажмите по ссылке для подтверждения почты: ${verifyUrl}`;

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    await transporter.sendMail({
        from: `"Your App" <${process.env.SMTP_USER}>`,
        to: user.email,
        subject: "Подтверждение почты",
        text: message,
    });
}
