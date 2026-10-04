import "dotenv/config";
import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import { prisma } from "./prisma.ts";
import authRouter from "./auth.ts";
import locationsRouter from "./routes/locations.ts";

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

// 占位：后续阶段在此挂载 /api/clothes 路由

// 请求体 JSON 解析失败时也返回 JSON，避免前端拿到 HTML 报错页
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = typeof err?.status === "number" ? err.status : 500;
  res.status(status).json({ error: err?.message ?? "服务器内部错误" });
};
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[closet-server] listening on http://localhost:${PORT}`);
});
