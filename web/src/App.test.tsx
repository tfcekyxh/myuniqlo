import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App.tsx";
import { api, clearToken, getToken, type MeResponse } from "@/api";

vi.mock("@/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api")>();
  return {
    ...actual,
    getToken: vi.fn(),
    clearToken: vi.fn(),
    setToken: vi.fn(),
    api: { ...actual.api, me: vi.fn(), login: vi.fn() },
  };
});

const ME: MeResponse = {
  user: { id: 1, username: "admin" },
  stats: { locations: 3, clothes: 12 },
};

describe("App 登录态切换", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("没有 token 时直接展示登录页，且不请求 /api/me", async () => {
    vi.mocked(getToken).mockReturnValue("");
    render(<App />);

    expect(await screen.findByRole("button", { name: "登录" })).toBeVisible();
    expect(api.me).not.toHaveBeenCalled();
  });

  it("有 token 时拉取概览并展示统计数字", async () => {
    vi.mocked(getToken).mockReturnValue("jwt-token");
    vi.mocked(api.me).mockResolvedValue(ME);
    render(<App />);

    expect(await screen.findByRole("heading", { name: "你好，admin" })).toBeVisible();
    expect(screen.getByText("3")).toBeVisible();
    expect(screen.getByText("12")).toBeVisible();
  });

  it("token 失效时回落到登录页", async () => {
    vi.mocked(getToken).mockReturnValue("expired-token");
    vi.mocked(api.me).mockRejectedValue(new Error("未登录"));
    render(<App />);

    expect(await screen.findByRole("button", { name: "登录" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: /你好/ })).not.toBeInTheDocument();
  });

  it("点击登出后清除凭证并回到登录页", async () => {
    vi.mocked(getToken).mockReturnValue("jwt-token");
    vi.mocked(api.me).mockResolvedValue(ME);
    render(<App />);

    await screen.findByRole("heading", { name: "你好，admin" });
    await userEvent.click(screen.getByRole("button", { name: "登出" }));

    expect(clearToken).toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: "登录" })).toBeVisible();
  });
});
