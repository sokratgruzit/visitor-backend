export const adminMiddleware = (req: any, res: any, next: any) => {
    if (!req.user?.isAdmin) {
        return res.status(403).json({ success: false, message: "Доступ запрещён" });
    }
    next();
};
