import { PrismaClient } from "@prisma/client";

// 单例 PrismaClient：开发热重载时复用同一连接，避免连接数暴涨
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
