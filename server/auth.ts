import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import express, { type NextFunction, type Request, type Response } from "express";
import type { User } from "@prisma/client";
import { prisma } from "./prisma.ts";

// 让 req.user 在整个 Express 应用中带类型
declare module "express-serve-static-core" {
  interface Request {
    user?: User;
  }
}

const SCRYPT_KEY_LEN = 64;
const TOKEN_EXPIRES_IN = "30d";

function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("缺少 JWT_SECRET：请在 server/.env 中配置后重启服务");
  }
  return secret;
}

const JWT_SECRET = requireJwtSecret();

/** 生成随机盐并用 scrypt 派生密码哈希 */
export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEY_LEN).toString("hex");
  return { salt, hash };
}

/** 常量时间比对，避免时序侧信道 */
export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const actual = Buffer.from(
    crypto.scryptSync(password, salt, SCRYPT_KEY_LEN).toString("hex"),
    "hex",
  );
  const expected = Buffer.from(expectedHash, "hex");
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

export function signToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN });
}

/** 校验 Authorization: Bearer <token>，通过后在 req.user 上挂用户记录 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const raw = req.headers.authorization ?? "";
  const token = raw.startsWith("Bearer ") ? raw.slice(7).trim() : "";

  if (!token) {
    res.status(401).json({ error: "未登录" });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      res.status(401).json({ error: "登录已失效，请重新登录" });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "登录已失效，请重新登录" });
  }
}

function publicUser(user: User): { id: number; username: string } {
  return { id: user.id, username: user.username };
}

const router = express.Router();

/** POST /api/login —— 本项目为单用户，不提供注册入口，账号由 seed 脚本初始化 */
router.post("/login", async (req: Request, res: Response) => {
  const { username, password } = req.body ?? {};
  const name = String(username ?? "").trim();
  const pwd = String(password ?? "");

  if (!name || !pwd) {
    res.status(400).json({ error: "请输入用户名和密码" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { username: name } });
  // 用户不存在与密码错误返回同一文案，避免暴露用户名是否存在
  if (!user || !verifyPassword(pwd, user.passwordSalt, user.passwordHash)) {
    res.status(401).json({ error: "用户名或密码错误" });
    return;
  }

  res.json({ token: signToken(user.id), user: publicUser(user) });
});

/** GET /api/me —— 当前登录用户 + 概览统计 */
router.get("/me", authMiddleware, async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: "未登录" });
    return;
  }

  const [locations, clothes] = await Promise.all([
    prisma.location.count({ where: { userId: user.id } }),
    prisma.clothing.count({ where: { userId: user.id } }),
  ]);

  res.json({
    user: publicUser(user),
    stats: { locations, clothes },
  });
});

export default router;
