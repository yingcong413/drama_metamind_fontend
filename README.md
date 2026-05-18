# 制影 AI · 短剧工坊

给网剧团队创作网剧的工具。本仓库是**前端 + 接口契约**,后端独立(另仓)。

## 仓库结构

```
.
├── web/    前端工程(React + Vite + TS),6 个页面已完成
└── docs/   前后端接口契约 + 前端结构文档(后端联调以此为准)
```

- **`web/`** — 纯前端,默认 mock 模式可独立跑,不依赖后端
- **`docs/api-contract.md`** — 接口契约(当前 v0.3),后端实现以这份为准
- **`web/HANDOFF.html`** — 给后端同事的一页纸联调交接说明
- **`web/CLAUDE.md`** — 项目背景与约定(给 AI / 新人快速理解代码)

## 进度

6 个页面全部完成:工作台 / 编辑器 / 角色库 / 生成结果 / 使用记录 / 登录。
当前所有数据走前端本地 mock,等后端按契约实现接口后切换联调。

## 本地启动

```bash
cd web
npm install
npm run dev
```

访问 [http://localhost:5173](http://localhost:5173),自动跳 `/dashboard`。
**默认 mock 模式**,不依赖后端,所有页面都能点。

## 切换到真实后端

编辑 `web/.env.development`(或新建 `web/.env.local`):

```env
VITE_API_BASE_URL=/api/v1
VITE_USE_MOCK=false
```

`web/vite.config.ts` 里已配好代理:开发态 `/api/*` 走 `http://localhost:8080`,后端端口不同就改这里。
联调步骤详见 [web/HANDOFF.html](web/HANDOFF.html)。

## 常用命令(在 `web/` 下)

```bash
npm run dev            # 开发(mock 模式)
npm run build          # 生产构建(tsc 类型检查 + vite build,mock 关)
npm run build:preview  # 构建一份带 mock 的产物
npm run preview:mock   # 一键:构建带 mock 产物 + 本地预览
npm run typecheck      # 只跑类型检查
npm run lint           # ESLint
```

## 技术栈

Vite 5 + React 18 + TypeScript 5 · react-router v6 · @tanstack/react-query v5 · zustand v5 · axios。
样式为单文件 `web/src/styles/app.css` + CSS 变量(暗/亮主题),不使用 Tailwind。
更多约定见 [web/CLAUDE.md](web/CLAUDE.md) 与 [docs/frontend-structure.md](docs/frontend-structure.md)。
