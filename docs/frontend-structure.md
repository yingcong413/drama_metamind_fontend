# 制影 AI · 前端代码结构设计

> 配套文档：[api-contract.md](./api-contract.md)
> 技术栈：Vite + React 18 + TypeScript 5 + React Router 6 + Zustand + TanStack Query + Axios
> 样式：直接迁移原型的 `styles.css`（CSS 变量 + `data-theme` 切换），不引入 UI 库——原型 UI 风格独特，引入 Ant Design / shadcn 反而会破坏视觉一致性。

---

## 1. 技术选型说明

| 关注点         | 选择                  | 理由                                                                  |
| -------------- | --------------------- | --------------------------------------------------------------------- |
| 构建工具       | **Vite**              | 快，开箱即用 TS / JSX / HMR；比 CRA 现代                              |
| 路由           | **React Router v6**   | 6 个页面 + 动态参数（项目 ID、任务 ID），数据路由能力够用              |
| 服务端状态     | **TanStack Query v5** | 缓存、轮询、SSE 集成、乐观更新；编辑器自动保存场景非常合适            |
| 客户端状态     | **Zustand**           | 比 Redux 轻；只用在 auth / theme / meta / 编辑器草稿这几个全局店里     |
| HTTP           | **Axios**             | 拦截器统一处理鉴权、错误码、统一响应壳的解包                          |
| 样式           | **原 CSS 直接迁移**   | 原型已有 2400 行精雕细琢的 CSS，全套 OKLCH 色彩 + 暗黑/明亮主题，不重写 |
| 表单           | **受控组件**          | 不引入 react-hook-form——表单都很轻，受控足够，校验跟后端共享一份逻辑   |
| 图标           | **内联 SVG**          | 沿用原型 [components.jsx](metamind-duanju/project/components.jsx) 的 `Icon` |
| 测试（可选）   | Vitest + RTL          | 关键 hooks 和序列化逻辑写单测                                         |

---

## 2. 目录树

