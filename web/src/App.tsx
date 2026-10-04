import { useCallback, useEffect, useState } from "react";
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
      <div className="app">
        <p className="muted">加载中…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app">
        <Auth onAuthed={handleAuthed} />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="home-header">
        <div>
          <h1 className="home-title">你好，{user.username}</h1>
          <p className="muted">这是你的衣橱概览</p>
        </div>
        <button className="btn btn-ghost" type="button" onClick={handleLogout}>
          登出
        </button>
      </header>

      <section className="stats">
        <div className="stat-card">
          <span className="stat-value">{stats?.locations ?? 0}</span>
          <span className="stat-label">地点</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats?.clothes ?? 0}</span>
          <span className="stat-label">衣物</span>
        </div>
      </section>

      <p className="hint">地点与衣物管理将在下一阶段接入</p>
    </div>
  );
}
