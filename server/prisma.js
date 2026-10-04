import { PrismaClient } from "@prisma/client";

// 单例 PrismaClient，避免开发热重载时反复建立连接
export const prisma = new PrismaClient();
