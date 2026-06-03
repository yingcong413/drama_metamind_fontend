// Seedance 视频生成 API（通过 new-api 中转）
// 真实接口契约由 docs/test_seedance2_e/seedance2_final.py 验证（new-api → 101.37.232.133）

import {
  buildAssetIndex,
  buildPromptText,
  resolveCharacterImageRef,
} from "@/lib/naturalLanguage";
import type { Character, Project } from "@/types";

// 开发态默认走 vite 反向代理(/seedance-proxy → http://101.37.232.133)，
// 生产态从 .env 注入真实 BASE。
const BASE_URL =
  (import.meta.env.VITE_SEEDANCE_BASE_URL as string | undefined) ||
  "/seedance-proxy/v1";

// API Key:**生产环境不在前端注入**。
//   - 浏览器 → /seedance-proxy/* → nginx,nginx 通过 proxy_set_header Authorization 注入
//   - 仅在本地开发(vite dev)时,允许通过 VITE_SEEDANCE_API_KEY 注入,方便直接命中接口
//   - 默认空字符串,authHeaders() 检测到空就不发 Authorization 头,让 nginx 接管
const API_KEY =
  (import.meta.env.VITE_SEEDANCE_API_KEY as string | undefined) || "";

// 模型:doubao-seedance-2-0-260128(seedance2_final.py)
const MODEL =
  (import.meta.env.VITE_SEEDANCE_MODEL as string | undefined) ||
  "doubao-seedance-2-0-260128";

// ───────── 请求体 ─────────
// 完全对齐真实接口(seedance2_final.py):顶层平铺 generate_audio/ratio/duration/watermark,
// 参考素材统一塞进 content 数组,每项形如 {type, image_url|video_url|audio_url, role}。

export type SeedanceRatio = "16:9" | "9:16" | "1:1" | "adaptive";
// 视频分辨率,对应接口 resolution 字段(文档枚举 480p/720p,默认 720p;1080p 视上游模型而定)
export type SeedanceResolution = "480p" | "720p" | "1080p" | "4k";
// v0.9.5: 不再固定到 5/8/11 三档,用户拖的值直接透传给 new-api。
// 若上游模型版本仍要求 5/8/11,会在 submit 阶段以 4xx 报错由前端 toast 展示。
export type SeedanceDuration = number;

export type SeedanceContentItem =
  | { type: "text"; text: string }
  | {
      type: "image_url";
      image_url: { url: string };
      role: "reference_image";
    }
  | {
      type: "video_url";
      video_url: { url: string };
      role: "reference_video";
    }
  | {
      type: "audio_url";
      audio_url: { url: string };
      role: "reference_audio";
    };

export interface SeedanceRequest {
  model: string;
  prompt: string;
  generate_audio: boolean;
  ratio: SeedanceRatio;
  resolution: SeedanceResolution;
  duration: SeedanceDuration;
  watermark: boolean;
  content: SeedanceContentItem[];
}

export interface SeedanceSubmitResponse {
  id?: string;
  task_id?: string;
  taskId?: string;
  object?: string;
  model?: string;
  status?: string;
  progress?: number;
  created_at?: number;
  // new-api 有时会包一层 { code, data: { task_id, ... } }
  code?: string;
  message?: string;
  data?: SeedanceSubmitResponse;
}

/** PRD v0.9.1 §10.8.2:new-api 返回的 token 用量(供后端按 ¥2/M input + ¥28/M output 计费) */
export interface SeedanceUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface SeedanceTaskInfo {
  task_id?: string;
  status?: string;       // PENDING | QUEUED | IN_PROGRESS | RUNNING | SUCCESS | FAILED | FAILURE
  progress?: string | number;
  fail_reason?: string;
  result_url?: string;
  /** 上游(Volcano)原始错误,通常在 data.error 里;失败时我们把 message 也抬到 fail_reason 方便统一展示 */
  error?: {
    code?: string;
    message?: string;
  };
  properties?: Record<string, unknown>;
  /** v0.9.1:任务成功时 new-api 在多个嵌套层级都可能放 usage,顶层兜底 */
  usage?: SeedanceUsage;
  data?: {
    error?: { code?: string; message?: string };
    usage?: SeedanceUsage;
    data?: {
      result_url?: string;
      content?: { video_url?: string };
      usage?: SeedanceUsage;
    };
  };
}

/**
 * 任务状态查询返回。new-api 实际返回是任务对象本身(平铺) + 内嵌 data 字段(Volcano 原响应)
 * 同时兼容 { code, data: <task> } 的纯包装格式。
 */
export interface SeedanceTaskResponse extends SeedanceTaskInfo {
  code?: string;
  message?: string;
  // data 字段在 SeedanceTaskInfo 已声明
}

