import "dotenv/config";
import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import { prisma } from "./prisma.ts";
import authRouter from "./auth.ts";
import locationsRouter from "./routes/locations.ts";
import clothesRouter from "./routes/clothes.ts";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

// 健康检查：同时验证数据库连接
app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "connected", time: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ status: "error", db: "disconnected", message: String(e) });
  }
});

// 认证：/api/login、/api/me（单用户，无注册入口）
app.use("/api", authRouter);

// 地点管理：/api/locations
app.use("/api", locationsRouter);

// 衣物管理：/api/clothes、/api/locations/:id/clothes
app.use("/api", clothesRouter);

// 统一返回 JSON 错误，避免前端拿到 HTML 报错页
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // multer 的错误（如文件超过上限）一律按 400 处理
  const isUploadError = err?.name === "MulterError";
  const status = isUploadError
    ? 400
    : typeof err?.status === "number"
      ? err.status
      : 500;

  const message = isUploadError
    ? err?.code === "LIMIT_FILE_SIZE"
      ? "照片过大，请上传 10MB 以内的图片"
      : "照片上传失败"
    : err?.message ?? "服务器内部错误";

  res.status(status).json({ error: message });
};
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[closet-server] listening on http://localhost:${PORT}`);
});
