# 制影 AI · 短剧工坊 — 前后端接口契约 v0.4

> 本文档基于 Claude Design 输出的 UI 原型（`metamind_duanju-handoff.zip`）梳理而来，覆盖原型中全部交互点。
> 前端：React + TypeScript。后端：Go。AI 视频生成调用「new API（ApiGo VIP）」平台模型，由后端代理，前端只与本服务交互。
> 任何冲突以本文档为准；改动需要在评审后同步更新。

---

## 1. 通用约定

### 1.1 基本信息
- **Base URL**：`/api/v1`（生产域名待定）
- **协议**：HTTPS + JSON（`Content-Type: application/json; charset=utf-8`）
- **字符编码**：UTF-8，所有中文字段直接传中文字符（不做 ASCII 转义）
- **时间格式**：ISO 8601 UTC，例 `2026-05-17T10:23:45Z`。前端展示由前端处理时区。
- **金额单位**：人民币元，统一用 `int`（分）传输，字段名以 `_cents` 结尾。例 `99` 元 → `9900`。
- **ID 格式**：字符串，由后端生成。项目 `p_xxx`、分镜 `s_xxx`、角色 `c_xxx`、生成任务 `task_xxx`、上传 `up_xxx`。
- **分页**：`?page=1&page_size=20`，默认 `page_size=20`，最大 100。

### 1.2 鉴权
- **方案**：Bearer Token（JWT），有效期 7 天，过期返回 `401`。
- **请求头**：`Authorization: Bearer <token>`
- **刷新**：在 token 还剩 1 天内的请求，后端在响应头返回 `X-Refresh-Token: <newToken>`，前端覆盖本地缓存。

### 1.3 统一响应结构
所有响应包一层：

```json
{
  "code": 0,
  "message": "ok",
  "data": { /* 具体业务数据 */ },
  "request_id": "req_01HXYZ..."
}
```

| 字段          | 类型     | 说明                            |
| ------------- | -------- | ------------------------------- |
| `code`        | `int`    | `0` 表示成功，其他见错误码表    |
| `message`     | `string` | 给前端展示的人类可读消息（中文）|
| `data`        | `object` | 业务数据，可能为 `null`         |
| `request_id`  | `string` | 排障用，前端可在请求头透传      |

分页响应 `data` 形如：
```json
{
  "list": [/* ... */],
  "page": 1,
  "page_size": 20,
  "total": 142
}
```

### 1.4 错误码
| code   | HTTP | 含义                  | 前端处理建议              |
| ------ | ---- | --------------------- | ------------------------- |
| 0      | 200  | 成功                  | —                         |
| 40001  | 400  | 参数校验失败          | 高亮表单错误，弹 toast    |
| 40101  | 401  | 未登录 / token 失效   | 跳登录页                  |
| 40301  | 403  | 无权限                | 弹 toast                  |
| 40401  | 404  | 资源不存在            | 弹 toast，必要时回上一级  |
| 40901  | 409  | 资源冲突（如同名）    | 弹 toast，让用户改名      |
| 42201  | 422  | 业务校验失败          | 见 `data.errors[]`        |
| 42901  | 429  | 限流                  | 退避重试                  |
| 50001  | 500  | 服务内部错误          | 弹 toast，建议刷新        |
| 50301  | 503  | 上游 AI 平台不可用    | 提示稍后重试              |

422 详细错误结构：
```json
{ "code": 42201, "message": "请补全必填字段",
  "data": { "errors": [
    { "field": "global.characters", "msg": "至少选择一名角色" },
    { "field": "shots[0].action.start", "msg": "动作起点不能为空" }
  ]}
}
```

### 1.5 ID 与软删除
- 删除统一为软删除（`deleted_at` 字段在数据库层），列表接口默认过滤掉已删除。
- 已删除资源被读取返回 `40401`。

---

## 2. 数据模型

> TypeScript 用于前端直接照搬到 `types.ts`。Go struct 用于后端建模。命名差异通过 JSON tag 抹平。

### 2.1 角色 Character

```typescript
// front: types/character.ts
export interface Character {
  id: string;
  name: string;           // 必填，作为唯一索引
  role: string;           // 定位：女主 / 男主 / 配角 / 路人 ...
  desc: string;           // 描述
  tags: string[];         // 标签
  ref_image_url: string | null;     // 主参考图
  ref_images: string[];             // 多角度参考图
  voice_sample_url: string | null;  // 声线参考音频
  hue: number;            // 0-360，用于无参考图时占位的 avatar 色相
  has_ref: boolean;       // = ref_image_url != null（后端计算返回）
  created_at: string;
  updated_at: string;
}
```

```go
// back: internal/model/character.go
type Character struct {
    ID             string    `json:"id" gorm:"primaryKey"`
    UserID         string    `json:"-"`
    Name           string    `json:"name"`
    Role           string    `json:"role"`
    Desc           string    `json:"desc"`
    Tags           []string  `json:"tags" gorm:"serializer:json"`
    RefImageURL    *string   `json:"ref_image_url"`
    RefImages      []string  `json:"ref_images" gorm:"serializer:json"`
    VoiceSampleURL *string   `json:"voice_sample_url"`
    Hue            int       `json:"hue"`
    HasRef         bool      `json:"has_ref" gorm:"-"` // 计算字段
    CreatedAt      time.Time `json:"created_at"`
    UpdatedAt      time.Time `json:"updated_at"`
    DeletedAt      gorm.DeletedAt `json:"-" gorm:"index"`
}
```