```
metamind-duanju-web/
├── public/
│   └── favicon.svg
├── src/
│   ├── main.tsx                  # 入口：挂载 App + QueryClient + Router
│   ├── App.tsx                   # 顶层壳：主题应用、全局 Toast 容器
│   ├── router.tsx                # 路由表
│   │
│   ├── types/                    # 全部数据模型（与后端契约一一对应）
│   │   ├── index.ts              # 统一 re-export
│   │   ├── api.ts                # ApiResponse<T>、ApiError、Pagination
│   │   ├── auth.ts               # User、LoginPayload
│   │   ├── character.ts          # Character
│   │   ├── project.ts            # Project / GlobalLayer / Shot / OutputLayer / CameraMove ...
│   │   ├── generation.ts         # GenerationTask / PromptSnapshot
│   │   ├── account.ts            # Account / RechargePackage / RechargeOrder
│   │   └── meta.ts               # MetaOptions 枚举
│   │
│   ├── api/                      # HTTP 调用层（每个模块一个文件）
│   │   ├── client.ts             # axios 实例 + 拦截器（token、解包、错误归一化）
│   │   ├── auth.ts               # sendSms / login / register / logout / fetchMe
│   │   ├── uploads.ts            # uploadImage / uploadAudio
│   │   ├── characters.ts         # listCharacters / createCharacter / ...
│   │   ├── projects.ts           # listProjects / getProject / saveProject / shots CRUD
│   │   ├── generations.ts        # submitGeneration / getGeneration / streamGeneration (SSE)
│   │   ├── tasks.ts              # listTasks / getTask / downloadTask
│   │   ├── account.ts            # getAccount / listRecharges / createRecharge / pollRecharge
│   │   ├── meta.ts               # getMetaOptions
│   │   └── prompt.ts             # previewPrompt / polishPrompt
│   │
│   ├── stores/                   # Zustand 全局 store（只放真"全局"的状态）
│   │   ├── auth.ts               # token / user / login / logout
│   │   ├── theme.ts              # 'dark' | 'light'，持久化到 localStorage
│   │   ├── meta.ts               # 启动时拉一次缓存
│   │   └── editor.ts             # 当前编辑项目草稿 + UI 状态（折叠、激活分镜）
│   │
│   ├── hooks/                    # 通用 hooks
│   │   ├── useDebounce.ts
│   │   ├── useSSE.ts             # EventSource 封装 + 自动降级轮询
│   │   ├── useAutosave.ts        # 字段失焦自动 PATCH
│   │   ├── useValidation.ts      # 前端校验（与后端规则同步）
│   │   ├── useScrollAnchor.ts    # 编辑器左侧导航点击滚动到锚点
│   │   └── useCopyToClipboard.ts
│   │
│   ├── lib/                      # 纯函数工具（无 React、无副作用）
│   │   ├── serialize.ts          # Project → 结构化 JSON（迁移自 editor.jsx#serialize）
│   │   ├── naturalLanguage.ts    # Project → 自然语言提示词（迁移自 PromptNatural）
│   │   ├── validators.ts         # computeValidation / isFilled / isShotFilled
│   │   ├── avatarHue.ts          # 名字 → 色相
│   │   ├── format.ts             # 时间、金额、电话脱敏
│   │   └── cn.ts                 # className 合并（替代 clsx）
│   │
│   ├── components/               # 跨页面共享组件
│   │   ├── layout/
│   │   │   ├── AppTopBar.tsx     # 顶栏（含品牌、面包屑、tab、主题切换、头像）
│   │   │   └── PageShell.tsx     # 通用页面外框（topbar + slot）
│   │   ├── icons/
│   │   │   └── index.tsx         # 全部 SVG 图标，命名导出 export { Plus, Trash, ... }
│   │   ├── primitives/           # 基础 UI 原子
│   │   │   ├── Button.tsx        # variant: primary | ghost | link，size: sm | md | lg
│   │   │   ├── Input.tsx
│   │   │   ├── Textarea.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Toggle.tsx
│   │   │   ├── Tag.tsx           # req / opt / upload / audio
│   │   │   ├── ChipSelect.tsx    # 单选 / 多选可切
│   │   │   ├── LayerChip.tsx     # 全局/分镜/输出三层色块
│   │   │   ├── Avatar.tsx
│   │   │   ├── Field.tsx         # 字段外壳（标题、tags、help、example）
│   │   │   ├── Upload.tsx        # 拖拽上传区域
│   │   │   ├── Placeholder.tsx
│   │   │   └── Segmented.tsx     # 分段控件
│   │   └── feedback/
│   │       ├── Toast.tsx         # 配合 sonner / react-hot-toast
│   │       ├── Modal.tsx         # 居中弹窗
│   │       ├── Drawer.tsx        # 右侧抽屉（角色编辑用）
│   │       └── ConfirmDialog.tsx # 危险操作二次确认
│   │
│   ├── pages/                    # 6 个页面，各自独立目录
│   │   ├── login/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── PhoneCodeForm.tsx
│   │   │   └── PasswordForm.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── ProjectCard.tsx
│   │   │   ├── NewProjectCard.tsx
│   │   │   └── DashboardToolbar.tsx
│   │   │
│   │   ├── editor/
│   │   │   ├── EditorPage.tsx               # 主壳：左导航 + 主内容 + 底部时间轴
│   │   │   ├── EditorNav.tsx                # 左侧字段树
│   │   │   ├── ShotTimeline.tsx             # 底部分镜时间轴
│   │   │   ├── GlobalLayerView.tsx          # 全局场景层（字段 01-06）
│   │   │   ├── ShotView.tsx                 # 分镜视图（字段 07-14）
│   │   │   ├── OutputLayerView.tsx          # 输出层（字段 15-17）
│   │   │   ├── ModuleHead.tsx               # 字段标题区
│   │   │   ├── SubCard.tsx                  # 分镜内的子字段卡片
│   │   │   ├── PromptPreviewPane.tsx        # 右侧预览（结构化/自然语言/历史 三 tab）
│   │   │   ├── PromptJson.tsx
│   │   │   ├── PromptNatural.tsx
│   │   │   ├── HistoryPane.tsx
│   │   │   ├── PrevContext.tsx              # "上一个分镜以 X 结束"
│   │   │   ├── fields/                      # 17 个字段组件（每个字段一个文件）
│   │   │   │   ├── FTime.tsx                # 01
│   │   │   │   ├── FScene.tsx               # 02
│   │   │   │   ├── FPosition.tsx            # 03
│   │   │   │   ├── FStyle.tsx               # 04
│   │   │   │   ├── FCharacters.tsx          # 05
│   │   │   │   ├── FStory.tsx               # 06
│   │   │   │   ├── FShotCast.tsx            # 分镜出场角色（00）
│   │   │   │   ├── FAction.tsx              # 07
│   │   │   │   ├── FMicro.tsx               # 08
│   │   │   │   ├── FGesture.tsx             # 09
│   │   │   │   ├── FCamera.tsx              # 10
│   │   │   │   ├── FSpeech.tsx              # 11 / 12 / 13 共用
│   │   │   │   ├── FSfx.tsx                 # 14
│   │   │   │   ├── FAmbientSfx.tsx          # 15
│   │   │   │   ├── FSubtitle.tsx            # 16
│   │   │   │   └── FToggle.tsx              # 17（music）
│   │   │   └── useEditorActions.ts          # addShot / duplicateShot / deleteShot 等
│   │   │
│   │   ├── characters/
│   │   │   ├── CharactersPage.tsx
│   │   │   ├── CharacterGallery.tsx         # 画廊视图
│   │   │   ├── CharacterList.tsx            # 列表视图
│   │   │   ├── CharacterTile.tsx
│   │   │   ├── CharacterDrawer.tsx          # 右侧编辑抽屉
│   │   │   └── Portrait.tsx                 # 角色头像（含 hue 渐变占位）
│   │   │
│   │   ├── result/
│   │   │   ├── ResultPage.tsx
│   │   │   ├── VideoStage.tsx               # 视频预览区
│   │   │   ├── VideoControls.tsx
│   │   │   ├── ShotStrip.tsx                # 底部分镜条
│   │   │   ├── ShotInfoCard.tsx
│   │   │   ├── RatingCard.tsx
│   │   │   └── PromptPanel.tsx              # 右侧"本次生成所用提示词"
│   │   │
│   │   └── account/
│   │       ├── AccountPage.tsx
│   │       ├── BalanceHero.tsx              # 头部余额 + 三项统计
│   │       ├── TasksTable.tsx               # 任务记录表格
│   │       ├── TasksFilters.tsx             # 任务筛选器
│   │       ├── TasksPagination.tsx
│   │       ├── StatusBadge.tsx              # 成功/进行中/排队中/失败
│   │       ├── RechargesTable.tsx           # 充值记录
│   │       ├── RechargeDialog.tsx           # 充值弹窗（套餐 + 自定义 + 支付方式）
│   │       └── VideoPreviewModal.tsx        # 点行"预览视频"弹窗
│   │
│   ├── styles/                   # 全部样式
│   │   ├── index.css             # 入口，import 其他
│   │   ├── tokens.css            # CSS 变量（颜色、间距、字体）
│   │   ├── reset.css             # 基础重置
│   │   ├── globals.css           # body / html / 滚动条 / 选区
│   │   └── components.css        # 从原 styles.css 迁移过来
│   │
│   └── assets/
│       └── icons/                # 如有需引用的图片（暂无）
│
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts                # 含 path alias `@/` → `src/`、代理 /api → 后端
├── .eslintrc.cjs
├── .prettierrc
├── .env.example                  # VITE_API_BASE_URL=...
├── .env.development
├── .gitignore
└── README.md
```

