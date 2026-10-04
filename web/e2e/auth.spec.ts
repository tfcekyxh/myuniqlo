import { test, expect, type Page } from "@playwright/test";

const USERNAME = "admin";
const PASSWORD = "admin123";

/** 走真实 UI 完成一次登录 */
async function login(page: Page, password: string = PASSWORD) {
  await page.getByLabel("用户名").fill(USERNAME);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();
}

test.describe("登录流程", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("用户名默认预填为 admin", async ({ page }) => {
    await expect(page.getByLabel("用户名")).toHaveValue("admin");
    await expect(page.getByLabel("密码")).toHaveValue("");
  });

  test("页面不提供注册入口", async ({ page }) => {
    await expect(page.getByRole("tab", { name: "注册" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "注册" })).toHaveCount(0);
  });

  test("密码错误时给出提示且不进入首页", async ({ page }) => {
    await login(page, "definitely-wrong");
    await expect(page.getByText("用户名或密码错误")).toBeVisible();
    await expect(page.getByRole("button", { name: "登录" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /你好/ })).toHaveCount(0);
  });

  test("正确密码可登录并看到概览", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("heading", { name: "你好，admin" })).toBeVisible();
    await expect(page.getByRole("button", { name: "登出" })).toBeVisible();
    // 用 exact 避免同时匹配到「地点与衣物管理将在下一阶段接入」这句提示
    await expect(page.getByText("地点", { exact: true })).toBeVisible();
    await expect(page.getByText("衣物", { exact: true })).toBeVisible();
  });

  test("刷新页面后保持登录态", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("heading", { name: "你好，admin" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "你好，admin" })).toBeVisible();
  });

  test("登出后回到登录页，且刷新不会自动恢复", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("heading", { name: "你好，admin" })).toBeVisible();

    await page.getByRole("button", { name: "登出" }).click();
    await expect(page.getByRole("button", { name: "登录" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("button", { name: "登录" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /你好/ })).toHaveCount(0);
  });
});
