import { useState, type ChangeEvent, type FormEvent } from "react";
import { api, setToken, type PublicUser } from "../api.ts";

const DEFAULT_USERNAME = "admin";

interface AuthProps {
  onAuthed: (user: PublicUser) => void;
}

export default function Auth({ onAuthed }: AuthProps) {
  const [username, setUsername] = useState(DEFAULT_USERNAME);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setError("");
    setBusy(true);
    try {
      const data = await api.login(username.trim(), password);
      setToken(data.token);
      onAuthed(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败，请重试");
    } finally {
      setBusy(false);
    }
  }

  function handleUsernameChange(event: ChangeEvent<HTMLInputElement>) {
    setUsername(event.target.value);
  }

  function handlePasswordChange(event: ChangeEvent<HTMLInputElement>) {
    setPassword(event.target.value);
  }

  return (
    <div className="auth">
      <header className="auth-header">
        <h1>衣橱管家</h1>
        <p className="muted">随时知道家里有多少衣服、长什么样</p>
      </header>

      <form className="form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-label">用户名</span>
          <input
            className="input"
            type="text"
            value={username}
            onChange={handleUsernameChange}
            placeholder="请输入用户名"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
          />
        </label>

        <label className="field">
          <span className="field-label">密码</span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={handlePasswordChange}
            placeholder="请输入密码"
            autoComplete="current-password"
            required
          />
        </label>

        {error ? <p className="error">{error}</p> : null}

        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "请稍候…" : "登录"}
        </button>
      </form>
    </div>
  );
}