### 2.2 项目 Project（含全局层 / 分镜层 / 输出层）

```typescript
export type ProjectStatus = "draft" | "gen" | "done";

export interface Project {
  id: string;
  name: string;
  cover_url: string | null;       // 封面图，缺省时前端按 hue 渲染渐变
  hue: number;                    // 0-360
  status: ProjectStatus;
  shot_count: number;             // 冗余字段，后端维护
  duration_seconds: number;       // 估算总时长（秒）
  global: GlobalLayer;
  shots: Shot[];
  output: OutputLayer;
  created_at: string;
  updated_at: string;
}

// 全局层（编辑器「全局场景层」面板，字段 01-10）
export interface GlobalLayer {
  total_duration_seconds: number | null; // 01 视频总时长（必填，秒；常用 5/10/15，也可自定义正整数）
  scene_images: string[];                // 02 场景参考图 URL（单图，数组长度 ≤ 1；多视角请拼成一张）
  scene_selected: number | null;         // 生效索引（单图时为 0 或 null）
  position_image_url: string | null;     // 03 站位图（单图）
  style: string[];                       // 04 影像风格（单选，数组长度 ≤ 1）
  characters: string[];                  // 05 角色 ID 列表（必填）
  story: string;                         // 06 故事内容（必填，建议 50-200 字）
  // 07 环境音效 / 08 字幕 / 09 背景音乐 → 见 OutputLayer
  narration_audio_url: string | null;    // 10 旁白音频：整支视频统一上传的旁白配音（可选）
}

// 分镜层（字段 11-20；另有步骤 00「本分镜出场角色」对应 cast_ids）
export interface Shot {
  id: string;
  name: string;
  order: number;                     // 排序权重，由后端维护
  cast_ids: string[];                // 步骤00 出场角色 ID（须为 global.characters 子集）
  shot_size: string | null;          // 11 景别（单选，取值见 §2.2.1；可空）
  duration_seconds: number | null;   // 12 分镜时长分配（选填，秒；留空由后端在总时长内均摊）
  action: ActionBlock;               // 13 角色动作（必填）
  action_strength: number;           // 13 动作强度 0-100（整数，默认 65，建议 60-70）
  micro: MicroBlock;                 // 14 微表情控制
  micro_strength: number;            // 14 微表情强度 0-100（默认 65）
  gesture: string;                   // 15 小动作控制
  gesture_strength: number;          // 15 小动作强度 0-100（默认 65）
  camera: CameraMove[];              // 16 摄像机运动（单选，数组长度 ≤ 1）
  lines:     SpeechBlock | null;     // 17 台词（仅文字；配音由角色参考音色合成）
  mono:      SpeechBlock | null;     // 18 内心独白（仅文字；同上）
  narration: SpeechBlock | null;     // 19 旁白（仅文字，char_id 恒 null；配音走 global.narration_audio_url）
  sfx: string;                       // 20 关键动作音效
}

export interface ActionBlock { start: string; mid: string; end: string; }
export interface MicroBlock  { eyes: string; look: string; emotion: string; }

export interface CameraMove {        // 注：Shot.camera 为单选，数组长度 ≤ 1
  id: "push_in" | "pull_out" | "pan_l" | "pan_r" | "tilt_u" | "tilt_d"
     | "boom_u" | "boom_d" | "follow" | "orbit" | "dolly_zoom" | "whip_pan"
     | "aerial" | "handheld" | "pov" | "ots";
  speed: "慢" | "中" | "快";
  magnitude: "小" | "中" | "大";
  direction: "左" | "右" | "上" | "下" | null;  // 仅部分镜头需要
}

export interface SpeechBlock {
  char_id: string | null;            // narration 时为 null
  text: string;                      // 客户端只填这个
  audio_url: string | null;          // 客户端不再上传；后端用角色参考音色合成后回填结果 URL（入参恒为 null）
}

// 输出层（随 global 一起在「全局场景层」面板展示，字段 07-09）
export interface OutputLayer {
  ambient_sfx: string;               // 07 环境音效
  subtitle: boolean;                 // 08 字幕
  music: boolean;                    // 09 背景音乐
}
```

#### 2.2.1 景别 `shot_size` 取值表（单选）

前端硬编码于 `web/src/lib/fieldDefs.ts` 的 `SHOT_SIZES`；存储 `id`，UI 显示中英文。

| id    | 中文   | English             |
| ----- | ------ | ------------------- |
| `els` | 大远景 | Extreme Long Shot   |
| `ls`  | 远景   | Long Shot           |
| `fs`  | 全景   | Full Shot           |
| `mls` | 中全景 | Medium Long Shot    |
| `ms`  | 中景   | Medium Shot         |
| `mcu` | 中近景 | Medium Close-Up     |
| `cu`  | 近景   | Close-Up            |
| `bcu` | 特写   | Big Close-Up        |
| `ecu` | 大特写 | Extreme Close-Up    |