---

## 3. 各层文件职责详解

### 3.1 `types/` — 类型定义

只放接口、枚举、类型别名，**不放任何运行时代码**。每个文件对应 `api-contract.md` 第 2 节的一个数据模型。

示例 `types/project.ts`：
```ts
export type ProjectStatus = "draft" | "gen" | "done";

export interface Project { /* 完全照搬契约文档 */ }
export interface GlobalLayer { /* ... */ }
export interface Shot { /* ... */ }
// ...
```

### 3.2 `api/` — HTTP 调用层

每个文件对应契约文档的一个模块。**每个函数只做一件事：发请求 + 返类型化数据。** 不做缓存、不做状态。

- `client.ts` 三个拦截器：
  1. 请求拦截：自动注入 `Authorization` header
  2. 响应拦截：解包 `{ code, data, message }`，`code !== 0` 抛 `ApiError`
  3. 响应拦截：监听 `X-Refresh-Token` 头，更新 store

示例 `api/projects.ts`：
```ts
import { client } from "./client";
import type { Project, Pagination } from "@/types";

export const listProjects = (params: { status?: string; q?: string; page?: number }) =>
  client.get<Pagination<Project>>("/projects", { params });

export const getProject = (id: string) =>
  client.get<Project>(`/projects/${id}`);

export const saveProject = (id: string, body: Project) =>
  client.post<Project>(`/projects/${id}/save`, body);

// ... shots CRUD
```

