# 实施方案（Implementation Plan）

> 文档依据：`project-scope.md` 与已确认的 4 项澄清决策
> 文档状态：实施方案 v1.0

---

## 0. 背景与已确认决策

**原始需求（来自 project-scope.md）**
- 问题：家里衣服太多，我在外地，我想要知道我有多少衣服。衣服长什么样子。
- 功能：① 管理地点 ② 管理衣物 ③ 衣物添加到地点 ④ 简单账号密码登录 ⑤ 只有手机端

**已确认的 4 项决策**
| 维度 | 决策 |
|------|------|
| 平台形态 | 移动端 H5 网页（手机浏览器访问，可加主屏像 App） |
| 数据存储 | 云端后端 + 数据库（跨设备、外地可访问） |
| 衣物照片 | 照片必填（直击"长什么样"） |
| 衣物字段 | 仅「名称 + 照片」（极简录入） |

---

## 1. 技术选型

| 层 | 选型 | 说明 |
|----|------|------|
| 前端 | React + Vite（移动端 H5） | 组件化开发登录/相册/录入视图；Vite 打包产出静态资源，可部署到 Cloudflare Pages |
| 后端 | Node.js + Express | 提供 REST API |
| 数据库 | PostgreSQL + **Prisma（ORM）** | 生产级关系库，托管成熟（Supabase / Neon / 云厂 RDS）；模型在 `prisma/schema.prisma`，迁移用 `prisma migrate` |
| 照片存储 | Cloudflare R2（对象存储） | 照片存 Cloudflare，库里只存 URL；经 CDN 跨设备访问，不占应用服务器磁盘 |
| 登录 | 账号密码 + Token 会话 | 密码用 Node 内置 `crypto.scrypt` 加盐哈希；登录签发 JWT |
| 包管理器 | **Bun** | 依赖安装与脚本统一用 `bun`（替代 npm） |
| 部署 | 前端 Cloudflare Pages + 后端 Node 主机 + 托管 PostgreSQL + Cloudflare R2 | 同域或配 CORS，全链路 HTTPS |

> 说明：技术栈以 `tech-stack.md` 定稿为准（**React + Vite / Node + Express / PostgreSQL + Prisma / Cloudflare R2 / Bun**）。前端用 React 工程、数据库改用 Prisma（不再手写 `pg` 与 SQL）、依赖管理与脚本用 Bun、照片上传改为接收后转存 Cloudflare R2（库内只存 URL），与原提案的原生 H5 / SQLite / 本地目录不同。

---

## 2. 目录结构

```
/workspace
├── impl-plan.md
├── project-scope.md
├── tech-stack.md
├── CLAUDE.md
├── server/                # 后端（Node.js + Express，Bun 管理依赖）
│   ├── index.js           # 入口：启动 Express、挂载路由
│   ├── prisma.js          # PrismaClient 单例
│   ├── auth.js            # 注册/登录/密码哈希/Token 校验
│   ├── storage.js         # Cloudflare R2 上传/删除封装
│   ├── routes/
│   │   ├── locations.js   # 地点增删改查（经 Prisma）
│   │   └── clothes.js     # 衣物增删改查 + 归属地点 + 照片上传
│   ├── prisma/            # Prisma（Bun 管理）：schema + 迁移
│   │   └── schema.prisma  # User / Location / Clothing 模型
│   ├── package.json       # 用 Bun 安装依赖（同时也是 Prisma 项目根）
│   ├── .env.example       # DATABASE_URL、Cloudflare 凭证等
│   └── .env               # 本地环境（gitignore，不提交）
└── web/                   # 前端（React + Vite，Bun 管理依赖）
    ├── index.html         # 入口 HTML
    ├── vite.config.js
    ├── package.json       # 用 Bun 安装依赖
    └── src/
        ├── main.jsx       # React 挂载
        ├── App.jsx        # 按登录态切换视图（路由）
        ├── api.js         # 封装 fetch 请求
        ├── pages/
        │   ├── Auth.jsx       # 登录/注册
        │   ├── Home.jsx       # 首页概览
        │   ├── Locations.jsx  # 地点列表与详情（相册）
        │   └── AddCloth.jsx   # 新增衣物（拍照+命名）
        └── styles.css     # 移动优先样式
```

