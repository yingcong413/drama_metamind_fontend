# 制影 AI · 短剧工坊 — 设计上下文（交给 Claude Design）

> 这份文档 + 同目录 `screens/` 里的截图，就是这个产品**目前的样子**（对应代码版本 **v2.0** / commit `04b0af4`）。
> 请你（Claude Design）先读懂现有设计语言，然后在**保持一致**的前提下继续设计新界面 / 新交互。
> 产出新设计后，会由开发同学按你的设计落地到现有 React + CSS 工程。

---

## 0. 一句话定位

**制影 AI · 短剧工坊** 是给网剧团队用的 **AI 短剧创作工具**：把一支短剧拆成「全局设定 → 逐个分镜 → 输出层」三层结构化填写，配合右侧大模型 AI 面板辅助生成素材，最后对接 **Seedance 2.0** 一键生成视频。纯前端 Web 应用（桌面优先，非移动端）。

界面语言：**多语言**（简/繁中文、English、Français、Español、العربية，阿语为 RTL）。气质：**专业、密集、克制的暗色工具**，像给创作者用的「分镜 IDE」，不是消费级花哨产品。

---

## 1. 设计语言总览

| 维度 | 取向 |
|---|---|
| 整体气质 | 暗色优先的专业创作工具，信息密度高，留白克制，强调"可扫读" |
| 主题 | **dark / light 双主题**，靠 `data-theme` 切换；暗色是默认 |
| 色彩模型 | **OKLCH**（不是 hex/hsl），保证跨色相同明度同彩度 |
| 字体 | 正文 Inter / PingFang SC；等宽 JetBrains Mono（编号、ID、技术性标签大量用等宽） |
| 圆角 | 4 / 6 / 10 / 14 / 20px 五档（xs→xl） |
| 强调色 | 暖琥珀金 accent（暗色 `oklch(76% .13 70)`） |
| 标志性手法 | **三层色相系统**：全局/分镜/输出三个数据层各有固定色相，贯穿全产品 |
| 国际化 | 全站 6 语言，以"中文原文为 key"轻量查表翻译；阿语 RTL |

### 三层色相系统（最重要的视觉特征）

产品核心信息架构是「全局层 / 分镜层 / 输出层」，每层绑定一个**固定色相**，同明度同彩度、只换 H：

| 层 | 含义 | 色相 H | 暗色取值 | 直觉 |
|---|---|---|---|---|
| **global** 全局层 | 跨分镜的全局设定 | 70 | `oklch(76% .13 70)` | 琥珀 amber |
| **shot** 分镜层 | 单个分镜的内容 | 150 | `oklch(76% .13 150)` | 鼠尾草绿 sage |
| **output** 输出层 | 字幕/音乐/环境音 | 290 | `oklch(76% .13 290)` | 紫罗兰 violet |

每层都有 `-soft` 变体（同色 14% 透明，作背景）。用在：左侧导航分组、layer-chip 徽章、字段示例左边框、选中态 chip 等。**新设计涉及"某个东西属于哪一层"时，务必沿用对应色相。**

---

## 2. 设计 Token（从 `src/styles/app.css` `:root` 逐字提取）

### 字体
```css
--font-sans: "Inter", "PingFang SC", "Noto Sans SC", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
--font-mono: "JetBrains Mono", "SF Mono", ui-monospace, Menlo, monospace;
/* 正文 14px / line-height 1.5；letter-spacing 0 */
```

