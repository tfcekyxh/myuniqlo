import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Auth from "./pages/Auth.tsx";
import { api, getToken, clearToken, type MeStats, type PublicUser } from "./api.ts";

export default function App() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [stats, setStats] = useState<MeStats | null>(null);
  const [loading, setLoading] = useState(true);

  // 拉取当前用户与概览统计；失败则清空登录态（401 已在 api.ts 中清理 token）
  const loadMe = useCallback(async () => {
    try {
      const data = await api.me();
      setUser(data.user);
      setStats(data.stats);
    } catch {
      setUser(null);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // 刷新页面时若有 token，先校验是否仍有效
  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    void loadMe();
  }, [loadMe]);

  // 登录成功后同样拉一次，保证概览统计不是空的
  function handleAuthed() {
    void loadMe();
  }

  function handleLogout() {
    clearToken();
    setUser(null);
    setStats(null);
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-md p-4">
        <p className="text-sm text-muted-foreground">加载中…</p>
      </div>
    );
  }

  if (!user) {
    return <Auth onAuthed={handleAuthed} />;
  }

  return (
    <div className="mx-auto w-full max-w-md p-4">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-medium">你好，{user.username}</h1>
          <p className="mt-1 text-sm text-muted-foreground">这是你的衣橱概览</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          登出
        </Button>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="flex flex-col items-center gap-1 py-6">
            <span className="text-3xl font-medium">{stats?.locations ?? 0}</span>
            <span className="text-sm text-muted-foreground">地点</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-1 py-6">
            <span className="text-3xl font-medium">{stats?.clothes ?? 0}</span>
            <span className="text-sm text-muted-foreground">衣物</span>
          </CardContent>
        </Card>
      </section>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        地点与衣物管理将在下一阶段接入
      </p>
    </div>
  );
}