---

## 3. 数据库设计（Prisma Schema）

数据模型定义在 `prisma/schema.prisma`，由 `prisma migrate` 生成表结构与迁移，不再手写 SQL：

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           Int       @id @default(autoincrement())
  username     String    @unique @db.VarChar(50)
  passwordSalt String
  passwordHash String
  createdAt    DateTime  @default(now())
  locations    Location[]
  clothes      Clothing[]
}

model Location {
  id        Int        @id @default(autoincrement())
  userId    Int
  name      String     @db.VarChar(100)
  note      String?
  createdAt DateTime   @default(now())
  user      User       @relation(fields: [userId], references: [id])
  clothes   Clothing[]

  @@index([userId])
}

model Clothing {
  id         Int       @id @default(autoincrement())
  userId     Int
  locationId Int?
  name       String    @db.VarChar(100)
  photoUrl   String    // 照片必填，存 Cloudflare R2 的 URL
  createdAt  DateTime  @default(now())
  user       User      @relation(fields: [userId], references: [id])
  location   Location? @relation(fields: [locationId], references: [id])

  @@index([userId])
  @@index([locationId])
}
```

所有 Prisma 查询必须带 `userId` 条件（如 `where: { userId }` 或 `create` 时填入 `userId`），保证**用户数据隔离**。

---

## 4. 后端 API 设计

鉴权方式：除注册/登录外，所有请求 Header 携带 `Authorization: Bearer <token>`。

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/register` | 注册（用户名+密码） |
| POST | `/api/login` | 登录，返回 token |
| GET | `/api/locations` | 我的地点列表（含各地点衣物数） |
| POST | `/api/locations` | 新建地点 |
| PUT | `/api/locations/:id` | 编辑地点 |
| DELETE | `/api/locations/:id` | 删除地点（其下衣物 `location_id` 置空=未分配） |
| GET | `/api/locations/:id/clothes` | 某地点下的衣物（相册） |
| POST | `/api/clothes` | 新增衣物（multipart：name + photo + location_id） |
| GET | `/api/clothes/:id` | 衣物详情 |
| PUT | `/api/clothes/:id` | 编辑（可改名称/改派地点/换照片） |
| DELETE | `/api/clothes/:id` | 删除衣物（同时删照片文件） |
| GET | `/api/me` | 首页概览：总地点数、总衣物数、分布 |
| GET | `/uploads/:file` | 静态访问照片 |

---

## 5. 前端页面与交互（移动端 H5）

单页应用，按登录态在以下视图间切换（不跳转多页，体验更像 App）：

1. **登录/注册页**：用户名 + 密码；未登录强制在此。
2. **首页概览**：显示「总衣物数 / 总地点数 / 各地点分布」，含"新建地点"入口。
3. **地点列表**：卡片式列表，每张卡显示地点名 + 衣物数量，点进去看详情。
4. **地点详情（衣物相册）**：网格缩略图展示该地点全部衣物，点开看大图+名称。
5. **新增衣物页**：`拍照/选图` 上传（必填）+ 输入名称 + 选择归属地点 → 提交。
6. **我的/登出**：登出按钮。

**移动端关键点**
- 视口 `<meta name="viewport" content="width=device-width, initial-scale=1">`
- 拍照：`<input type="file" accept="image/*" capture="environment">`
- 竖屏优先、大按钮、触屏友好；可加 `manifest.json` 支持"加到主屏"

---

## 6. 分步实施步骤（一步一步来）