### 暗色主题（默认）
```css
--bg:            #0B0B0E;   /* 页面底 */
--bg-elev:       #131318;   /* 顶栏/侧栏等抬升面 */
--surface:       #17171D;   /* 卡片 */
--surface-2:     #1E1E26;   /* 输入框底/次级面 */
--surface-3:     #262630;   /* 三级面/hover */
--border:        rgba(255,255,255,0.06);
--border-strong: rgba(255,255,255,0.12);
--text:          #ECECEE;
--text-secondary:#A0A0A8;
--text-tertiary: #6B6B73;
--accent:        oklch(76% .13 70);        /* 暖琥珀金 */
--accent-soft:   oklch(76% .13 70 / .14);
--accent-fg:     #0B0B0E;                  /* accent 上的文字（深） */
--danger:  oklch(67% .19 25);   /* 红 */
--info:    oklch(70% .13 230);  /* 蓝 */
--success: oklch(70% .14 150);  /* 绿 */
--audio:   oklch(70% .15 290);  /* 紫，音频相关 */
--shadow-pop: 0 16px 40px rgba(0,0,0,.5), 0 2px 6px rgba(0,0,0,.4);
--radius-xs:4px; --radius-sm:6px; --radius-md:10px; --radius-lg:14px; --radius-xl:20px;
```

### 浅色主题
```css
--bg:#FAFAF8; --bg-elev:#FFFFFF; --surface:#FFFFFF;
--surface-2:#F4F4F1; --surface-3:#EDEDE8;
--border:rgba(0,0,0,0.07); --border-strong:rgba(0,0,0,0.15);
--text:#1A1A1C; --text-secondary:#5A5A60; --text-tertiary:#8A8A92;
--accent:oklch(60% .14 60); --accent-fg:#FFFFFF;
/* 层色相浅色稍微压暗：global 55% / shot 50% / output 55% */
```

**任何新设计请用上面这些变量，不要引入新的硬编码颜色。** 需要新语义色时，沿用 OKLCH、保持 .13 左右彩度、76%（暗）/55%（浅）明度的基调。

---

## 3. 组件库（已有的，复用优先）

全部手写，**没用任何 UI 框架**（无 Tailwind / shadcn / MUI）。新设计应尽量沿用下面的视觉语言。

- **按钮 `.btn`**：6×12 padding，`radius-sm`，13px/500，底 `surface-2`+border。变体 `.btn-primary`（accent 底+深字）/`.btn-ghost`（透明）/`.btn-icon`（28px 方）/`.btn-sm`/`.btn-lg`/`.btn-link`；`:active` 有 `scale(.98)`。
- **标签 `.tag`**（等宽全大写胶囊）：`.tag-req` 红（必填）/`.tag-opt` 灰（可选）/`.tag-upload` 蓝（需上传）/`.tag-audio` 紫（音频）；`.dot-req` 红点。
- **层徽章 `.layer-chip`**：胶囊+小圆点，`.global/.shot/.output` 三变体用对应层色相 soft 底。
- **Chip 选择 `.chip`/`.chips`**：胶囊式可选项；`.selected` 用 accent，`.selected.global/.shot` 用层色相。
- **表单字段 `.field`**：`.field-header`（`.field-num` 等宽编号 + `.field-title` 14/600 + `.tag`）→ `.field-help`（12px tertiary）→ 控件 → `.field-example`（示例框，左边框 shot 色相）。
- **输入 `.input`/`.textarea`/`.select`**：底 `--bg`+border+`radius-sm`，`:focus` 边框转 accent。`.textarea-lg` 140px。
- **`.upload`** 虚线上传区；**`.thumb`** 4:3 缩略图，hover 出删除 X，`.selected` 加 accent 描边。
- **`.avatar`** 32/56/88 三档渐变首字母；**`.segmented`** 分段控制器；**`.toggle`** 32×18 开关；**`.card`** 卡片（surface+border+radius-lg）；**`.strength`** 强度滑块。
- **`.popover` / `.drawer`（右侧抽屉，库的编辑用）/ modal（视频预览、充值、改密码、新建项目命名等）**。
- **Lightbox 全屏图片预览**（`.lightbox-mask`/`.lightbox-img`）+ 卡片上的**放大角标 `.zoom-btn`**（角色/场景/道具卡通用）。

---

## 4. 布局骨架