```go
// back: internal/model/project.go
type Project struct {
    ID              string         `json:"id" gorm:"primaryKey"`
    UserID          string         `json:"-"`
    Name            string         `json:"name"`
    CoverURL        *string        `json:"cover_url"`
    Hue             int            `json:"hue"`
    Status          string         `json:"status"` // draft | gen | done
    ShotCount       int            `json:"shot_count"`
    DurationSeconds int            `json:"duration_seconds"`
    Global          GlobalLayer    `json:"global" gorm:"serializer:json"`
    Shots           []Shot         `json:"shots" gorm:"foreignKey:ProjectID;constraint:OnDelete:CASCADE"`
    Output          OutputLayer    `json:"output" gorm:"serializer:json"`
    CreatedAt       time.Time      `json:"created_at"`
    UpdatedAt       time.Time      `json:"updated_at"`
    DeletedAt       gorm.DeletedAt `json:"-" gorm:"index"`
}

type GlobalLayer struct {
    TotalDurationSeconds *int     `json:"total_duration_seconds"` // 01 必填
    SceneImages          []string `json:"scene_images"`           // 02 单图，len ≤ 1
    SceneSelected        *int     `json:"scene_selected"`
    PositionImageURL     *string  `json:"position_image_url"`     // 03 单图
    Style                []string `json:"style"`                  // 04 单选，len ≤ 1
    Characters           []string `json:"characters"`             // 05 必填
    Story                string   `json:"story"`                  // 06 必填
    NarrationAudioURL    *string  `json:"narration_audio_url"`    // 10 旁白音频，整支视频统一上传
}

type Shot struct {
    ID              string       `json:"id" gorm:"primaryKey"`
    ProjectID       string       `json:"-" gorm:"index"`
    Name            string       `json:"name"`
    Order           int          `json:"order"`
    CastIDs         []string     `json:"cast_ids" gorm:"serializer:json"` // 步骤00
    ShotSize        *string      `json:"shot_size"`              // 11 景别单选 id
    DurationSeconds *int         `json:"duration_seconds"`       // 12 选填
    Action          ActionBlock  `json:"action" gorm:"serializer:json"`
    ActionStrength  int          `json:"action_strength"`        // 0-100，默认 65
    Micro           MicroBlock   `json:"micro" gorm:"serializer:json"`
    MicroStrength   int          `json:"micro_strength"`         // 0-100，默认 65
    Gesture         string       `json:"gesture"`
    GestureStrength int          `json:"gesture_strength"`       // 0-100，默认 65
    Camera          []CameraMove `json:"camera" gorm:"serializer:json"` // 单选，len ≤ 1
    Lines           *SpeechBlock `json:"lines" gorm:"serializer:json"`
    Mono            *SpeechBlock `json:"mono" gorm:"serializer:json"`
    Narration       *SpeechBlock `json:"narration" gorm:"serializer:json"`
    SFX             string       `json:"sfx"`
}
// ActionBlock / MicroBlock / CameraMove / SpeechBlock / OutputLayer 略
```

### 2.3 生成任务 Generation / Task

```typescript
export type TaskStatus = "queued" | "running" | "success" | "failed";
export type TaskType   = "i2v" | "t2v" | "v2v" | "char";

// 任务类型的展示信息，由后端组装返回（label 中文名 + hue 用于头像着色）
export interface TaskTypeInfo {
  id: TaskType;
  label: string;               // "图生视频" / "文生视频" / "视频续写" / "角色生成"
  hue: number;                 // 0-360
}

export interface GenerationTask {
  id: string;                  // task_xxx
  project_id: string | null;   // char 类型为 null
  user_id: string;
  user: string;                // 用户名显示串（如 "metamind"），用于任务列表行
  type: TaskTypeInfo;          // ⚠️ 是对象不是字符串；前端要读 type.label / type.hue
  platform: string;            // 豆包视频 / 可灵 1.6 / Sora · Turbo / Vidu · pro / 墨韵
  upstream_model: string;      // new API 平台上的模型名，例 "kling-v1.6-pro"
  channel_id: number;          // new API 渠道 ID
  status: TaskStatus;
  progress: number;            // 0-100
  submit_time: string;
  end_time: string | null;
  duration_seconds: number;    // 实际处理耗时
  video_len_seconds: number;   // 输出视频时长（8/16/24/32）
  resolution: "720p" | "1080p";
  cost_cents: number;          // 已扣费金额（分）
  fail_reason: string | null;
  // 成功时填充
  output_video_url: string | null;
  output_master_url: string | null;  // ProRes 母版
  thumbnail_urls: string[];          // 分镜缩略图
  prompt: PromptSnapshot | null;     // 锁定的提示词
}

export interface PromptSnapshot {
  version: string;                 // v07
  structured_json: object;         // 结构化 JSON（来自 editor 的 serialize 函数）
  natural_text: string;            // 自然语言版本
  locked: boolean;
}
```

### 2.4 账户 / 充值

