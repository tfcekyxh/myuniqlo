import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api, type LocationItem, type MeStats, type PublicUser } from "@/api";

interface HomeProps {
  user: PublicUser;
  stats: MeStats | null;
  onLogout: () => void;
  onStatsChange: (stats: MeStats) => void;
}

export default function Home({ user, stats, onLogout, onStatsChange }: HomeProps) {
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LocationItem | null>(null);
  const [deleting, setDeleting] = useState<LocationItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formNote, setFormNote] = useState("");
  const [saving, setSaving] = useState(false);

  const refreshStats = useCallback(async () => {
    try {
      const data = await api.me();
      onStatsChange(data.stats);
    } catch {
      // 统计刷新失败不影响列表本身，静默忽略
    }
  }, [onStatsChange]);

  const loadLocations = useCallback(async () => {
    try {
      const data = await api.locations.list();
      setLocations(data.locations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载地点失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLocations();
  }, [loadLocations]);

  function openCreate() {
    setEditing(null);
    setFormName("");
    setFormNote("");
    setError("");
    setFormOpen(true);
  }

  function openEdit(location: LocationItem) {
    setEditing(location);
    setFormName(location.name);
    setFormNote(location.note ?? "");
    setError("");
    setFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setError("");
    try {
      if (editing) {
        await api.locations.update(editing.id, { name: formName, note: formNote });
      } else {
        await api.locations.create({ name: formName, note: formNote });
      }
      setFormOpen(false);
      await loadLocations();
      await refreshStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await api.locations.remove(deleting.id);
      setDeleting(null);
      await loadLocations();
      await refreshStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
      setDeleting(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md p-4">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-medium">你好，{user.username}</h1>
          <p className="mt-1 text-sm text-muted-foreground">这是你的衣橱概览</p>
        </div>
        <Button variant="outline" size="sm" onClick={onLogout}>
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

      <div className="mt-6 mb-3 flex items-center justify-between">
        <h2 className="text-base font-medium">我的地点</h2>
        <Button size="sm" onClick={openCreate}>
          新建地点
        </Button>
      </div>

      {error && !formOpen ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : locations.length === 0 ? (
        <p className="text-sm text-muted-foreground">还没有地点，先建一个吧</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {locations.map((location) => (
            <li key={location.id}>
              <Card>
                <CardContent className="flex items-center justify-between gap-3 py-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{location.name}</p>
                    {location.note ? (
                      <p className="truncate text-sm text-muted-foreground">{location.note}</p>
                    ) : null}
                    <p className="mt-1 text-sm text-muted-foreground">
                      {location.clothesCount} 件衣物
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(location)}>
                      编辑
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDeleting(location)}>
                      删除
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-center text-sm text-muted-foreground">
        衣物管理将在下一阶段接入
      </p>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "编辑地点" : "新建地点"}</DialogTitle>
            <DialogDescription>给它起个好认的名字，比如「主卧衣柜」</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="location-name">名称</Label>
              <Input
                id="location-name"
                value={formName}
                onChange={(event) => setFormName(event.target.value)}
                className="h-12 text-base"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="location-note">备注（可选）</Label>
              <Input
                id="location-note"
                value={formNote}
                onChange={(event) => setFormNote(event.target.value)}
                className="h-12 text-base"
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "保存中…" : "保存"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除「{deleting?.name}」？</AlertDialogTitle>
            <AlertDialogDescription>
              地点会被删除，其下的衣物会变成「未分配」，衣物本身不会被删掉。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