### 顶栏 `.topbar`（所有页面共用，48px 高，sticky）
三段式：
- **左**：`.brand`（渐变方块「制」+「制影 AI」）+ `.crumb` 面包屑 + `leftExtra`（工作台用它放「生成模式」切换条）
- **中**（绝对居中，`.topnav`）：**项目 / 工作台 / 角色库 / 场景库 / 道具库 / 生成结果 / 使用记录** 七项分段器，当前项抬白；首尾帧/智能多帧的独立画面可 `hideNav` 隐藏它
- **右**：主题切换、**语言切换 `.lang-switch`**（地球图标+当前语言+下拉菜单）、通知铃、页面级 actions、**用户头像菜单**（账户与计费 / 组织管理[Owner] / 平台管理·手动充值·替人开企业·所有项目·账号管理[ADMIN] / 修改密码 / 退出登录）

### 编辑器布局 `.editor`（核心页，最复杂）
- 默认两列：`280px(nav) | 1fr(main)`（≤1440px 收 240px）
- **开 AI 面板时变三列**：`.editor.has-ai` → `280px | 1fr | 6px 可拖拽分界线 | var(--ai-w,392px)`
- **首尾帧/智能多帧模式**：`.editor.solo` 单列，主区 `.fc-page` 独占整宽
- `.main` 两行 grid：上 `.main-content`（字段表单自滚）+ 下 `.timeline-bar`（分镜时间轴，固定底部）
- **右栏 AI 面板 `.ai-panel`**：顶部模型选择（生图模型 / 文字模型）→ 对话气泡区（`.ai-msg.bot/.user`）→ 快捷生成卡（生成角色 / 生成场景 / 生成道具 / 生成分镜头脚本）→ 底部输入框。生成中有 shimmer/波形动画。

> 页面只需 `<AppTopBar crumbs actions leftExtra hideNav />`。

---

## 5. 业务模型（理解界面背后的数据）

一个 **Project（短剧项目）** = 三层：

**① GlobalLayer 全局层**（global 色相）—— 16 个字段：
`01 视频总时长(必填)` `02 画面比例` `03 视频分辨率` `04 场景(上传)` `05 站位图(上传)` `06 道具(上传)` `07 分镜头脚本(上传)` `08 影像风格` `09 角色调用(必填)` `10 故事内容(必填)` `11 画质内容` `11b 想象力约束(0–100 强度滑块)` `12 环境音效` `13 字幕` `14 背景音乐` `15 旁白音频(音频)`
（注：02/03/总时长等直接对接 **Seedance 2.0** 接口字段：ratio / resolution / 时长 5·8·11 秒等）

**② Shot[] 分镜数组**（shot 色相）每个分镜字段 11–20：
`11 景别` `12 分镜时长分配` `13 角色动作(必填)` `14 微表情控制` `15 小动作控制` `16 摄像机运动` `17 台词` `18 内心独白` `19 旁白` `20 关键动作音效`（除 13 外均可选）

**③ OutputLayer 输出层**（output 色相）：环境音效 / 字幕 / 背景音乐（即上面 12–14，归属输出层）。

**必填校验**（决定"生成视频"按钮是否可点）：`global.characters`、`global.story`、每个分镜的 `action`。

**全局复用资源（三个库，都是跨项目共享，项目里只引用）**：
- **角色库 Character**：名 / 参考图 / 描述 / 声线，支持**角色变体**；通过「字段 09 角色调用」引用
- **场景库 Scene**：名字 / 参考图；通过「字段 04 场景」引用
- **道具库 Prop**：名字 / 参考图；通过「字段 06 道具」引用
- 三个库页面共用同一套 `MediaLibrary` 组件（画廊/列表视图 + 卡片 + 抽屉编辑 + 放大预览）