```typescript
export interface Account {
  user_id: string;
  balance_cents: number;          // 总余额
  gift_balance_cents: number;     // 赠送余额
  this_month: {
    spent_cents: number;
    generated_count: number;
    duration_seconds: number;
  };
  last_recharge: {
    amount_cents: number;
    time: string;
    bonus_cents: number;
  } | null;
  lifetime: {
    spent_cents: number;
    recharged_cents: number;
  };
}

export interface RechargePackage {
  id: string;
  label: string;
  price_cents: number;
  credits_cents: number;          // 充值得到的余额
  bonus_cents: number;            // 赠送
  badge: string | null;           // "热门" / "推荐" / "省 23%"
  per_unit_cents: number;         // 每元单价（用于对比）
}

// 创建充值订单的返回结构（POST /account/recharges）
export interface RechargeOrder {
  id: string;                     // ord_xxx
  user_id: string;
  amount_cents: number;
  method: "wechat" | "alipay" | "bank";
  status: "pending" | "success" | "failed" | "expired";
  // 支付凭证（按 method 不同字段不同）
  qr_code_url: string | null;     // 微信扫码
  pay_url: string | null;         // 支付宝跳转
  bank_info: { account: string; name: string; memo: string } | null;
  invoice_url: string | null;     // 发票 PDF
  created_at: string;
  paid_at: string | null;
}

// 充值记录列表行（GET /account/recharges 的列表项）— 是 RechargeOrder 的精简显示版
export type RechargeRecordStatus = "pending" | "success" | "failed" | "expired";
export interface RechargeRecord {
  id: string;
  time: string;                   // ISO 8601，等同于订单 paid_at
  method: string;                 // 中文显示串："微信支付" / "支付宝" / "对公转账"（非 wechat|alipay|bank 枚举）
  amount_cents: number;           // 用户实付金额
  credits_cents: number;          // 充值得到的余额
  bonus_cents: number;            // 赠送
  status: RechargeRecordStatus;
}
```

---

## 3. 接口清单

> 列已实现的状态：⬜ 待实现 / 🟦 mock / ✅ 已上线

### 3.0 v0.1 前端实际接入清单(P0 优先做这些)

下面这些是 **当前前端真的会调用** 的接口。其余 §3.1–§3.8 列的端点(SSE 进度、上传、PATCH 项目、prompt 润色、tasks 详情/导出、meta/options 等)在 v0.1 前端中暂未接入,可以放到后期。

| 优先级 | 接口 | 前端调用位置 |
| ---- | ---- | ---- |
| **P0** | `POST /auth/sms/send` / `POST /auth/login` / `POST /auth/register` | `src/api/auth.ts` |
| **P0** | `GET /projects` | 工作台 `src/pages/dashboard/` |
| **P0** | `GET /projects/:id` | 编辑器 / 结果页 |
| **P0** | `GET /characters`(扁平数组) / `POST` / `PATCH /:id` / `DELETE /:id` | 角色库 `src/pages/characters/` |
| **P0** | `GET /account` / `GET /account/packages` / `GET /account/recharges` | 使用记录页 |
| **P0** | `GET /tasks?status=&resolution=&task_id=&page=&page_size=` | 使用记录页任务表 |
| P1 | 编辑器的所有写入(`PATCH /projects/:id`、`PUT /global`、`PUT /output`、`POST/PATCH/DELETE /shots`、`POST /save`) | 当前编辑器只在前端内存改,**"保存"按钮是占位** |
| P1 | `POST /uploads/image` / `POST /uploads/audio` | 字段里的上传组件还没接 |
| P2 | `POST /projects/:id/generations` + SSE 进度流 | 结果页用写死样例视频 |
| P2 | `/prompt/preview` / `/prompt/polish` | 右侧预览面板暂未实现 |
| P2 | `GET /meta/options` | 前端目前硬编码在 `src/lib/fieldDefs.ts`,等后端就绪再切 |
| P2 | `GET /auth/me` / `POST /auth/logout` / `POST /auth/wechat` | 前端未调,登录后只信 localStorage token |

P0 全做完就能联调跑起来 6 个页面。

### 3.1 鉴权与账户身份

| Method | Path                       | 说明                          | 鉴权 |
| ------ | -------------------------- | ----------------------------- | ---- |
| POST   | `/auth/sms/send`           | 发送手机验证码                | 否   |
| POST   | `/auth/login`              | 登录（手机验证码 / 账号密码） | 否   |
| POST   | `/auth/register`           | 注册（手机验证码）            | 否   |
| POST   | `/auth/wechat`             | 微信登录（回调用 code 换 token） | 否 |
| POST   | `/auth/logout`             | 退出登录                      | 是   |
| GET    | `/auth/me`                 | 当前用户信息                  | 是   |

#### POST `/auth/sms/send`
请求：
```json
{ "phone": "13800138000", "scene": "login" }   // scene: login | signup
```
响应：
```json
{ "code": 0, "data": { "expires_in": 60, "next_send_in": 60 } }
```
错误：`40001` 手机号格式错误；`42901` 一分钟内重发；`50301` 短信服务异常。