/** 把 Project + Characters 转成 Seedance 请求体（new-api 真实接口格式） */
export function buildSeedancePayload(
  project: Project,
  characters: Character[],
): SeedanceRequest {
  // 与「保存」弹窗共用同一个拼接函数,确保两边永远一致。
  const prompt = buildPromptText(project, characters);

  const g = project.global;

  // 素材顺序遵循 Seedance 2.0「重要素材前置」原则:角色 → 场景 → 站位 → 道具 → 旁白音频
  // buildAssetIndex 与 buildPromptText 共享同一份下标映射,保证 @图片N 与 content 数组里 image_url 顺序对齐
  const idx = buildAssetIndex(project, characters);

  // content[0] 永远是 text(与顶层 prompt 同字符串)
  const content: SeedanceContentItem[] = [{ type: "text", text: prompt }];

  // 1. 角色参考图(按 g.characters 顺序)
  for (const cid of g.characters ?? []) {
    if (idx.characterImage[cid] === undefined) continue;
    const c = characters.find((x) => x.id === cid);
    const ref = resolveCharacterImageRef(c);
    if (ref) {
      content.push({
        type: "image_url",
        image_url: { url: ref },
        role: "reference_image",
      });
    }
  }
  // 2. 场景图
  if (idx.scene >= 0 && g.scene_image && g.scene_image.trim()) {
    content.push({
      type: "image_url",
      image_url: { url: g.scene_image },
      role: "reference_image",
    });
  }
  // 3. 站位草图
  if (idx.position >= 0 && g.position_image_url && g.position_image_url.trim()) {
    content.push({
      type: "image_url",
      image_url: { url: g.position_image_url },
      role: "reference_image",
    });
  }
  // 4. 道具参考图
  if (idx.prop >= 0 && g.prop_image_url && g.prop_image_url.trim()) {
    content.push({
      type: "image_url",
      image_url: { url: g.prop_image_url },
      role: "reference_image",
    });
  }
  // 5. 旁白音频
  if (idx.narration >= 0 && g.narration_audio_url && g.narration_audio_url.trim()) {
    content.push({
      type: "audio_url",
      audio_url: { url: g.narration_audio_url },
      role: "reference_audio",
    });
  }

  // v0.9.5: 时长按用户选择透传,不再 clamp 到 5/8/11。
  // 兜底:全局没填且 project.duration_seconds 也没值时,用 5 秒(原 default)。
  const duration: SeedanceDuration =
    (g.total_duration_seconds ?? 0) || project.duration_seconds || 5;

  // generate_audio:用户在 UI 显式控制(默认 true),不再绑死背景音乐开关
  // ratio:用户选,默认 16:9
  const generateAudio = project.output?.generate_audio ?? true;
  const ratio = (g.ratio ?? "16:9") as SeedanceRatio;
  // resolution:用户选,默认 720p(接口文档默认值)
  const resolution = (g.resolution ?? "720p") as SeedanceResolution;

  return {
    model: MODEL,
    prompt,
    generate_audio: generateAudio,
    ratio,
    resolution,
    duration,
    watermark: false,
    content,
  };
}

function authHeaders(): HeadersInit {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
  };
  // 仅在显式注入了 key 时才发 Authorization;生产部署里 key 在 nginx 注入
  if (API_KEY) {
    h.Authorization = `Bearer ${API_KEY}`;
  }
  return h;
}

