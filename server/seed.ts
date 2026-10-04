import "dotenv/config";
import { prisma } from "./prisma.ts";
import { hashPassword } from "./auth.ts";

// 本项目为单用户：不开放注册，账号由本脚本初始化
const DEFAULT_USERNAME = "admin";
const DEFAULT_PASSWORD = "admin123";

async function main(): Promise<void> {
  const username = process.env.ADMIN_USERNAME ?? DEFAULT_USERNAME;
  const password = process.env.ADMIN_PASSWORD ?? DEFAULT_PASSWORD;

  const { salt, hash } = hashPassword(password);

  const user = await prisma.user.upsert({
    where: { username },
    update: { passwordSalt: salt, passwordHash: hash },
    create: { username, passwordSalt: salt, passwordHash: hash },
  });

  console.log(`✓ 账号已就绪：${user.username}（id=${user.id}）`);
  console.log(`  登录密码：${password}`);
  console.log("  改密码：修改 .env 的 ADMIN_PASSWORD 后重新运行 bun run seed");
}

main()
  .catch((error: unknown) => {
    console.error("初始化失败：", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