### 3.3 `stores/` — 客户端全局状态

只放四类真正全局的状态：

| store     | 内容                            | 持久化      |
| --------- | ------------------------------- | ----------- |
| `auth`    | `token`、`user`、`login/logout` | localStorage |
| `theme`   | `'dark' \| 'light'`             | localStorage |
| `meta`    | 启动时拉取的枚举                | sessionStorage |
| `editor`  | 当前编辑项目 + UI 状态（折叠、激活分镜、滚动锚点） | 不持久化    |

**业务数据（项目列表、角色列表、任务列表）不进 store，统一走 TanStack Query 管理。**

### 3.4 `hooks/` — 通用 hooks

```ts
// useSSE.ts 签名
function useSSE<T>(url: string | null, options?: {
  fallbackPoll?: () => Promise<T>;
  pollInterval?: number;
  onMessage?: (data: T) => void;
}): { data: T | null; status: "connecting" | "open" | "closed" | "polling" };
```

`useAutosave` 是编辑器的核心：监听字段变化 → debounce 800ms → 调 `PATCH /projects/:id`，期间显示"保存中..."。

### 3.5 `lib/` — 纯函数工具

- `serialize.ts`：把 `Project` 转成 prompt JSON（迁移自原型 `editor.jsx#serialize`），**前后端共用一份逻辑，要写测试**。
- `naturalLanguage.ts`：把 `Project` 转成自然语言段落（迁移自 `PromptNatural`）。
- `validators.ts`：迁移自 `computeValidation / isFilled / isShotFilled / isOutputFilled`，与后端校验规则保持一致。

### 3.6 `components/` — 共享组件

`primitives/` 是从原型 `components.jsx` 拆出来的基础原子，跨页面复用。每个原子文件 < 80 行。

`AppTopBar` 是所有页面共用的顶栏，接受 `crumbs` 和 `actions` 两个 slot。

### 3.7 `pages/` — 页面与子组件

每个页面一个目录。**只有该页面用的子组件就放在页面目录里，不放进 `components/`。** 避免共享组件目录膨胀。

`pages/editor/` 是最复杂的页面，专门设了 `fields/` 子目录放 17 个字段组件——每个字段一个文件，复用性差但隔离性好，方便修改。

### 3.8 `styles/`

直接搬原型的 `styles.css`，拆成 4 个文件：
- `tokens.css` — CSS 变量（`--surface`、`--text`、`--accent` 等，含 dark/light 两套）
- `reset.css` — 基础重置
- `globals.css` — body、滚动条、选区
- `components.css` — 所有 `.btn`、`.input`、`.card`、`.editor`、`.dash` 等类

整套通过 `data-theme` 切换暗黑/明亮，不引入 styled-components 或 CSS-in-JS。

---

## 4. 关键约定

