import { useCallback, useEffect, useState } from "react";
import Auth from "@/pages/Auth";
import Home from "@/pages/Home";
import { api, getToken, clearToken, type MeStats, type PublicUser } from "@/api";

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
    <Home
      user={user}
      stats={stats}
      onLogout={handleLogout}
      onStatsChange={setStats}
    />
  );
}
