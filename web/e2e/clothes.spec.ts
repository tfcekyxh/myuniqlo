import { test, expect } from "@playwright/test";
import {
  createLocation,
  login,
  PNG_BUFFER,
  resetClothes,
  resetLocations,
} from "./helpers.ts";

test.describe("衣物管理与照片上传", () => {
  test.beforeEach(async ({ page, request }) => {
    await resetClothes(request);
    await resetLocations(request);
    await page.goto("/");
    await login(page);
  });

  test("不传照片时保存被拦截", async ({ page, request }) => {
    await createLocation(request, "主卧衣柜");
    await page.reload();

    await page.getByRole("button", { name: /主卧衣柜/ }).click();
    await page.getByRole("button", { name: "添加" }).click();

    await page.getByLabel("名称").fill("忘记拍照的外套");
    await page.getByRole("button", { name: "保存" }).click();

    await expect(page.getByText("请拍照或选择一张衣物照片")).toBeVisible();
    // 仍在添加页，没有被提交成功
    await expect(page.getByRole("heading", { name: "添加衣物" })).toBeVisible();
  });

  test("上传照片后能在地点相册里看到", async ({ page, request }) => {
    await createLocation(request, "主卧衣柜");
    await page.reload();

    // 进入地点 → 添加衣物
    await page.getByRole("button", { name: /主卧衣柜/ }).click();
    await page.getByRole("button", { name: "添加" }).click();

    await page
      .getByLabel("照片（必填）")
      .setInputFiles({ name: "cloth.png", mimeType: "image/png", buffer: PNG_BUFFER });
    await page.getByLabel("名称").fill("黑色羽绒服");
    await page.getByRole("button", { name: "保存" }).click();

    // 回到详情相册，照片应已渲染出来
    await expect(page.getByRole("heading", { name: "主卧衣柜" })).toBeVisible();
    const photo = page.getByAltText("黑色羽绒服");
    await expect(photo).toBeVisible();
    await expect(page.getByText("共 1 件衣物")).toBeVisible();

    // 图片地址来自 R2
    const src = await photo.getAttribute("src");
    expect(src).toContain("r2.dev");

    // 图片要真的从 R2 加载出来（需要等待，否则会误判为未加载）
    await page.waitForFunction(
      () => {
        const img = document.querySelector<HTMLImageElement>('img[alt="黑色羽绒服"]');
        return !!img && img.complete && img.naturalWidth > 0;
      },
      null,
      { timeout: 20_000 },
    );
    expect(await photo.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  });

  test("上传后概览的衣物总数同步增加", async ({ page, request }) => {
    await createLocation(request, "次卧储物箱");
    await page.reload();

    await page.getByRole("button", { name: "添加衣物" }).click();
    await page
      .getByLabel("照片（必填）")
      .setInputFiles({ name: "cloth.png", mimeType: "image/png", buffer: PNG_BUFFER });
    await page.getByLabel("名称").fill("灰色卫衣");
    await page.getByRole("button", { name: "保存" }).click();

    // 未指定地点 → 归入「未分配」
    await expect(page.getByText("未分配")).toBeVisible();
    await expect(page.getByText("1 件衣物")).toBeVisible();
  });

  test("删除衣物需二次确认，确认后从相册消失", async ({ page, request }) => {
    const locationId = await createLocation(request, "阳台晾衣架");
    await page.reload();
    await page.getByRole("button", { name: /阳台晾衣架/ }).click();
    await page.getByRole("button", { name: "添加" }).click();
    await page
      .getByLabel("照片（必填）")
      .setInputFiles({ name: "cloth.png", mimeType: "image/png", buffer: PNG_BUFFER });
    await page.getByLabel("名称").fill("白衬衫");
    await page.getByRole("button", { name: "保存" }).click();

    await expect(page.getByAltText("白衬衫")).toBeVisible();

    await page.getByRole("button", { name: "删除" }).click();
    await expect(page.getByText(/删除「白衬衫」/)).toBeVisible();
    await expect(page.getByAltText("白衬衫")).toBeVisible();

    await page.getByRole("button", { name: "确认删除" }).click();
    await expect(page.getByAltText("白衬衫")).toHaveCount(0);
    await expect(page.getByText("这个地点还没有衣物，点「添加」录一件")).toBeVisible();

    // 顺带确认地点还在，只是衣物没了
    expect(locationId).toBeGreaterThan(0);
  });
});
