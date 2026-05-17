# 制影 AI · 短剧工坊 — Web

> 当前进度：**只实现了工作台（Dashboard）**。其他 5 个页面是占位，验证工作台联调通过后再补。

## 环境要求

- Node.js ≥ 18（推荐 20）
- pnpm / npm / yarn 任选

## 本地启动

```bash
cd web
npm install
npm run dev
```

启动后访问 [http://localhost:5173](http://localhost:5173)，会自动跳转到 `/dashboard`。

**默认开启 mock 模式**，不依赖后端，能直接看到 6 个项目卡片 + 状态筛选 + 搜索。

## 切换到真实后端

编辑 `.env.development`（或新建 `.env.local`）：

```env
VITE_API_BASE_URL=/api/v1
VITE_USE_MOCK=false
```

`vite.config.ts` 里已配好代理：开发态 `/api/*` 走 `http://localhost:8080`。后端端口不同的话改这里。

## 目录结构

```
web/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
└── src/
    ├── main.tsx                  入口
    ├── App.tsx                   全局壳（QueryClient + Router + 主题）
    ├── router.tsx                路由表
    ├── types/                    类型定义（对应 docs/api-contract.md）
    │   ├── api.ts                ApiResponse / Pagination / ApiError
    │   ├── auth.ts
    │   ├── character.ts
    │   ├── project.ts
    │   ├── meta.ts
    │   └── index.ts
    ├── api/                      HTTP 调用层
    │   ├── client.ts             axios 实例 + 拦截器（鉴权/解包/错误归一）
    │   ├── projects.ts           工作台用到
    │   └── _mock.ts              本地 mock 数据
    ├── stores/                   Zustand 客户端 store
    │   ├── auth.ts               token + user，持久化 localStorage
    │   └── theme.ts              dark / light，持久化 localStorage
    ├── lib/                      纯函数
    │   ├── cn.ts                 className 合并
    │   ├── format.ts             时间 / 时长格式化
    │   └── avatarHue.ts          名字 → 色相
    ├── components/
    │   ├── icons/index.tsx       SVG 图标
    │   ├── layout/AppTopBar.tsx  顶栏（含品牌、面包屑、tab、主题、头像）
    │   └── primitives/Avatar.tsx
    ├── pages/
    │   ├── ComingSoonPage.tsx    其他 5 个页面的占位
    │   └── dashboard/
    │       ├── DashboardPage.tsx 主入口
    │       ├── ProjectCard.tsx
    │       ├── NewProjectCard.tsx
    │       └── DashboardToolbar.tsx
    └── styles/
        └── app.css               原型整套 styles.css 直接迁移（2379 行）
```

## 联调验收点

打开 [http://localhost:5173](http://localhost:5173) 应该看到：

1. **顶栏** — 品牌"制影 AI"、面包屑"/ 工作台"、中间 6 个 tab、右侧 主题/通知/头像
2. **顶栏交互** — 点击右上太阳/月亮图标切换暗/亮主题；点击 tab 切到对应页面（其他 5 个会显示"COMING SOON"占位）
3. **页面头** — "我的短剧项目" + "共 6 个项目 · 上次同步刚刚"
4. **工具栏** — 段控件（全部 / 草稿 · 3 / 已生成 · 3 / 生成中 · 0）+ 搜索框 + "新建项目"按钮
5. **项目网格** — 1 个"新建项目"卡片 + 6 个项目卡片，每个有渐变封面、状态徽章（已生成 / 草稿 / 生成中）、分镜数、时长、相对时间
6. **筛选** — 点段控件能按状态筛选
7. **搜索** — 输入框输入"雨夜"能即时过滤
8. **网络面板** — DevTools Network 里能看到对 mock 数据的"请求"（mock 模式下没真实 HTTP，但接口调用走的是和真实接口完全一致的函数签名）

## 后续步骤

1. ✅ 工作台跑通
2. ⬜ 后端实现 `GET /api/v1/projects` → 切换 `VITE_USE_MOCK=false` 联调
3. ⬜ 按 [docs/frontend-structure.md](../docs/frontend-structure.md) 第 8 节顺序补其他页面

## 常用命令

```bash
npm run dev        # 开发
npm run build      # 构建
npm run preview    # 本地预览构建产物
npm run typecheck  # 类型检查
```
