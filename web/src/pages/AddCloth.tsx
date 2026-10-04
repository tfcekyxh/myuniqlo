import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type LocationItem } from "@/api";

interface AddClothProps {
  locations: LocationItem[];
  defaultLocationId?: number | null;
  onDone: () => void;
  onCancel: () => void;
}

export default function AddCloth({
  locations,
  defaultLocationId,
  onDone,
  onCancel,
}: AddClothProps) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [name, setName] = useState("");
  const [locationId, setLocationId] = useState<string>(
    defaultLocationId != null ? String(defaultLocationId) : "",
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // 组件卸载时回收预览地址
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(file);
    setPreview(file ? URL.createObjectURL(file) : "");
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    // 照片必填：前端先拦一次，后端还会再校验
    if (!photo) {
      setError("请拍照或选择一张衣物照片");
      return;
    }
    if (!name.trim()) {
      setError("请填写衣物名称");
      return;
    }

    const form = new FormData();
    form.append("name", name.trim());
    form.append("photo", photo);
    if (locationId) form.append("locationId", locationId);

    setSaving(true);
    setError("");
    try {
      await api.clothes.create(form);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md p-4">
      <header className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-xl font-medium">添加衣物</h1>
        <Button variant="outline" size="sm" onClick={onCancel}>
          返回
        </Button>
      </header>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cloth-photo">照片（必填）</Label>
          {/* capture="environment" 让手机直接调用后置摄像头 */}
          <input
            id="cloth-photo"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoChange}
            className="block w-full text-base file:mr-3 file:h-12 file:rounded-lg file:border-0 file:bg-secondary file:px-4 file:text-base file:text-secondary-foreground"
          />
          {preview ? (
            <img
              src={preview}
              alt="照片预览"
              className="mt-2 h-48 w-full rounded-lg border border-border object-cover"
            />
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">还没有选择照片</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="cloth-name">名称</Label>
          <Input
            id="cloth-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="比如：黑色羽绒服"
            className="h-12 text-base"
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="cloth-location">归属地点（可选）</Label>
          {/* 用原生 select：手机上直接唤起系统选择器，体验与可测性都更好 */}
          <select
            id="cloth-location"
            value={locationId}
            onChange={(event) => setLocationId(event.target.value)}
            className="h-12 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">不指定（未分配）</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={saving}>
          {saving ? "上传中…" : "保存"}
        </Button>
      </form>

      <Card className="mt-6">
        <CardContent className="py-4 text-sm text-muted-foreground">
          极简录入：只记名称 + 照片，照片会存到云端，跨设备都能看。
        </CardContent>
      </Card>
    </div>
  );
}
