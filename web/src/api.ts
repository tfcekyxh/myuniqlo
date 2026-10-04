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

export interface LocationItem {
  id: number;
  name: string;
  note: string | null;
  createdAt: string;
  /** 该地点下的衣物数量，由后端 _count 带出 */
  clothesCount: number;
}

export interface LocationInput {
  name: string;
  note?: string | null;
}

export interface ClothingItem {
  id: number;
  locationId: number | null;
  name: string;
  /** Cloudflare R2 的公开访问地址，库里只存 URL */
  photoUrl: string;
  createdAt: string;
}

export interface ClothesQuery {
  locationId?: number;
  unassigned?: boolean;
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
  locations: {
    list: () => request<{ locations: LocationItem[] }>("/api/locations"),
    create: (input: LocationInput) =>
      request<{ location: LocationItem }>("/api/locations", { method: "POST", body: input }),
    update: (id: number, input: LocationInput) =>
      request<{ location: LocationItem }>(`/api/locations/${id}`, { method: "PUT", body: input }),
    remove: (id: number) =>
      request<{ ok: boolean }>(`/api/locations/${id}`, { method: "DELETE" }),
  },
  clothes: {
    list: (query: ClothesQuery = {}) => {
      const params = new URLSearchParams();
      if (query.locationId !== undefined) params.set("locationId", String(query.locationId));
      if (query.unassigned) params.set("unassigned", "true");
      const suffix = params.toString() ? `?${params.toString()}` : "";
      return request<{ clothes: ClothingItem[] }>(`/api/clothes${suffix}`);
    },
    /** 用 FormData 传照片（name + photo + locationId），后端用 multer 接收 */
    create: (form: FormData) =>
      request<{ clothing: ClothingItem }>("/api/clothes", { method: "POST", body: form }),
    update: (id: number, form: FormData) =>
      request<{ clothing: ClothingItem }>(`/api/clothes/${id}`, { method: "PUT", body: form }),
    remove: (id: number) => request<{ ok: boolean }>(`/api/clothes/${id}`, { method: "DELETE" }),
  },
};
