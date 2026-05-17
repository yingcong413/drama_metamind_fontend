# CLAUDE.md

本目录是 **「制影 AI · 短剧工坊」** 的**纯前端**代码。给网剧团队用的网剧创作工具，前端独立仓库，不含任何后端代码。后端约定走 `/api/v1/*`，开发态由 [vite.config.ts](vite.config.ts) 代理到 `http://localhost:8080`。

## 技术栈

- **构建** Vite 5 + TypeScript 5（`tsc -b && vite build`）
- **UI** React 18（函数组件 + Hooks，无 class）
- **路由** react-router-dom v6（`createBrowserRouter`，见 [src/router.tsx](src/router.tsx)）
- **服务端状态** @tanstack/react-query v5
- **客户端状态** zustand v5（`auth`、`theme` 两个 store，持久化到 localStorage）
- **HTTP** axios，统一封装在 [src/api/client.ts](src/api/client.ts)
- **样式** 单文件 `src/styles/app.css`(~2400 行，从设计原型整体迁移），靠 CSS 变量 + `data-theme="dark|light"` 切换主题。**不使用** Tailwind、CSS Modules、styled-components
- **路径别名** `@/` → `src/`（见 [vite.config.ts](vite.config.ts) 与 [tsconfig.json](tsconfig.json)）

## 业务模型（理解代码前必读）

一个 **Project**（短剧项目）由三层组成，对应编辑器左侧导航：

1. **GlobalLayer** — 跨分镜的全局设定：时间/场景/站位图/影像风格/角色调用/故事内容（字段 01–06）
2. **Shot[]** — 分镜数组，每个分镜独立填：出场角色/动作/微表情/小动作/运镜/台词/独白/旁白/音效（字段 10–17）
3. **OutputLayer** — 输出层：环境音效/字幕/背景音乐（字段 07–09）

字段编号、必填/可选标签、模块帮助文案集中在 [src/lib/fieldDefs.ts](src/lib/fieldDefs.ts)。**必填校验**（决定"生成视频"按钮是否可点）在 [src/lib/validators.ts](src/lib/validators.ts) `computeValidation`：要求 `global.characters`、`global.story`、以及**每个分镜的 action**。

**Character** 是跨项目复用的全局资源（[角色库页面](src/pages/characters/CharactersPage.tsx)），项目里只通过角色 id 引用。

类型定义全部在 [src/types/](src/types/)，与后端契约一一对应；改动时同步 `src/types/` 和 mock 数据。

## 目录约定

```
src/
├── main.tsx, App.tsx, router.tsx   入口 / 壳 / 路由表
├── types/        与后端契约对齐的 TS 类型
├── api/          HTTP 层；每个资源一个文件（projects/characters/tasks/account/auth）
│   ├── client.ts axios 实例 + 拦截器（鉴权头、解包 ApiResponse、归一 ApiError）
│   └── _mock.ts  本地 mock 数据，通过 USE_MOCK 开关切换
├── stores/       zustand（auth、theme）
├── lib/          纯函数工具（cn、format、validators、fieldDefs、serialize…）
├── components/
│   ├── icons/    单文件 SVG 图标库
│   ├── layout/   AppTopBar 顶栏（所有页面共用）
│   └── primitives/  无业务的基础组件（Avatar/Field/Tag/Toggle/Upload/ChipSelect…）
├── pages/
│   ├── dashboard/  项目列表（含搜索、状态筛选）
│   ├── editor/     主创作面板（GlobalLayerView + ShotView + ShotTimeline），字段组件在 editor/fields/F*.tsx
│   ├── characters/ 角色库（画廊 / 列表两种视图 + Drawer 编辑）
│   ├── result/     生成结果预览（VideoStage + ShotStrip + ShotInfoCard + RatingCard）
│   ├── account/    使用记录 + 充值
│   └── login/      手机验证码 / 密码两种登录方式
└── styles/app.css  全局样式，所有页面共用
```

## API 调用约定

后端返回统一形如 `{ code, message, data }`（[src/types/api.ts](src/types/api.ts)）。`client.ts` 拦截器**自动解包** `data` 并在 `code !== 0` 时抛 `ApiError`。所以每个 api 函数（如 [src/api/projects.ts](src/api/projects.ts)）直接 `return get<Project>(...)` 拿到的就是 `data` 本身，不要再 `.data` 一次。

**Mock 模式**：`.env.development` 里 `VITE_USE_MOCK=true` 时，所有 api 函数走 `_mock.ts`（不发真实请求）。每个 api 文件按这个模式分支：

```ts
export function listProjects(params) {
  if (USE_MOCK) return mockListProjects(params);
  return get<Pagination<ProjectListItem>>("/projects", params);
}
```

新增接口时**同时**写真实调用 + mock 实现，否则切换 mock 时会断。

## 编码风格 / 注意事项

- **不写**注释/JSDoc，除非有非显然的 why；命名直白即可
- 表单状态用本地 `useState`；服务端数据用 `useQuery` / `useMutation`；跨页持久化用 zustand
- 顶栏由 [`AppTopBar`](src/components/layout/AppTopBar.tsx) 提供，每个页面传 `crumbs` 和 `actions` 即可
- 样式**优先复用** `app.css` 已有的 class（`.btn`、`.btn-primary`、`.segmented`、`.dim`、`.mono`、`.input` 等），实在不行再加新 class
- 类型一律走 `@/types`（重新导出在 [src/types/index.ts](src/types/index.ts)）
- 中文 UI 文案直接写在组件里；不引 i18n 框架

## 常用命令

```bash
npm run dev         # 本地开发（默认 mock 模式，访问 http://localhost:5173）
npm run build       # tsc 类型检查 + Vite 构建
npm run typecheck   # 只跑类型检查
npm run lint        # ESLint
npm run preview     # 预览构建产物
```

切到真实后端：在 `.env.development` 或 `.env.local` 设 `VITE_USE_MOCK=false`。