1. **路径别名**：`@/` 指向 `src/`。所有 import 不用相对路径越级。
2. **组件命名**：PascalCase，文件名 = 默认导出组件名。
3. **类型导入**：`import type { ... }` 单独写，方便 tree-shake。
4. **API 响应解包**：在拦截器统一做，业务代码拿到的就是 `data`，不再写 `.data.data`。
5. **错误处理**：拦截器把后端错误统一转 `ApiError`（含 `code`、`message`、`fields`），页面用 `try/catch` 或 TanStack Query 的 `error` 字段处理，错误 toast 在 `client.ts` 默认弹一条，业务可以局部禁用。
6. **环境变量**：以 `VITE_` 开头，仅 `VITE_API_BASE_URL`。生产部署改 nginx 反代，开发环境用 `vite.config.ts` 里的 `server.proxy`。
7. **国际化**：先不上 i18n。所有中文写死，等真有海外需求再抽。

---

## 5. 路由表（`router.tsx`）

```ts
const router = createBrowserRouter([
  { path: "/login",         element: <LoginPage /> },
  {
    element: <AuthGuard><PageShell /></AuthGuard>,   // 校验登录 + 套顶栏
    children: [
      { path: "/",                  element: <Navigate to="/dashboard" /> },
      { path: "/dashboard",         element: <DashboardPage /> },
      { path: "/projects/:id/edit", element: <EditorPage /> },
      { path: "/projects/:id/result/:taskId?", element: <ResultPage /> },
      { path: "/characters",        element: <CharactersPage /> },
      { path: "/account",           element: <AccountPage /> },
    ],
  },
]);
```

---

## 6. 与契约文档的对应关系

| 契约模块            | 前端文件                                   |
| ------------------- | ------------------------------------------ |
| 通用响应壳 / 错误码 | `api/client.ts`、`types/api.ts`           |
| 鉴权                | `api/auth.ts`、`stores/auth.ts`、`pages/login/` |
| 上传                | `api/uploads.ts`、`components/primitives/Upload.tsx` |
| 角色库              | `api/characters.ts`、`pages/characters/`   |
| 项目与分镜          | `api/projects.ts`、`stores/editor.ts`、`pages/editor/` |
| 生成与任务          | `api/generations.ts`、`pages/result/`、`hooks/useSSE.ts` |
| 任务记录            | `api/tasks.ts`、`pages/account/TasksTable.tsx` |
| 账户与充值          | `api/account.ts`、`pages/account/` |
| 元数据              | `api/meta.ts`、`stores/meta.ts` |
| 提示词预览 / 润色   | `api/prompt.ts`、`pages/editor/PromptPreviewPane.tsx` |

---

## 7. 文件数量估算

| 目录             | 文件数 | 说明                          |
| ---------------- | -----: | ----------------------------- |
| `types/`         |      8 |                               |
| `api/`           |     10 |                               |
| `stores/`        |      4 |                               |
| `hooks/`         |      6 |                               |
| `lib/`           |      6 |                               |
| `components/`    |     22 | layout 2 + icons 1 + primitives 13 + feedback 4 + index |
| `pages/login/`   |      3 |                               |
| `pages/dashboard/` |    4 |                               |
| `pages/editor/`  |     30 | 含 17 个字段组件               |
| `pages/characters/` |   6 |                               |
| `pages/result/`  |      7 |                               |
| `pages/account/` |      9 |                               |
| `styles/`        |      5 |                               |
| 配置 / 入口      |     10 | vite/ts/eslint/env 等          |
| **合计**         | **~130** | 约 8000-10000 行 TS + 2400 行 CSS |

---

## 8. 下一步建议

1. 这份结构和契约一起发给后端评审，确认接口路径、数据形状无误。
2. 评审通过后，按以下顺序生成代码：
   1. 工程初始化（`package.json`、`vite.config.ts`、`tsconfig.json` 等配置）
   2. `types/` + `api/client.ts` + `api/*.ts`（先把契约落成 TS）
   3. `stores/` + `hooks/` + `lib/`（基础设施）
   4. `styles/`（直接迁移）
   5. `components/`（共享原子）
   6. `pages/`（按依赖顺序：login → dashboard → characters → editor → result → account）
3. 联调阶段后端可以先返 mock，前端 100% 可独立跑通界面。
