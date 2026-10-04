import "dotenv/config";
import express from "express";
import cors from "cors";
import { prisma } from "./prisma.js";

const app = express();
const PORT = process.env.PORT || 3000;

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

// 占位：后续阶段在此挂载 /api/auth、/api/locations、/api/clothes 路由
app.listen(PORT, () => {
  console.log(`[closet-server] listening on http://localhost:${PORT}`);
});
