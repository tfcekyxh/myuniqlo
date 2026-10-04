# CLAUDE.md — 项目上下文

> 本文件用于让 AI 助手快速理解本项目。详细内容见各专门文档。
> 关联文档：`project-scope.md`（需求）、`tech-stack.md`（技术栈）、`impl-plan.md`（实施方案）

---

## 项目简介

一个**手机端 H5 网页**应用，帮助用户（常在外地）管理存放在家中等地的衣物：知道"有多少衣服、长什么样、放在哪个地点"。

---

## 原始需求（来自 project-scope.md，原话保留）

问题：
家里衣服太多，我在外地，我想要知道我有多少衣服。衣服长什么样子。

解决方案：

功能：
1，可以管理我有哪些地点
2，管理衣物
3，把衣物添加到地点
4，简单的账号密码登录
5，只有手机端

---

## 已确认的澄清决策

| 维度 | 决策 |
|------|------|
| 平台形态 | 移动端 H5 网页（手机浏览器访问，可加主屏像 App） |
| 数据存储 | 云端后端 + 数据库（跨设备、外地可访问） |
| 衣物照片 | 照片必填（直击"长什么样"） |
| 衣物字段 | 仅「名称 + 照片」（极简录入） |

---

## 技术栈定稿（来自 tech-stack.md，已逐项确认）

| 层 | 选型 |
|----|------|
| 前端（手机端 H5） | React + Vite |
| 后端 | Node.js + Express |
| 数据库 | PostgreSQL + Prisma（ORM） |
| 衣物照片存储 | Cloudflare（R2 对象存储） |
| 包管理器 | Bun |
| 登录 | 账号密码 + Token（crypto.scrypt 加盐哈希 + JWT） |
| 前端组件库 | **shadcn/ui**（Radix UI + Tailwind CSS） |
| e2e 测试 | **Playwright**（驱动本机 Chrome，移动视口） |
| 部署 | 前端 Cloudflare Pages + 后端 Node 主机 + 托管 PostgreSQL + Cloudflare R2 |

> 注意：`impl-plan.md` 第 1/2/3/6 节已按上述定稿同步（原提案的原生 H5 / SQLite / 本地目录已废弃；现用 Prisma 替代 `pg`，Bun 替代 npm）。
>
> **语言：TypeScript**——前后端源文件统一为 `.ts` / `.tsx`。
> **登录形态：单用户**——不提供注册，账号固定 `admin`，由 `bun run seed` 初始化。

---

## 数据模型（概要）

- `users`：id、username、password_salt、password_hash
- `locations`：id、user_id、name、note
- `clothes`：id、user_id、location_id（可空=未分配）、name、photo_url（R2 URL，必填）

所有查询必须带 `user_id`，保证用户数据隔离。

---

## 核心功能

1. 管理地点（增删改查，列表显示各地点衣物数量）
2. 管理衣物（仅名称 + 照片必填）
3. 衣物归属地点（删地点时其下衣物置空为"未分配"）
4. 简单账号密码登录（注册/登录/登出，数据隔离）
5. 仅手机端（竖屏优先、拍照录入、可加到主屏）

---

## 组件库：shadcn/ui

UI 一律用 shadcn/ui，**不要手写重复的 Button / Input / Card 等基础组件**。

- 组件源码进仓库（不是 npm 依赖），路径：`web/src/components/ui/`
- 底层为 Radix UI + Tailwind CSS，类名合并用 `cn()`（`web/src/lib/utils.ts`）
- 配置：`web/components.json`
- 新增组件：`cd web && bunx shadcn@latest add button input card`
- 主题令牌（圆角、主色等）写在样式入口的 CSS 变量里，改主题只动变量

**使用约定**
- 优先复用 `ui/` 下已有组件；需要变体用 `className` 覆盖，不要复制一份再改
- 移动端优先：输入框/按钮点击区不小于 44px，输入框字号 ≥16px（低于会被 iOS 自动放大页面）
- 图标用 `lucide-react`