#### POST `/auth/login`
请求（手机验证码）：
```json
{ "method": "phone", "phone": "13800138000", "code": "123456", "remember": true }
```
请求（账号密码）：
```json
{ "method": "password", "account": "metamind", "password": "xxx", "remember": true }
```
响应：
```json
{ "code": 0, "data": {
  "token": "eyJ...",
  "expires_at": "2026-05-24T...",
  "user": { "id": "u_1", "name": "你", "phone": "138****8000", "avatar_url": null }
}}
```

#### POST `/auth/register`
```json
{ "phone": "138...", "code": "123456", "agree_terms": true }
```
响应同登录。`agree_terms=false` 返回 `40001`。

#### GET `/auth/me`
返回当前 `user` 对象，用于刷新页面时校验登录态。

---

### 3.2 文件上传

| Method | Path               | 说明                              |
| ------ | ------------------ | --------------------------------- |
| POST   | `/uploads/image`   | 上传图像（场景 / 站位 / 角色参考）|
| POST   | `/uploads/audio`   | 上传音频（全局旁白配音 / 角色声线）|

约定使用 **`multipart/form-data`**。

#### POST `/uploads/image`
表单字段：
- `file` (binary) — jpg/png/webp，≤ 8 MB
- `purpose` (string) — `scene` | `position` | `character_ref` | `cover`

响应：
```json
{ "code": 0, "data": {
  "id": "up_xxx", "url": "https://cdn.../xxx.png",
  "width": 1024, "height": 1024, "size_bytes": 384012,
  "purpose": "scene"
}}
```

#### POST `/uploads/audio`
表单字段：
- `file` (binary) — mp3/wav/m4a，≤ 20 MB
- `purpose` (string) — `narration`（全局旁白音频，上传后写入 `global.narration_audio_url`）| `voice_sample`（角色声线参考，写入 `character.voice_sample_url`）

> 台词 / 内心独白不再单独上传音频：客户端只提交文字，后端用对应角色在角色库里的 `voice_sample_url` 参考音色合成配音，结果回填到 `SpeechBlock.audio_url`。

响应包含 `duration_seconds`。

> 实现建议：直接上传到对象存储（OSS/MinIO），返回带签名 URL 或永久公共 URL；后端只记录元数据。

---

### 3.3 角色库 Characters

| Method | Path                | 说明           |
| ------ | ------------------- | -------------- |
| GET    | `/characters`       | 列表（带筛选）|
| POST   | `/characters`       | 新建           |
| GET    | `/characters/:id`   | 详情           |
| PATCH  | `/characters/:id`   | 更新           |
| DELETE | `/characters/:id`   | 删除           |

#### GET `/characters`
**v0.1 实现:前端不传任何 query,期望返回全量扁平数组**(用户量小,角色库整体加载一次缓存)。

Query(预留,前端目前不传):
- `q` — 关键字（匹配 name / role / desc）
- `has_ref` — `true` | `false` | 省略
- `tags` — 逗号分隔，例 `都市,女主`
- `page`、`page_size`

**响应**:`data` = `Character[]`(扁平数组,**非**分页结构)。等用户量上来后再切分页。

#### POST `/characters`
请求体见 `Character`（去掉 `id`、`has_ref`、`hue`、时间戳）：
```json
{ "name": "林夏", "role": "女主", "desc": "...", "tags": ["女主", "都市"],
  "ref_image_url": "https://...", "ref_images": [], "voice_sample_url": null }
```
后端按 `name` hash 生成 `hue`。`name` 唯一冲突返回 `40901`。

---

### 3.4 项目与分镜

| Method | Path                                          | 说明               |
| ------ | --------------------------------------------- | ------------------ |
| GET    | `/projects`                                   | 列表（带筛选）     |
| POST   | `/projects`                                   | 新建空项目         |
| GET    | `/projects/:id`                               | 详情（含 shots）   |
| PATCH  | `/projects/:id`                               | 更新项目顶层字段   |
| DELETE | `/projects/:id`                               | 删除项目           |
| PUT    | `/projects/:id/global`                        | 整体替换 global    |
| PUT    | `/projects/:id/output`                        | 整体替换 output    |
| POST   | `/projects/:id/shots`                         | 添加分镜           |
| PATCH  | `/projects/:id/shots/:shot_id`                | 更新分镜           |
| DELETE | `/projects/:id/shots/:shot_id`                | 删除分镜           |
| POST   | `/projects/:id/shots/:shot_id/duplicate`      | 复制分镜           |
| POST   | `/projects/:id/shots/reorder`                 | 拖拽排序           |
| POST   | `/projects/:id/save`                          | 全量保存（顶部"保存"按钮）|

#### GET `/projects`
Query：
- `status` — `draft` | `gen` | `done` | 省略=全部
- `q` — 名称模糊匹配
- `page`、`page_size`

#### POST `/projects`
```json
{ "name": "未命名项目", "template_id": null }
```
返回 `Project`，含一个默认空分镜。

#### POST `/projects/:id/shots`
```json
{ "name": "新分镜", "insert_after_shot_id": "s_xxx" }   // 不传则追加到末尾
```
返回完整新 `Shot` 对象。

