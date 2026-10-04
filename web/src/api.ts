const TOKEN_KEY = "closet_token";

export interface PublicUser {
  id: number;
  username: string;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

export interface MeStats {
  locations: number;
  clothes: number;
}

export interface MeResponse {
  user: PublicUser;
  stats: MeStats;
}

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

interface RequestOptions {
  method?: string;
  body?: unknown;
}

/**
 * 统一请求封装：自动带 token，统一抛出带 message 的错误。
 * body 为 FormData 时不设置 Content-Type，交给浏览器带 boundary（阶段 4 上传照片用）。
 */
export async function request<T>(path: string, { method = "GET", body }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();

  if (token) headers.Authorization = `Bearer ${token}`;

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(path, { method, headers, body: payload });
  } catch {
    throw new Error("网络连接失败，请检查服务是否启动");
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message =
      (data as { error?: string } | null)?.error || `请求失败（${res.status}）`;
    const err = new Error(message);
    // token 失效时清掉本地凭证，让界面回到登录页
    if (res.status === 401) clearToken();
    throw err;
  }

  return data as T;
}

export const api = {
  login: (username: string, password: string) =>
    request<AuthResponse>("/api/login", { method: "POST", body: { username, password } }),
  me: () => request<MeResponse>("/api/me"),
};
