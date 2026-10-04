import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Auth from "./Auth.tsx";
import { api, setToken, type AuthResponse } from "@/api";

vi.mock("@/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api")>();
  return {
    ...actual,
    setToken: vi.fn(),
    api: { ...actual.api, login: vi.fn(), me: vi.fn() },
  };
});

const LOGGED_IN: AuthResponse = {
  token: "jwt-token",
  user: { id: 1, username: "admin" },
};

describe("Auth 登录表单", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("用户名默认预填 admin，密码为空", () => {
    render(<Auth onAuthed={vi.fn()} />);

    expect(screen.getByLabelText("用户名")).toHaveValue("admin");
    expect(screen.getByLabelText("密码")).toHaveValue("");
  });

  it("登录成功后写入 token 并回调 onAuthed", async () => {
    const onAuthed = vi.fn();
    vi.mocked(api.login).mockResolvedValue(LOGGED_IN);
    render(<Auth onAuthed={onAuthed} />);

    await userEvent.type(screen.getByLabelText("密码"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => expect(setToken).toHaveBeenCalledWith("jwt-token"));
    expect(api.login).toHaveBeenCalledWith("admin", "secret123");
    expect(onAuthed).toHaveBeenCalledWith({ id: 1, username: "admin" });
  });

  it("登录失败时展示后端返回的错误文案，且不写入 token", async () => {
    const onAuthed = vi.fn();
    vi.mocked(api.login).mockRejectedValue(new Error("用户名或密码错误"));
    render(<Auth onAuthed={onAuthed} />);

    await userEvent.type(screen.getByLabelText("密码"), "bad-password");
    await userEvent.click(screen.getByRole("button", { name: "登录" }));

    expect(await screen.findByText("用户名或密码错误")).toBeVisible();
    expect(setToken).not.toHaveBeenCalled();
    expect(onAuthed).not.toHaveBeenCalled();
  });

  it("用户名可被修改后再提交", async () => {
    vi.mocked(api.login).mockResolvedValue(LOGGED_IN);
    render(<Auth onAuthed={vi.fn()} />);

    const usernameInput = screen.getByLabelText("用户名");
    await userEvent.clear(usernameInput);
    await userEvent.type(usernameInput, "someone");
    await userEvent.type(screen.getByLabelText("密码"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => expect(api.login).toHaveBeenCalledWith("someone", "secret123"));
  });

  it("请求进行中按钮禁用，避免重复提交", async () => {
    let resolveLogin!: (value: AuthResponse) => void;
    vi.mocked(api.login).mockImplementation(
      () => new Promise<AuthResponse>((resolve) => {
        resolveLogin = resolve;
      }),
    );
    render(<Auth onAuthed={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("密码"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "登录" }));

    expect(await screen.findByRole("button", { name: "请稍候…" })).toBeDisabled();

    resolveLogin(LOGGED_IN);
    await waitFor(() => expect(setToken).toHaveBeenCalledWith("jwt-token"));
  });
});