/** 提交一次视频生成任务，返回 task_id。带 60s 超时,过期 abort 并抛友好错误。 */
export async function submitSeedance(payload: SeedanceRequest): Promise<{
  task_id: string;
  raw: SeedanceSubmitResponse;
}> {
  const ctrl = new AbortController();
  const TIMEOUT_MS = 60_000;
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  let resp: Response;
  try {
    resp = await fetch(`${BASE_URL}/video/generations`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") {
      throw new Error(
        `提交超时 (>${TIMEOUT_MS / 1000}s)。可能服务器繁忙或多人同时使用,请稍后重试。`,
      );
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
  let body: SeedanceSubmitResponse;
  try {
    body = (await resp.json()) as SeedanceSubmitResponse;
  } catch {
    throw new Error(`Seedance HTTP ${resp.status} 且响应不是 JSON`);
  }
  if (!resp.ok) {
    throw new Error(formatHttpError(resp.status, body));
  }
  // new-api 有两种格式: 直接 { id/task_id } 或者 { code, data: { id/task_id } }
  const inner = body?.data ?? body;
  const taskId =
    inner?.id ?? inner?.task_id ?? inner?.taskId ?? body?.id ?? body?.task_id;
  if (!taskId) {
    throw new Error(`提交成功但找不到 task_id: ${JSON.stringify(body)}`);
  }
  return { task_id: taskId, raw: body };
}

/**
 * 把 fetch 的非 2xx 转成对测试者友好的中文 message。
 * 401/403 强烈提示鉴权问题(主要是 nginx 没注入 Authorization);
 * 429 提示限流;5xx 提示上游故障;其它原样附原始 message。
 */
function formatHttpError(status: number, body: unknown): string {
  const upstream =
    (body as { message?: string; error?: { message?: string } } | null)?.message
    || (body as { error?: { message?: string } } | null)?.error?.message
    || (typeof body === "string" ? body : "");
  if (status === 401 || status === 403) {
    return (
      `鉴权失败 (HTTP ${status})。生产部署里 Seedance Key 由 nginx 注入,` +
      `常见原因:服务器 nginx 配置里 /seedance-proxy/ location 缺 proxy_set_header Authorization,` +
      `请联系管理员核对 conf.d/metamind.conf。` +
      (upstream ? `\n上游返回:${upstream}` : "")
    );
  }
  if (status === 429) {
    return `请求过于频繁,被限流 (HTTP 429)。稍等几分钟再试,或检查是否多人同时跑生成。${upstream ? "\n" + upstream : ""}`;
  }
  if (status >= 500) {
    return `上游服务 ${status} 异常,请稍后重试。${upstream ? "\n" + upstream : ""}`;
  }
  return `Seedance HTTP ${status}: ${upstream || JSON.stringify(body)}`;
}

/** 查询一次任务状态 */
export async function getSeedanceTask(
  taskId: string,
): Promise<SeedanceTaskInfo> {
  const resp = await fetch(`${BASE_URL}/video/generations/${taskId}`, {
    method: "GET",
    headers: authHeaders(),
  });
  let body: SeedanceTaskResponse;
  try {
    body = (await resp.json()) as SeedanceTaskResponse;
  } catch {
    throw new Error(`Seedance HTTP ${resp.status} 且响应不是 JSON`);
  }
  if (!resp.ok) {
    throw new Error(formatHttpError(resp.status, body));
  }
  return mergeTaskInfo(body);
}

/**
 * 兼容多种返回结构:
 *   A) 纯包装  : { code:"success", data: <task> }                   ← old new-api
 *   B) 任务直返: { task_id, status, fail_reason, result_url, ... }   ← 简单 mock
 *   C) 平铺+嵌套: { task_id, status, fail_reason, data: { error, status, ... } }
 *      ← 真实 new-api 现在的格式(101.37.232.133),外层是任务汇总,data 是 Volcano 原响应
 *
 * 关键:不要无脑 body.data ?? body —— C 的外层有 fail_reason,内嵌 data 没有,
 *   盲目 unwrap 会丢掉错误信息。这里始终以外层为准,内嵌的 error 抬上来补全。
 */
function mergeTaskInfo(body: SeedanceTaskResponse): SeedanceTaskInfo {
  if (!body) return {};
  // A 形:仅 code/data 两个关键键,直接 unwrap
  const looksLikeWrapper =
    body.code !== undefined && body.data && !body.task_id && !body.status;
  if (looksLikeWrapper) {
    return body.data as SeedanceTaskInfo;
  }
  // B/C 形:外层就是任务,可能嵌一个 data(Volcano 原响应)
  const info = body as SeedanceTaskInfo;
  const inner = info.data;
  // 把内嵌 error 抬到外层
  if (inner?.error && !info.error) {
    info.error = { code: inner.error.code, message: inner.error.message };
  }
  // 外层没有 fail_reason 时,用 inner.error.message 兜底
  if (!info.fail_reason && inner?.error?.message) {
    info.fail_reason = inner.error.message;
  }
  return info;
}

/**
 * v0.9.1 §10.8.2 — 从 TaskInfo 各嵌套层级里挑 usage(new-api 不同版本/不同模型放的位置不一)
 * 找不到返回 null,让前端不发 token 字段给后端,后端 cost_cents 保持 0(失败兜底)
 */
export function extractUsage(info: SeedanceTaskInfo): SeedanceUsage | null {
  const u =
    info?.data?.data?.usage ??
    info?.data?.usage ??
    info?.usage ??
    null;
  if (!u) return null;
  // 至少要有一个 token 数字才算有效
  if (typeof u.prompt_tokens === "number" || typeof u.completion_tokens === "number") {
    return u;
  }
  return null;
}

/** 从 TaskInfo 里按优先级取最终视频 URL,仅返回 http(s):// 形式的合法 URL */
export function extractVideoUrl(info: SeedanceTaskInfo): string | null {
  const candidates = [
    info?.result_url,
    info?.data?.data?.result_url,
    info?.data?.data?.content?.video_url,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && /^https?:\/\//i.test(c)) {
      return c;
    }
  }
  return null;
}

/** 进度归一化成 0-100 数字 */
export function normalizeProgress(
  p: string | number | undefined,
): number {
  if (typeof p === "number") return Math.max(0, Math.min(100, p));
  if (typeof p === "string") {
    const n = parseInt(p.replace(/[^\d]/g, ""), 10);
    if (!Number.isNaN(n)) return Math.max(0, Math.min(100, n));
  }
  return 0;
}

export function isTerminal(status?: string): "success" | "failed" | null {
  const s = (status ?? "").toUpperCase();
  if (s === "SUCCESS") return "success";
  if (s === "FAILED" || s === "FAILURE") return "failed";
  return null;
}
