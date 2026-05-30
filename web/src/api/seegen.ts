// seegen.ts —— SeeGen AI(api.seegen.ai)素材库 REST 客户端
//
// 镜像 docs/seedance_sucai/upload_seegen_assets.py 中 SeeGenClient 的三个核心动作:
//   POST /v1/assets/groups   CreateAssetGroup   (按角色懒建)
//   POST /v1/assets          CreateAsset        (注册 TOS 公网 URL 为素材)
//   GET  /v1/assets/{id}     GetAsset           (轮询 Active / Failed)
//
// 浏览器直接打 https://api.seegen.ai 会被 CORS 拦,因此默认走 /seegen-proxy/v1
//   - 开发: vite.config.ts proxy 转发到 api.seegen.ai
//   - 生产: nginx-metamind.conf /seegen-proxy/ location 转发到 api.seegen.ai
//
// API Key 优先级:
//   VITE_SEEGEN_API_KEY 环境变量  >  BUILTIN_SEEGEN_API_KEY 默认值
// 与 docs/seedance_sucai/upload_virtual_avatar.py 中的 BUILTIN_AK/SK 同模式

const BUILTIN_SEEGEN_API_KEY =
  "sk-ae623dc7123e830ad9229df67dbccf0f14529dea7ef9268ab0e6f04221f1fb33";

const BASE_URL =
  (import.meta.env.VITE_SEEGEN_BASE_URL as string | undefined) ||
  "/seegen-proxy/v1";

const API_KEY =
  (import.meta.env.VITE_SEEGEN_API_KEY as string | undefined) ||
  BUILTIN_SEEGEN_API_KEY;

// ─────────── 响应模型 ───────────
// SeeGen 的字段命名不完全统一(officialId / id / groupId / assetId 都可能出现),
// 这里全部声明为可选,统一在 pickId 里按优先级取。

export interface SeegenIdLike {
  officialId?: string;
  id?: string;
  groupId?: string;
  assetId?: string;
}

export interface SeegenAssetGroup extends SeegenIdLike {
  name?: string;
  description?: string;
  region?: string;
}

export interface SeegenAsset extends SeegenIdLike {
  groupId?: string;
  url?: string;
  name?: string;
  type?: "image" | "video" | "audio";
  /** "Active" | "Failed" | "Processing" | "Reviewing" ... */
  status?: string;
  thumbnailUrl?: string;
  thumbnail_url?: string;

  /** 失败原因(不同版本字段名不一,都兜底) */
  processingError?: string;
  errorMessage?: string;
  failReason?: string;
  message?: string;

  width?: number;
  height?: number;
  duration?: number;
  durationSeconds?: number;
  fps?: number;
  size?: number;
  mime?: string;
}

// ─────────── 工具 ───────────

export function pickId(o: SeegenIdLike | null | undefined): string | null {
  if (!o) return null;
  return o.officialId ?? o.id ?? o.groupId ?? o.assetId ?? null;
}

/** SeeGen 后端的 status 字符串归一化到前端 AssetStatus */
export function normalizeStatus(
  status?: string,
): "processing" | "active" | "failed" {
  const s = (status ?? "").toLowerCase();
  if (s === "active" || s === "success" || s === "ready" || s === "succeeded") {
    return "active";
  }
  if (
    s === "failed" ||
    s === "failure" ||
    s === "rejected" ||
    s === "error"
  ) {
    return "failed";
  }
  return "processing";
}

export function pickError(a: SeegenAsset | null | undefined): string | null {
  if (!a) return null;
  return (
    a.processingError ??
    a.errorMessage ??
    a.failReason ??
    a.message ??
    null
  );
}

export function pickThumbnail(a: SeegenAsset | null | undefined): string | null {
  if (!a) return null;
  return a.thumbnailUrl ?? a.thumbnail_url ?? null;
}

// ─────────── HTTP ───────────

function authHeaders(): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) h.Authorization = `Bearer ${API_KEY}`;
  return h;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const init: RequestInit = { method, headers: authHeaders() };
  if (body !== undefined) init.body = JSON.stringify(body);
  const url = BASE_URL + path;
  const resp = await fetch(url, init);

  // 把响应当 text 读一次再尝试解析为 JSON,这样 4xx/5xx 不论是不是 JSON
  // 都能把原始 body 抛出来 —— 之前只显示 "Bad Request" 完全看不到上游真实错误。
  const raw = await resp.text();
  let json: unknown = null;
  if (raw) {
    try {
      json = JSON.parse(raw);
    } catch {
      /* 非 JSON 保留 raw */
    }
  }

  if (!resp.ok) {
    // 把整个请求/响应都打到控制台,方便 DevTools Network + Console 对照
    /* eslint-disable no-console */
    console.error("[SeeGen] request failed", {
      method,
      url,
      status: resp.status,
      requestBody: body,
      responseRaw: raw,
      responseJson: json,
    });
    /* eslint-enable no-console */

    const j = json as
      | {
          message?: string;
          error?: { message?: string; code?: string };
          code?: string | number;
          msg?: string;
        }
      | null;
    const detail =
      j?.message ??
      j?.error?.message ??
      j?.msg ??
      (typeof j?.code !== "undefined" ? String(j.code) : "") ??
      "";
    const fragment = detail || raw.slice(0, 300) || resp.statusText || "未知错误";
    throw new Error(`SeeGen HTTP ${resp.status}: ${fragment}`);
  }
  return json as T;
}

// ─────────── API 动作 ───────────

export function createAssetGroup(input: {
  name: string;
  description?: string;
  region?: "cn" | "intl";
}): Promise<SeegenAssetGroup> {
  return request<SeegenAssetGroup>("POST", "/assets/groups", input);
}

export function listAssetGroups(): Promise<SeegenAssetGroup[]> {
  return request<SeegenAssetGroup[]>("GET", "/assets/groups");
}

export function createAsset(input: {
  groupId: string;
  url: string;
  name?: string;
  type?: "image" | "video" | "audio";
}): Promise<SeegenAsset> {
  return request<SeegenAsset>("POST", "/assets", input);
}

export function getAsset(id: string): Promise<SeegenAsset> {
  return request<SeegenAsset>("GET", `/assets/${id}`);
}