#### POST `/projects/:id/shots/reorder`
```json
{ "order": ["s_3", "s_1", "s_2"] }  // 按目标顺序传 shot_id 列表
```

#### POST `/projects/:id/save`
全量保存，请求体为完整 `Project`（不含只读字段）。用于编辑器顶部「保存」按钮。**前端在字段失焦时也可调 PATCH 做增量保存。**

校验规则（后端必须实现，前端也同步实现一份做即时提示）：
- `global.total_duration_seconds != null && > 0`（视频总时长必填）
- `global.characters.length >= 1`
- `global.story.length >= 1`
- 每个 `shot.action.start || mid || end` 至少一项非空
- `shot.cast_ids` ⊆ `global.characters`
- `shot.lines.char_id`、`shot.mono.char_id` ∈ `shot.cast_ids`
- 单选字段数组长度 ≤ 1：`global.style`、`shot.camera`
- 强度字段 `shot.action_strength / micro_strength / gesture_strength` ∈ [0,100]，缺省 65
- `shot.shot_size` 为 §2.2.1 表中的 id 或 null

校验失败返回 `42201` + `errors[]`。

---

### 3.5 视频生成与任务

| Method | Path                                              | 说明                     |
| ------ | ------------------------------------------------- | ------------------------ |
| POST   | `/projects/:id/generations`                       | 提交整片生成             |
| POST   | `/projects/:id/shots/:shot_id/regenerate`         | 单分镜重生               |
| GET    | `/projects/:id/generations`                       | 项目的生成历史           |
| GET    | `/generations/:id`                                | 任务详情（轮询用）       |
| GET    | `/generations/:id/stream`                         | SSE 进度流               |
| POST   | `/generations/:id/cancel`                         | 取消任务（仅 queued/running）|
| POST   | `/generations/:id/rollback`                       | 回滚到此版本（恢复 project）|
| POST   | `/prompt/preview`                                 | 实时生成提示词预览       |
| POST   | `/prompt/polish`                                  | AI 润色自然语言提示词    |

