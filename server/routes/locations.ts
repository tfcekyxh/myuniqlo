import express, { type Request, type Response } from "express";
import { prisma } from "../prisma.ts";
import { authMiddleware } from "../auth.ts";

const router = express.Router();

// 地点相关接口全部需要登录
router.use(authMiddleware);

/** 取出当前登录用户 id；未登录时已由 authMiddleware 拦下 */
function currentUserId(req: Request): number {
  return req.user!.id;
}

interface LocationPayload {
  id: number;
  name: string;
  note: string | null;
  createdAt: Date;
  clothesCount: number;
}

function validateName(name: unknown): { value?: string; error?: string } {
  const value = String(name ?? "").trim();
  if (!value) return { error: "地点名称不能为空" };
  if (value.length > 100) return { error: "地点名称最多 100 个字符" };
  return { value };
}

/** GET /api/locations —— 我的地点列表，含各地点衣物数 */
router.get("/locations", async (req: Request, res: Response) => {
  const userId = currentUserId(req);

  const locations = await prisma.location.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { clothes: true } } },
  });

  const payload: LocationPayload[] = locations.map((item) => ({
    id: item.id,
    name: item.name,
    note: item.note,
    createdAt: item.createdAt,
    clothesCount: item._count.clothes,
  }));

  res.json({ locations: payload });
});

/** POST /api/locations —— 新建地点 */
router.post("/locations", async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const { name, note } = req.body ?? {};

  const { value, error } = validateName(name);
  if (error) {
    res.status(400).json({ error });
    return;
  }

  const location = await prisma.location.create({
    data: {
      userId,
      name: value!,
      note: note ? String(note).trim() : null,
    },
  });

  res.status(201).json({
    location: { ...location, clothesCount: 0 },
  });
});

/** PUT /api/locations/:id —— 编辑地点 */
router.put("/locations/:id", async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "地点 id 不合法" });
    return;
  }

  const { name, note } = req.body ?? {};
  const { value, error } = validateName(name);
  if (error) {
    res.status(400).json({ error });
    return;
  }

  // 带 userId 查询，保证改不到别人的地点
  const existing = await prisma.location.findFirst({ where: { id, userId } });
  if (!existing) {
    res.status(404).json({ error: "地点不存在" });
    return;
  }

  const location = await prisma.location.update({
    where: { id },
    data: {
      name: value!,
      note: note ? String(note).trim() : null,
    },
  });

  const clothesCount = await prisma.clothing.count({ where: { locationId: id } });

  res.json({ location: { ...location, clothesCount } });
});

/** DELETE /api/locations/:id —— 删除地点，其下衣物置为未分配 */
router.delete("/locations/:id", async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "地点 id 不合法" });
    return;
  }

  const existing = await prisma.location.findFirst({ where: { id, userId } });
  if (!existing) {
    res.status(404).json({ error: "地点不存在" });
    return;
  }

  await prisma.$transaction([
    // 先把它下面的衣物解绑（locationId 置空 = 未分配），再删地点
    prisma.clothing.updateMany({
      where: { locationId: id, userId },
      data: { locationId: null },
    }),
    prisma.location.delete({ where: { id } }),
  ]);

  res.json({ ok: true, unassignedClothes: true });
});

export default router;
