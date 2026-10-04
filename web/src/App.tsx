import { useEffect, useState } from "react";
import Auth from "./pages/Auth.tsx";
import { api, getToken, clearToken, type MeStats, type PublicUser } from "./api.ts";

export default function App() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [stats, setStats] = useState<MeStats | null>(null);
  const [loading, setLoading] = useState(true);

  // 刷新页面时若有 token，先校验是否仍有效
  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((data) => {
        setUser(data.user);
        setStats(data.stats);
      })
      .catch(() => {
        // 401 已在 api.ts 中清理 token
        setUser(null);
        setStats(null);
      })
      .finally(() => setLoading(false));
  }, []);

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
        <Auth onAuthed={setUser} />
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