---

## 组件测试（Vitest + Testing Library）

React 组件的单元测试，隔离、快速，用于覆盖交互细节与状态分支。

- 框架：Vitest + `@testing-library/react`（jsdom 环境）
- 位置：与组件同目录，命名 `*.test.tsx`（如 `src/pages/Auth.test.tsx`）
- 运行：`cd web && bun run test`；监听模式 `bun run test:watch`
- 初始化文件：`src/test/setup.ts`——注入 jest-dom 断言，每个用例后自动 cleanup 并清空 localStorage

**编写约定**
- 用 `vi.mock("@/api")` 隔离网络层，组件测试**不依赖真实后端**
- 查询优先 `getByRole` / `getByLabelText`，与 e2e 保持同一套习惯
- 断言用 jest-dom 匹配器：`toBeVisible()` / `toHaveValue()` / `toBeDisabled()`
- 异步等待用 `findBy*` 或 `waitFor`，不要用固定 sleep
- **版本约束**：当前 Vite 5，必须配 vitest 3（vitest 5 要求 Vite 6+，会报 peer 冲突）

**与 e2e 的分工**
- 组件测试：隔离后端，覆盖表单校验、加载/禁用/报错等状态分支
- e2e：真实浏览器 + 真实前后端，覆盖关键主流程
- 两者都要写：组件测试改起来快，e2e 保证端到端真的通

---

## e2e 测试（Playwright）

功能改动需**同步补 e2e 用例**，改完本地跑通再提交。

- 用例目录：`web/e2e/`（命名 `*.spec.ts`）；配置：`web/playwright.config.ts`
- 运行：`cd web && bun run e2e`；可视化调试：`bun run e2e:ui`
- **前置条件**：后端 3000 与前端 5173 需已在本地启动（配置里不自动拉起，避免端口冲突）
  指向其他地址：`E2E_BASE_URL=http://192.168.x.x:5173 bun run e2e`
- 浏览器：`channel: "chrome"` 直接驱动本机已安装的 Google Chrome，**无需下载 Playwright 自带浏览器**
- **必须串行**：`workers: 1`。并行开多个 Chrome 曾把登录请求压到 5s 超时
- 视口固定 iPhone 13（产品只面向手机端）

**踩过的坑（别再踩）**
- `devices["iPhone 13"]` 默认走 webkit，叠加 `channel: "chrome"` 会报 `Unsupported webkit channel "chrome"`，
  必须显式加 `browserName: "chromium"`
- `getByText("地点")` 这类短文案会同时命中多处，需 `{ exact: true }`
- 选择器优先 `getByRole` / `getByLabel`，少依赖 class 名

**当前覆盖**：登录流程 6 个用例（预填 admin、无注册入口、密码错误提示、登录进概览、刷新保持登录、登出后刷新不恢复）

---

## 实施阶段（详见 impl-plan.md）

1. 后端骨架与 PostgreSQL
2. 账号密码登录
3. 地点管理
4. 衣物管理与照片上传（Cloudflare R2）
5. 移动端适配与联调
6. 云端部署
7. 验收

---

## 范围边界

**本期不做**：衣物类别/颜色等扩展字段、找回密码/第三方登录、多用户共享、穿搭推荐、PC 端。
**后续可迭代**：图片缩略图、搜索统计、前端直传 R2（预签名 URL）。

---

## 待确认小决策（实施前）

1. ~~前端用 JS 还是 TS？~~ → **已定：TypeScript**
2. ~~后端是否引入 TS / 分层架构？~~ → **已定：TypeScript**
3. Cloudflare 用 R2 还是 Images？直传还是后端中转？
4. 后端托管目标（容器 / 云服务器 / 其他）？
5. ~~PostgreSQL 用自托管还是托管？~~ → **已定：托管（当前用 pandastack）**