#### POST `/projects/:id/generations`
请求：
```json
{
  "platform": "可灵 1.6",         // 用户选择的平台
  "resolution": "1080p",
  "video_len_seconds": 8,
  "regenerate_shots": null         // null=整片；或 ["s_1", "s_3"] 仅重生指定分镜
}
```
后端流程：
1. 校验 `project` 完整性（同 3.4 保存校验）。
2. 估算成本，校验账户余额，不足返回 `42201`。
3. 序列化 `project` 为 `PromptSnapshot`（参考 [editor.jsx#serialize](metamind-duanju/project/editor.jsx)）。
4. 落库 task，状态 `queued`。
5. 调用 new API 平台对应模型（异步），写入 `channel_id` 和 `upstream_model`。
6. 返回 task。

响应：`GenerationTask`，初始 `status=queued`，`progress=0`。

#### GET `/generations/:id/stream`（SSE）
前端用 `EventSource` 订阅。事件流：
```
event: progress
data: {"progress": 35, "status": "running", "stage": "shot_3/12"}

event: progress
data: {"progress": 100, "status": "success", "output_video_url": "https://..."}

event: error
data: {"message": "上游平台超时"}
```
连接断开时前端降级到 `GET /generations/:id` 轮询（建议 3s 间隔）。

#### POST `/prompt/preview`
请求体：`Project`（不需要落库）。
响应：
```json
{ "code": 0, "data": {
  "structured_json": { /* 同 editor.jsx#serialize 输出 */ },
  "natural_text": "全局场景：……"
}}
```
用途：编辑器右侧的「结构化 / 自然语言」实时预览。

#### POST `/prompt/polish`
```json
{ "text": "原始自然语言提示词" }
```
响应包含润色后的 `text`。后端调 new API 的 chat 模型。

---

### 3.6 任务记录（账户页表格）

| Method | Path                  | 说明                  |
| ------ | --------------------- | --------------------- |
| GET    | `/tasks`              | 任务列表（强筛选）    |
| GET    | `/tasks/:id`          | 任务详情（弹窗用）    |
| GET    | `/tasks/:id/download` | 拉取下载签名 URL      |
| GET    | `/tasks/export.csv`   | 导出 CSV              |

#### GET `/tasks`
Query：
- `date_from`、`date_to` — ISO 8601
- `task_id` — 模糊匹配
- `status` — `all` | `success` | `running` | `queued` | `failed`
- `resolution` — `all` | `720p` | `1080p`
- `type` — `all` | `i2v` | `t2v` | `v2v` | `char`
- `page`、`page_size`

响应：分页结构，`list` 为 `GenerationTask[]`（精简版，可不含 `prompt`、`thumbnail_urls`，详情接口才返回）。

#### GET `/tasks/:id/download`
```json
{ "code": 0, "data": {
  "video_url": "https://cdn.../signed?...",
  "master_url": "https://cdn.../signed?...",
  "expires_at": "2026-05-17T11:00:00Z"
}}
```

---

### 3.7 账户与充值

| Method | Path                          | 说明                       |
| ------ | ----------------------------- | -------------------------- |
| GET    | `/account`                    | 余额 + 本月统计 + 历史汇总 |
| GET    | `/account/packages`           | 充值套餐列表               |
| GET    | `/account/recharges`          | 充值记录（响应 `RechargeRecord[]`，**不是** `RechargeOrder[]`，非分页） |
| POST   | `/account/recharges`          | 创建充值订单（响应 `RechargeOrder`） |
| GET    | `/account/recharges/:id`      | 查询订单状态（轮询用）     |
| GET    | `/account/invoices/:order_id` | 下载发票                   |

#### POST `/account/recharges`
```json
{ "amount_cents": 99900, "method": "wechat" }
```
响应：`RechargeOrder`。
- `method=wechat` → 返回 `qr_code_url`，前端展示二维码，并轮询 `/account/recharges/:id` 直到 `status=success`。
- `method=alipay` → 返回 `pay_url`，前端 `window.open` 跳转。
- `method=bank` → 返回 `bank_info`，前端展示转账信息。

校验：`50 ≤ amount_cents/100 ≤ 50000`；`bank` 方式要求 `≥ 5000`。

---

### 3.8 元数据（前端启动时拉取一次，缓存到 store）

| Method | Path                  | 说明                  |
| ------ | --------------------- | --------------------- |
| GET    | `/meta/options`       | 所有枚举选项          |

响应：
```json
{ "code": 0, "data": {
  "styles": ["2D 动画","3D 动画","真人实拍","黑白","线条风格"],
  "shot_sizes": [ /* 参考 §2.2.1：{id,cn,en} 列表 */ ],
  "tags": ["女主","男主","配角","路人","都市","校园","成熟","少年","古风"],
  "camera_moves": [ /* 参考 fieldDefs.ts#CAMERA_MOVES 的完整结构 */ ],
  "speed_options": ["慢","中","快"],
  "magnitude_options": ["小","中","大"],
  "direction_options": ["左","右","上","下"],
  "platforms": [
    { "id": "doubao", "name": "豆包视频", "upstream_model": "doubao-vid-v1" },
    { "id": "kling16", "name": "可灵 1.6", "upstream_model": "kling-v1.6-pro" },
    { "id": "sora_turbo", "name": "Sora · Turbo", "upstream_model": "sora-turbo" },
    { "id": "vidu_pro", "name": "Vidu · pro", "upstream_model": "vidu-pro" },
    { "id": "moyun", "name": "墨韵", "upstream_model": "moyun-v1" }
  ],
  "resolutions": ["720p","1080p"],
  "video_lengths": [8, 16, 24, 32]
}}
```

---

## 4. 页面 ⇄ 接口映射

> 用于前后端联调时一行一行对照检查。

| 页面 / 操作                       | 调用接口                                                                 |
| --------------------------------- | ------------------------------------------------------------------------ |
| **登录页** 输入手机号点"获取验证码"   | `POST /auth/sms/send`                                                    |
| **登录页** 点"登录"/"注册并登录"      | `POST /auth/login` / `POST /auth/register`                               |
| **登录页** "微信登录"                 | 跳转微信 OAuth → 回调 `POST /auth/wechat`                                |
| **顶栏** 每次刷新页面                 | `GET /auth/me` + `GET /meta/options`                                     |
| **工作台** 进入页面                   | `GET /projects?status=...&q=...`                                         |
| **工作台** "新建项目"                 | `POST /projects` → 跳转编辑器                                            |
| **工作台** 点击项目卡片               | `GET /projects/:id` → 跳转编辑器                                         |
| **编辑器** 加载                       | `GET /projects/:id`（如未在 store） + `GET /characters`                 |
| **编辑器** 字段失焦                   | `PATCH /projects/:id` 增量字段                                           |
| **编辑器** 添加 / 复制 / 删除分镜     | `POST /shots` / `POST /shots/:id/duplicate` / `DELETE /shots/:id`        |
| **编辑器** 拖拽分镜排序               | `POST /shots/reorder`                                                    |
| **编辑器** 上传场景图 / 站位图        | `POST /uploads/image`，拿到 url 后 PATCH 进 `global.scene_images`        |
| **编辑器** 全局层"旁白音频"上传       | `POST /uploads/audio`（`purpose=narration`）→ url 写入 `global.narration_audio_url` |
| **编辑器** "保存"按钮                 | `POST /projects/:id/save`                                                |
| **编辑器** 右侧"结构化 / 自然语言"预览 | `POST /prompt/preview`（每次 project 变更后 debounce 500ms 调一次）       |
| **编辑器** 右侧"AI 润色"              | `POST /prompt/polish`                                                    |
| **编辑器** "生成视频"按钮             | `POST /projects/:id/generations` → 跳转结果页 + SSE 订阅                 |
| **结果页** 加载                       | `GET /generations/:id` + `GET /generations/:id/stream`（SSE）            |
| **结果页** "单镜重生"                 | `POST /shots/:id/regenerate`                                             |
| **结果页** "整片重生"                 | `POST /projects/:id/generations`（`regenerate_shots: null`）             |
| **结果页** 历史 vN 列表               | `GET /projects/:id/generations`                                          |
| **结果页** "回滚"                     | `POST /generations/:id/rollback`                                         |
| **结果页** "下载"                     | `GET /tasks/:id/download`                                                |
| **角色库** 加载                       | `GET /characters`                                                        |
| **角色库** 抽屉"创建 / 保存"          | `POST /characters` / `PATCH /characters/:id`                             |
| **角色库** 上传参考图 / 声线          | `POST /uploads/image` / `POST /uploads/audio`                            |
| **账户页** 加载                       | `GET /account` + `GET /tasks?...`                                        |
| **账户页** 任务表格查询               | `GET /tasks?date_from=...&status=...&page=...`                           |
| **账户页** 行内"预览视频"             | `GET /tasks/:id`（带 prompt + thumbs）                                   |
| **账户页** 切到"充值记录"             | `GET /account/recharges`                                                 |
| **账户页** "导出 .csv"                | `GET /tasks/export.csv?...`（直接走浏览器下载）                          |
| **充值弹窗** 加载                     | `GET /account/packages`                                                  |
| **充值弹窗** "确认支付"               | `POST /account/recharges` → 展示 QR / 跳转，期间轮询 `GET .../:id`       |

---

## 5. 待对齐 / 待决定项

> 这部分需要前后端 + 产品一起确认。建议下次评审会议 close。

1. **生成进度推送方式**：SSE vs WebSocket vs 轮询。本文档默认 SSE + 降级轮询，可改。
2. **任务并发限制**：每用户同时进行中的任务上限？超过返回 `42901`？
3. **成本预估**：是否需要 `POST /projects/:id/estimate-cost` 在用户点"生成视频"前展示"本次将消耗 ¥XX"？强烈建议加。
4. **台词/独白配音合成时机**：客户端只提交文字，后端用角色 `voice_sample_url` 合成。需确认合成是在"生成视频"时一起做，还是字段保存后异步预合成并回填 `SpeechBlock.audio_url`。
11. **时长分配策略**：部分分镜填了 `duration_seconds`、部分留空时，剩余时长如何在留空分镜间均摊？是否允许已填总和 > `global.total_duration_seconds`（前端已做软提示，后端是否硬校验拒绝）。
12. **强度字段语义**：`action/micro/gesture_strength`（0-100）后端如何映射到模型参数？是否需要 min/max 边界以外的离散档位。
13. **景别 `shot_size`**：枚举是否进 `/meta/options` 由后端下发，还是前后端各维护一份常量（当前前端硬编码 §2.2.1）。
5. **角色删除**：若角色已被某项目 `global.characters` 引用，是阻止删除（返回冲突）还是级联清理？建议阻止 + 返回引用列表。
6. **项目封面**：自动从首个分镜生成快照？还是用户手动上传？原型里 `cover_url` 留空时用 `hue` 渲染色块占位。
7. **微信 / 支付宝回调地址**：后端需注册支付平台的 webhook，订单状态以 webhook 为准，前端轮询只是 UX。
8. **多端 token 互踢**：登录时 `remember=false` 是否要踢掉其他端？
9. **数据导出合规**：CSV 导出是否要脱敏（手机号、user 字段）？
10. **AI 润色** 调用 new API 哪个模型？建议默认 `claude-opus-4-7`，可配置。

---

## 6. 版本历史

| 版本   | 日期         | 变更                          |
| ------ | ------------ | ----------------------------- |
| v0.1   | 2026-05-17   | 初版，覆盖原型全部交互        |
| v0.2   | 2026-05-18   | 按 v0.1 前端实际代码对齐:`GenerationTask.type` 改为对象 `TaskTypeInfo`、补 `user` 字段;`/account/recharges` 列表响应明确为 `RechargeRecord[]`(新增类型);`/characters` 当前返回扁平数组而非分页;新增 §3.0 P0 接入清单 |
| v0.3   | 2026-05-18   | 旁白音频改为全局统一上传:`GlobalLayer` 新增 `narration_audio_url`;分镜的台词/内心独白/旁白改为**仅文字**,台词/独白配音由角色 `voice_sample_url` 后端合成回填 `SpeechBlock.audio_url`;`/uploads/audio` 的 `purpose` 收敛为 `narration`(全局旁白)\| `voice_sample`(角色声线) |
| v0.4   | 2026-05-18   | 按编辑器最新改动整体对齐:① 移除时间模块(`GlobalLayer.season/time_of_day` 删除,`/meta/options` 去掉 `seasons/time_of_day`);② `GlobalLayer` 新增 `total_duration_seconds`(视频总时长,必填);③ `Shot` 新增 `shot_size`(景别,单选,见 §2.2.1)、`duration_seconds`(分镜时长,选填)、`action_strength/micro_strength/gesture_strength`(强度 0-100,默认 65);④ `global.style`、`shot.camera` 改为**单选**(数组长度 ≤ 1);⑤ 场景/站位图均为**单图**;⑥ 字段编号整体重排:全局 01-10、分镜 11-20(另有分镜步骤 00 出场角色);⑦ `/meta/options.styles` 更新为实际 5 项并新增 `shot_sizes`;§3.4 校验规则补充 |
