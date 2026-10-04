import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const USERNAME = "admin";
export const PASSWORD = "admin123";

/** 走真实 UI 完成登录并等待首页出现 */
export async function login(page: Page) {
  await page.getByLabel("用户名").fill(USERNAME);
  await page.getByLabel("密码").fill(PASSWORD);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByRole("heading", { name: `你好，${USERNAME}` })).toBeVisible();
}

/** 用接口登录拿 token，便于在用例前后做数据准备与清理 */
async function authToken(request: APIRequestContext): Promise<string> {
  const res = await request.post("/api/login", {
    data: { username: USERNAME, password: PASSWORD },
  });
  const body = (await res.json()) as { token: string };
  return body.token;
}

/** 清空所有地点，保证用例之间互不干扰 */
export async function resetLocations(request: APIRequestContext) {
  const token = await authToken(request);
  const headers = { Authorization: `Bearer ${token}` };

  const res = await request.get("/api/locations", { headers });
  const body = (await res.json()) as { locations: { id: number }[] };

  for (const location of body.locations) {
    await request.delete(`/api/locations/${location.id}`, { headers });
  }
}

/** 用接口预置一个地点，避免每个用例都点一遍表单 */
export async function createLocation(request: APIRequestContext, name: string, note?: string) {
  const token = await authToken(request);
  const res = await request.post("/api/locations", {
    headers: { Authorization: `Bearer ${token}` },
    data: { name, note },
  });
  const body = (await res.json()) as { location: { id: number } };
  return body.location.id;
}