**领域细节**（设计时可能用到）：
- **工作台生成模式**三种：`常规`（整套编辑器）/ `首尾帧` / `智能多帧`（后两者是独立合成画面 `FrameComposer`）
- **摄像机运动**三档共 16 种：基础 8（推/拉/左右摇/上下摇/升降）、进阶 4（跟拍/环绕/对拉/甩镜）、特殊 4（航拍/手持/POV/过肩）；部分需选方向，每个可调 速度(慢/中/快)×幅度(小/中/大)
- **景别**9 档：大远景→…→大特写
- **台词/独白/旁白** 都是 `{角色, 文字, 音频}` 结构

---

## 6. 页面清单（路由 + 职责）

| 路由 | 页面 | 职责 | 截图 |
|---|---|---|---|
| `/dashboard` | 项目列表 | 项目卡片网格 + 搜索 + 状态筛选(草稿/已生成/生成中) + 新建卡 | `dashboard.png` |
| `/editor`, `/projects/:id/edit` | **主创作面板** | 三栏：左导航 + 字段表单 + 右 AI 面板；底部分镜时间轴；顶部生成模式切换 | `editor.png` |
| `/characters` | 角色库 | 全局角色资源，画廊/列表双视图 + 抽屉编辑 + 变体 | `characters.png` |
| `/scenes` | 场景库 | 全局场景资源（名字/参考图），MediaLibrary | `scenes.png` |
| `/props` | 道具库 | 全局道具资源（名字/参考图），MediaLibrary | `props.png` |
| `/result`, `/projects/:id/result` | 生成结果 | 左视频台 + 右生成历史列表（成功态/分辨率 chip/时间/成本） | `result.png` |
| `/account` | 使用记录 | 用户卡 + 余额 hero + 消费统计 + 任务记录/充值记录表 + 充值弹窗 | `account.png` |
| `/org` | 组织管理 | 个人 Owner 看升级 CTA / 企业 Owner 看管理面板 / 成员看「离开组织」 | *(未截，按需补)* |
| `/admin/recharge`·`/create-org`·`/projects`·`/users` | 平台管理 | 仅平台管理员可见：手动充值 / 替人开企业 / 全平台项目 / 账号管理 | *(未截)* |
| `/login` | 登录 | 手机验证码 / 账号密码 / 微信扫码；左渐变插画右表单 | `login.png` |

> 全站路由都包 `RequireAuth`（无 token 跳 `/login`），仅 `/login` 公开。

---

## 7. 截图索引（`screens/` 目录）

全部为**当前 v2.0 真实界面**，桌面视口 1512px，**暗色主题**（产品默认）：

- `dashboard.png` — 项目列表
- `editor.png` — **主创作面板**（三栏 + AI 面板，最能代表产品）
- `characters.png` — 角色库（画廊视图）
- `scenes.png` — 场景库
- `props.png` — 道具库
- `result.png` — 生成结果（视频台 + 历史列表）
- `account.png` — 使用记录（余额/统计/任务表）
- `login.png` — 登录页

> 库页（角色/场景/道具）截图时数据较少，主要展示页面结构与卡片样式；`/org` 与各 `/admin/*` 管理页未截，需要时可让开发补拍（`npm run dev` mock 模式逐页截）。

---

## 8. 给 Claude Design 的工作约定

1. **保持设计系统一致**：颜色走 §2 的 OKLCH 变量；新组件沿用 §3 既有 class 的视觉语言；涉及数据层归属时用 §1 三层色相。
2. **暗色优先**出方案，同时确认浅色主题成立（两套变量已给）。
3. **桌面工具气质**：信息密度高于消费级产品，克制华丽效果；动效短促（既有过渡多在 .08–.15s）。
4. **多语言友好**：文案不要写死在视觉里假设固定宽度，预留中/英/阿(RTL)伸缩；新文案以中文为准（代码里中文即翻译 key）。
5. 产出新界面时，请同时说明：用到哪些既有 token/组件、新增了什么、属于哪一层色相——方便开发按现有 `app.css` 结构落地。
