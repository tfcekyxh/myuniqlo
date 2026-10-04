import express, { type Request, type Response } from "express";
import multer from "multer";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.ts";
import { authMiddleware } from "../auth.ts";
import { deletePhoto, uploadClothPhoto } from "../storage.ts";

const router = express.Router();

// 衣物相关接口全部需要登录
router.use(authMiddleware);

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

// 先收进内存，再转存 R2，本地不留文件
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES, files: 1 },
});

function currentUserId(req: Request): number {
  return req.user!.id;
}

interface ClothingPayload {
  id: number;
  locationId: number | null;
  name: string;
  photoUrl: string;
  createdAt: Date;
}

function toPayload(item: {
  id: number;
  locationId: number | null;
  name: string;
  photoUrl: string;
  createdAt: Date;
}): ClothingPayload {
  return {
    id: item.id,
    locationId: item.locationId,
    name: item.name,
    photoUrl: item.photoUrl,
    createdAt: item.createdAt,
  };
}

function validateName(name: unknown): { value?: string; error?: string } {
  const value = String(name ?? "").trim();
  if (!value) return { error: "衣物名称不能为空" };
  if (value.length > 100) return { error: "衣物名称最多 100 个字符" };
  return { value };
}

/** 照片必填且必须是图片 */
function validatePhoto(file: Express.Multer.File | undefined): string | null {
  if (!file || !file.buffer || file.size === 0) return "请上传衣物照片";
  if (!ALLOWED_MIME.has(file.mimetype.toLowerCase())) {
    return "照片格式不支持，请上传 JPG / PNG / WebP 等图片";
  }
  return null;
}

/**
 * 解析并校验归属地点。
 * raw 为 undefined 表示不修改；null / 空串表示置为「未分配」。
 */
async function resolveLocation(
  userId: number,
  raw: unknown,
): Promise<{ locationId?: number | null; error?: string; status?: number }> {
  if (raw === undefined) return {};
  if (raw === null || String(raw) === "") return { locationId: null };

  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    return { error: "地点 id 不合法", status: 400 };
  }

  const owned = await prisma.location.findFirst({ where: { id: parsed, userId } });
  if (!owned) {
    return { error: "地点不存在", status: 404 };
  }

  return { locationId: parsed };
}

/** POST /api/clothes —— 新增衣物（照片必填） */
router.post("/clothes", upload.single("photo"), async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const { name, locationId } = req.body ?? {};

  const nameResult = validateName(name);
  if (nameResult.error) {
    res.status(400).json({ error: nameResult.error });
    return;
  }

  const photoError = validatePhoto(req.file);
  if (photoError) {
    res.status(400).json({ error: photoError });
    return;
  }

  const location = await resolveLocation(userId, locationId);
  if (location.error) {
    res.status(location.status ?? 400).json({ error: location.error });
    return;
  }

  const photoUrl = await uploadClothPhoto({
    userId,
    data: req.file!.buffer,
    contentType: req.file!.mimetype,
  });

  const clothing = await prisma.clothing.create({
    data: {
      userId,
      locationId: location.locationId ?? null,
      name: nameResult.value!,
      photoUrl,
    },
  });

  res.status(201).json({ clothing: toPayload(clothing) });
});

/** GET /api/clothes —— 我的衣物；?locationId=1 按地点过滤，?unassigned=true 只看未分配 */
router.get("/clothes", async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const { locationId, unassigned } = req.query;

  const where: Prisma.ClothingWhereInput = { userId };

  if (unassigned === "true" || unassigned === "1") {
    where.locationId = null;
  } else if (locationId !== undefined && String(locationId) !== "") {
    const parsed = Number(locationId);
    if (!Number.isInteger(parsed)) {
      res.status(400).json({ error: "地点 id 不合法" });
      return;
    }
    where.locationId = parsed;
  }

  const items = await prisma.clothing.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  res.json({ clothes: items.map(toPayload) });
});

/** GET /api/locations/:id/clothes —— 某地点下的衣物（相册） */
router.get("/locations/:id/clothes", async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "地点 id 不合法" });
    return;
  }

  const location = await prisma.location.findFirst({ where: { id, userId } });
  if (!location) {
    res.status(404).json({ error: "地点不存在" });
    return;
  }

  const items = await prisma.clothing.findMany({
    where: { locationId: id, userId },
    orderBy: { createdAt: "desc" },
  });

  res.json({
    location: { id: location.id, name: location.name },
    clothes: items.map(toPayload),
  });
});

/** GET /api/clothes/:id —— 衣物详情 */
router.get("/clothes/:id", async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "衣物 id 不合法" });
    return;
  }

  const clothing = await prisma.clothing.findFirst({ where: { id, userId } });
  if (!clothing) {
    res.status(404).json({ error: "衣物不存在" });
    return;
  }

  res.json({ clothing: toPayload(clothing) });
});

/** PUT /api/clothes/:id —— 改名称 / 改派地点 / 换照片（换图后会删掉旧图） */
router.put("/clothes/:id", upload.single("photo"), async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "衣物 id 不合法" });
    return;
  }

  const existing = await prisma.clothing.findFirst({ where: { id, userId } });
  if (!existing) {
    res.status(404).json({ error: "衣物不存在" });
    return;
  }

  const { name, locationId } = req.body ?? {};
  const updates: Prisma.ClothingUpdateInput = {};

  if (name !== undefined) {
    const nameResult = validateName(name);
    if (nameResult.error) {
      res.status(400).json({ error: nameResult.error });
      return;
    }
    updates.name = nameResult.value!;
  }

  if (locationId !== undefined) {
    const location = await resolveLocation(userId, locationId);
    if (location.error) {
      res.status(location.status ?? 400).json({ error: location.error });
      return;
    }
    if (location.locationId === null) {
      updates.location = { disconnect: true };
    } else {
      updates.location = { connect: { id: location.locationId } };
    }
  }

  let newPhotoUrl: string | null = null;
  if (req.file) {
    const photoError = validatePhoto(req.file);
    if (photoError) {
      res.status(400).json({ error: photoError });
      return;
    }
    newPhotoUrl = await uploadClothPhoto({
      userId,
      data: req.file.buffer,
      contentType: req.file.mimetype,
    });
    updates.photoUrl = newPhotoUrl;
  }

  const clothing = await prisma.clothing.update({ where: { id }, data: updates });

  // 换图成功后才删旧图，避免中途失败导致图片丢失
  if (newPhotoUrl) {
    try {
      await deletePhoto(existing.photoUrl);
    } catch {
      // 旧图删除失败不影响本次更新，后续可手工清理
    }
  }

  res.json({ clothing: toPayload(clothing) });
});

/** DELETE /api/clothes/:id —— 删除衣物，同时删掉 R2 上的照片 */
router.delete("/clothes/:id", async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "衣物 id 不合法" });
    return;
  }

  const existing = await prisma.clothing.findFirst({ where: { id, userId } });
  if (!existing) {
    res.status(404).json({ error: "衣物不存在" });
    return;
  }

  await prisma.clothing.delete({ where: { id } });

  // 先删记录再删图：即便删图失败，数据也已经是干净的
  try {
    await deletePhoto(existing.photoUrl);
  } catch {
    // 忽略：孤立对象可后续清理
  }

  res.json({ ok: true });
});

export default router;
