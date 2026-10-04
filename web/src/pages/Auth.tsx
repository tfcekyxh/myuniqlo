import { useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api, setToken, type PublicUser } from "@/api";

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
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">衣橱管家</CardTitle>
          <CardDescription>随时知道家里有多少衣服、长什么样</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                name="username"
                type="text"
                value={username}
                onChange={handleUsernameChange}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                // 移动端：点击区与字号都要够大，字号低于 16px 会被 iOS 自动放大页面
                className="h-12 text-base"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={handlePasswordChange}
                autoComplete="current-password"
                className="h-12 text-base"
                required
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={busy}>
              {busy ? "请稍候…" : "登录"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
