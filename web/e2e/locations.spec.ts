import { test, expect } from "@playwright/test";
import { createLocation, login, resetLocations } from "./helpers.ts";

test.describe("地点管理", () => {
  test.beforeEach(async ({ page, request }) => {
    await resetLocations(request);
    await page.goto("/");
    await login(page);
  });

  test("没有地点时展示空态提示", async ({ page }) => {
    await expect(page.getByText("还没有地点，先建一个吧")).toBeVisible();
  });

  test("新建地点后出现在列表并带衣物数量", async ({ page }) => {
    await page.getByRole("button", { name: "新建地点" }).click();
    await page.getByLabel("名称").fill("主卧衣柜");
    await page.getByLabel("备注（可选）").fill("靠窗那一个");
    await page.getByRole("button", { name: "保存" }).click();

    await expect(page.getByText("主卧衣柜")).toBeVisible();
    await expect(page.getByText("靠窗那一个")).toBeVisible();
    await expect(page.getByText("0 件衣物")).toBeVisible();
  });

  test("编辑地点后列表显示新名称", async ({ page, request }) => {
    await createLocation(request, "次卧储物箱");
    await page.reload();

    await page.getByRole("button", { name: "编辑" }).click();
    const nameInput = page.getByLabel("名称");
    await expect(nameInput).toHaveValue("次卧储物箱");

    await nameInput.fill("次卧大储物箱");
    await page.getByRole("button", { name: "保存" }).click();

    await expect(page.getByText("次卧大储物箱")).toBeVisible();
    await expect(page.getByText("次卧储物箱", { exact: true })).toHaveCount(0);
  });

  test("删除地点需二次确认，确认后从列表消失", async ({ page, request }) => {
    await createLocation(request, "阳台晾衣架");
    await page.reload();
    // 用 exact：确认框标题「删除「阳台晾衣架」？」也包含这个名字
    await expect(page.getByText("阳台晾衣架", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "删除" }).click();

    // 弹确认框但还没删
    await expect(page.getByText(/删除「阳台晾衣架」/)).toBeVisible();
    await expect(page.getByText("阳台晾衣架", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "确认删除" }).click();
    await expect(page.getByText("阳台晾衣架", { exact: true })).toHaveCount(0);
    await expect(page.getByText("还没有地点，先建一个吧")).toBeVisible();
  });

  test("删除确认框点取消不会删除", async ({ page, request }) => {
    await createLocation(request, "玄关鞋柜");
    await page.reload();

    await page.getByRole("button", { name: "删除" }).click();
    await page.getByRole("button", { name: "取消" }).click();

    await expect(page.getByText("玄关鞋柜", { exact: true })).toBeVisible();
  });
});