### 阶段 1：后端骨架与数据库（Bun + Prisma）
1. 在 `server/` 用 **Bun** 初始化：`bun init`，`bun add express @prisma/client multer @aws-sdk/client-s3 jsonwebtoken dotenv cors`，`bun add -d prisma`；前端 `web/` 用 `bun install`（React/Vite 等）。
2. 在 `server/` 下写 `prisma/schema.prisma`（见第 3 节），执行 `bunx prisma migrate dev` 生成 PostgreSQL 表结构与迁移；写 `server/prisma.js` 导出 `PrismaClient` 单例。
3. 写 `server/index.js`：启动 Express，监听端口（如 3000）；开发期用 `cors` 允许前端（Vite 默认 5173）跨域，生产期由前端静态托管同域。
4. 验证：启动服务（`bun run dev`）+ 本地/托管 PG 连通，能返回健康检查。

### 阶段 2：账号密码登录
5. 写 `server/auth.js`：注册时 `crypto.scrypt` 加盐哈希，经 Prisma 写入 `User`；登录校验后签发 JWT。
6. 实现 `POST /api/register`、`POST /api/login`、`GET /api/me`。
7. 前端（`web/src/pages/Auth.jsx` + `api.js`）：登录/注册表单 + token 存入 `localStorage`。
8. 验证：注册→登录→拿到 token→能调 `/api/me`。

### 阶段 3：地点管理
9. 写 `server/routes/locations.js`，经 Prisma 实现地点的增删改查（所有查询带 `userId`；删除地点时把其下衣物 `locationId` 置空）。
10. 前端（`Home.jsx` / `Locations.jsx`）实现首页概览 + 地点列表 + 新建/编辑/删除地点。
11. 验证：能建"主卧衣柜"等地点，列表显示数量。

### 阶段 4：衣物管理与照片上传（Cloudflare R2）
12. 写 `server/storage.js`（封装 R2 上传/删除）+ `server/routes/clothes.js`（经 Prisma 增删改查 + 归属地点）。`POST /api/clothes` 用 `multer` 收图后转存 R2，库内只存返回的 `photoUrl`。
13. 前端 `AddCloth.jsx`：拍照上传（必填校验）+ 名称 + 选地点；地点详情相册通过 R2 URL 网格展示。
14. 验证：上传一件衣服照片，能在对应地点相册看到；不传照片应被拦截。

### 阶段 5：移动端适配与联调
15. 统一移动优先样式，测试竖屏布局、大图查看、拍照流程。
16. 加 `manifest.json` 与移动端图标，支持"加到主屏"。
17. 用手机/浏览器移动模拟器全流程走查（登录→建地点→加衣服→看相册）。

### 阶段 6：云端部署
18. 前端 `bun run build` 部署到 Cloudflare Pages；后端部署到 Node 主机（容器/云服务器，`bun run start` 或 `node` 启动），数据库用托管 PostgreSQL，照片用 Cloudflare R2。
19. 配置环境变量（数据库连接、Cloudflare 凭证、JWT 密钥），启用 HTTPS。
20. 验证：在外地用手机浏览器打开域名，登录后能看到家里的衣物照片。

### 阶段 7：验收
21. 对照下方验收清单逐条确认。

---

## 7. 验收清单

- [ ] 账号密码注册/登录正常，A 用户看不到 B 用户数据
- [ ] 可创建地点，地点列表显示各地点衣物数量
- [ ] 新增衣物**必须**上传照片，照片在手机端清晰展示
- [ ] 衣物能归属到地点，并在地点详情相册中看到
- [ ] 首页概览显示总衣物数、总地点数、各地点分布
- [ ] 全流程在手机端（竖屏）体验正常
- [ ] 云端部署后，外地手机浏览器可访问并查看照片

---

## 8. 范围与后续

**本期不做（保持"简单"）**
- 衣物类别/颜色/品牌等扩展字段（已确认仅名称+照片）
- 找回密码、第三方登录、生物识别
- 多用户/家庭共享、穿搭推荐、清洗提醒
- PC 桌面端

**后续可迭代**
- 图片压缩与多尺寸缩略图（Cloudflare Images 转换），加快相册加载
- 衣物搜索、按地点统计图表
- 离线缓存、PWA 推送、前端直传 R2（预签名 URL）
