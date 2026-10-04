import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { api, type ClothingItem } from "@/api";

/** id 为 null 表示「未分配」这一虚拟分组 */
export interface LocationTarget {
  id: number | null;
  name: string;
}

interface LocationDetailProps {
  location: LocationTarget;
  onBack: () => void;
  onAdd: () => void;
  /** 衣物增减后通知父级刷新统计 */
  onChanged: () => void;
}

export default function LocationDetail({
  location,
  onBack,
  onAdd,
  onChanged,
}: LocationDetailProps) {
  const [clothes, setClothes] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<ClothingItem | null>(null);

  const loadClothes = useCallback(async () => {
    try {
      const data =
        location.id === null
          ? await api.clothes.list({ unassigned: true })
          : await api.clothes.list({ locationId: location.id });
      setClothes(data.clothes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载衣物失败");
    } finally {
      setLoading(false);
    }
  }, [location.id]);

  useEffect(() => {
    void loadClothes();
  }, [loadClothes]);

  async function handleDelete() {
    if (!deleting) return;
    try {
      await api.clothes.remove(deleting.id);
      setDeleting(null);
      await loadClothes();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
      setDeleting(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md p-4">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-medium">{location.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading ? "加载中…" : `共 ${clothes.length} 件衣物`}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={onAdd}>
            添加
          </Button>
          <Button variant="outline" size="sm" onClick={onBack}>
            返回
          </Button>
        </div>
      </header>

      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

      {!loading && clothes.length === 0 ? (
        <p className="text-sm text-muted-foreground">这个地点还没有衣物，点「添加」录一件</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {clothes.map((item) => (
            <li key={item.id} className="flex flex-col gap-2">
              <img
                src={item.photoUrl}
                alt={item.name}
                className="aspect-square w-full rounded-lg border border-border object-cover"
              />
              <p className="truncate text-sm">{item.name}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleting(item)}
                className="w-full"
              >
                删除
              </Button>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除「{deleting?.name}」？</AlertDialogTitle>
            <AlertDialogDescription>衣物与其照片会一并删除，无法恢复。</AlertDialogDescription>
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
