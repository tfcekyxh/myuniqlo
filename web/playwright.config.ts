import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173";

export default defineConfig({
  testDir: "./e2e",
  // 单用户应用 + 本机 Chrome 资源有限，串行执行更稳定（并行曾导致登录请求超时）
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    // 产品只面向手机端，e2e 统一用 iPhone 13 的移动视口
    // iPhone 13 描述符默认走 webkit，这里显式改为 chromium + 本机 Chrome，
    // 这样无需下载 Playwright 自带浏览器，直接用已安装的 Google Chrome
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        channel: "chrome",
      },
    },
  ],
  // 前置条件：后端与前端需已在本地启动（Playwright 不再自行拉起，避免端口冲突）
  //   1) cd server && bun run dev        → http://127.0.0.1:3000
  //   2) cd web     && bun run dev -- --host → http://127.0.0.1:5173
  // 可用 E2E_BASE_URL 环境变量指向其他地址（如手机局域网地址）
});
