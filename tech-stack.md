# 技术栈定稿（Tech Stack）

> 文档状态：已与用户逐项确认 v1.0
> 关联文档：`project-scope.md`（需求）、`impl-plan.md`（实施方案）
> 重要说明：本文件中的选型**替换**了 `impl-plan.md` 第 1 节"技术选型"里的临时提案（原提案为原生 H5 / SQLite / 本地目录）。以本文件为准。

---

## 1. 已确认技术栈（逐项确认结果）

| 层 | 确认选型 | 确认来源 |
|----|----------|----------|
| 前端（手机端 H5） | **React + Vite** | 用户确认 |
| 后端服务 | **Node.js + Express** | 用户确认 |
| 数据库 | **PostgreSQL + Prisma（ORM）** | 用户确认 |
| 衣物照片存储 | **Cloudflare**（R2 / Images 对象存储） | 用户确认 |
| 包管理器 | **Bun** | 用户确认 |

> 关联需求回溯：以上选型均服务于 `project-scope.md` 的 5 项功能与"只有手机端""照片必填""云端可跨设备访问"三项衍生决策。

---

## 2. 各层说明

### 2.1 前端：React + Vite（移动端 H5）
- 用 React 组件化开发登录、地点列表、相册、新增衣物等视图，开发体验与可维护性优于纯静态。
- Vite 负责本地开发服务器与打包，产出纯静态资源，部署到任意静态托管（见第 4 节）。
- 移动优先：竖屏布局、大按钮、触屏友好；拍照用 `<input type="file" accept="image/*" capture="environment">`。
- 可加 `manifest.json` + PWA，支持"加到主屏"像 App。

### 2.2 后端：Node.js + Express
- 提供 REST API：注册/登录、地点增删改查、衣物增删改查、照片上传、首页概览。
- 与前端同语言（JavaScript/TypeScript），减少上下文切换。
- **依赖管理与脚本统一用 Bun**（`bun install` / `bun run dev` / `bun run build`）。
- 沙箱已具备 Node.js 22 环境，Bun 可一键安装，可立即本地跑通。
- 密码用 Node 内置 `crypto.scrypt` 加盐哈希；登录签发 JWT（或会话 Token）。
- 所有数据查询带 `user_id` 条件，保证用户数据隔离。

### 2.3 数据库：PostgreSQL + Prisma（ORM）
- 关系型数据库 PostgreSQL 承载 `users` / `locations` / `clothes` 三张表；**用 Prisma 作为 ORM 访问层**（不再手写 `pg` 驱动与 SQL）。
- 数据模型在 `server/prisma/schema.prisma` 定义（见 `impl-plan.md` 第 3 节），用 `prisma migrate` 管理表结构与迁移（`server/` 即 Prisma 项目根）。
- 代码通过 `PrismaClient` 做类型安全增删改查，所有查询带 `userId` 保证数据隔离。
- PostgreSQL 云端托管成熟（Supabase / Neon / 云厂 RDS）；本地可用 Docker 起 PG 实例或用托管 PG。

### 2.4 衣物照片存储：Cloudflare（对象存储）
- 衣物照片（必填）上传后存到 **Cloudflare R2**（S3 兼容对象存储）或 Cloudflare Images。
- 数据库中只保存照片的 URL/key，前端直接经 CDN 访问，不占应用服务器磁盘、跨设备稳定。
- 后端负责"接收上传 → 转存 Cloudflare → 回写 URL"的流程，需配置 Cloudflare 账户、API Token 与存储桶。

---

## 3. 部署形态（建议，待确认）

| 资产 | 建议托管 | 说明 |
|------|----------|------|
| 前端静态资源 | Cloudflare Pages（或任意静态托管） | React 构建产物直接部署，天然 CDN |
| 后端 API | Node 主机（容器/云服务器/Serverless Node） | Express 需 Node 运行环境 |
| 数据库 | 托管 PostgreSQL（Supabase / Neon / 云厂 RDS） | 免去自运维 |
| 照片 | Cloudflare R2 | 经 Cloudflare CDN 加速访问 |

> 因后端选 Express（需长期运行的 Node 进程），不建议直接放 Cloudflare Workers；前端与照片可充分利用 Cloudflare 生态。后端部署目标可在实施阶段再定。

---

## 4. 与 impl-plan.md 的差异对照

| 项 | impl-plan.md 原提案 | 本文件定稿 | 影响 |
|----|---------------------|------------|------|
| 前端 | 原生 HTML/CSS/JS（零构建） | React + Vite | 需引入构建步骤；前端目录改为 `src/` + 构建产物 |
| 数据库访问 | SQLite（better-sqlite3） | PostgreSQL + Prisma | 改用 Prisma ORM：模型在 `schema.prisma`，迁移用 `prisma migrate`，不再手写 SQL |
| 照片存储 | 服务端本地 `/uploads` | Cloudflare R2 | 需接入 Cloudflare SDK、配置密钥与桶 |
| 后端 | Node.js + Express | Node.js + Express | 不变 |
| 包管理器 | npm | Bun | 依赖安装与脚本统一用 `bun` |

> 建议：实施方案中涉及"前端目录结构""数据库模型与迁移（Prisma）""包管理器（Bun）""照片上传路由"的部分，按本文件定稿调整后实施（前端用 React 工程、数据库改用 Prisma、依赖用 Bun、上传改为直传/中转 Cloudflare）。

---

## 5. 待确认的小决策（实施前可定）

1. 前端用 JavaScript 还是 TypeScript？
2. 后端是否引入 TypeScript / 代码组织（如分层 controller/service）？
3. Cloudflare 具体用 R2 还是 Images？直传（前端拿临时凭证直传）还是后端中转？
4. 前端托管是否就用 Cloudflare Pages？后端托管目标（容器 / 云服务器 / 其他）？
5. PostgreSQL 用自托管还是托管服务（Supabase / Neon）？
