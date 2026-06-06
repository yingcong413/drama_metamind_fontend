// api/metamind.ts —— metamind.ltd AI 助手客户端
//
// OpenAI 兼容网关:
//   - 文本(gpt-5.4):  POST /v1/chat/completions
//   - 出图(gpt-image-2): 异步 POST /v1/async/images/generations + 轮询 GET /v1/async/images/tasks/{id}
//     (gpt-image-2 30-90s,生产 ALB 60s 超时,必须走异步,见 docs/test_seedance2/API_USAGE_GUIDE.md)
//
// 浏览器直连会被 CORS 拦,默认走 /metamind-proxy(dev=vite,生产=nginx)。
// Key 优先级: VITE_METAMIND_API_KEY 环境变量。

const BASE_URL =
  (import.meta.env.VITE_METAMIND_BASE_URL as string | undefined) || "/metamind-proxy/v1";
const API_KEY = (import.meta.env.VITE_METAMIND_API_KEY as string | undefined) || "";

export const CHAT_MODEL =
  (import.meta.env.VITE_METAMIND_CHAT_MODEL as string | undefined) || "gpt-5.4";
export const IMAGE_MODEL =
  (import.meta.env.VITE_METAMIND_IMAGE_MODEL as string | undefined) || "gpt-image-2";
export const TTS_MODEL =
  (import.meta.env.VITE_METAMIND_TTS_MODEL as string | undefined) || "gpt-4o-mini-tts";

function headers(): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) h.Authorization = `Bearer ${API_KEY}`;
  return h;
}

function ensureKey() {
  if (!API_KEY) {
    throw new Error("未配置 AI 密钥:请在 web/.env.local 设置 VITE_METAMIND_API_KEY 后重试。");
  }
}

// ─────────────── 文本(chat) ───────────────

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** AI 调用的 token 用量,供任务记录回填(后端按 token 算费) */
export interface AiUsage {
  input_tokens: number;
  output_tokens: number;
}

/** 非流式 chat,返回首条回复的纯文本 */
export async function chatComplete(
  messages: ChatMessage[],
  opts: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    timeoutMs?: number;
    onUsage?: (u: AiUsage) => void;
  } = {},
): Promise<string> {
  ensureKey();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 90_000);
  let resp: Response;
  try {
    resp = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        model: opts.model ?? CHAT_MODEL,
        messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.max_tokens ?? 4096,
        stream: false,
      }),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  const raw = await resp.text();
  let json: unknown = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    /* keep raw */
  }
  if (!resp.ok) {
    const msg =
      (json as { error?: { message?: string }; message?: string } | null)?.error?.message ||
      (json as { message?: string } | null)?.message ||
      raw.slice(0, 300);
    throw new Error(`AI 文本接口 HTTP ${resp.status}: ${msg}`);
  }
  const usage = (json as {
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  } | null)?.usage;
  if (usage) {
    opts.onUsage?.({
      input_tokens: usage.prompt_tokens ?? 0,
      output_tokens: usage.completion_tokens ?? 0,
    });
  }
  const content = (json as {
    choices?: Array<{ message?: { content?: string } }>;
  } | null)?.choices?.[0]?.message?.content;
  if (!content) throw new Error(`AI 文本接口返回为空: ${raw.slice(0, 200)}`);
  return content;
}

// ─────────────── 配音(TTS) ───────────────

/**
 * 文本转语音(TTS):OpenAI 兼容 POST /v1/audio/speech,与 chat/出图同一网关、同一 Key。
 * 返回音频 Blob(默认 mp3)。模型可用 VITE_METAMIND_TTS_MODEL 覆盖。
 * 注意:该接口只做「文本→语音」,不生成环境音效 / 背景音乐。
 */
export async function synthesizeSpeech(
  text: string,
  opts: {
    model?: string;
    voice?: string;
    instructions?: string;
    format?: "mp3" | "wav" | "opus" | "aac" | "flac";
    timeoutMs?: number;
  } = {},
): Promise<Blob> {
  ensureKey();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 90_000);
  let resp: Response;
  try {
    resp = await fetch(`${BASE_URL}/audio/speech`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        model: opts.model ?? TTS_MODEL,
        input: text,
        voice: opts.voice ?? "alloy",
        ...(opts.instructions ? { instructions: opts.instructions } : {}),
        response_format: opts.format ?? "mp3",
      }),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!resp.ok) {
    const raw = await resp.text();
    throw new Error(`AI 语音接口 HTTP ${resp.status}: ${raw.slice(0, 300)}`);
  }
  return await resp.blob();
}

/** 音频 Blob → File,用于直传 TOS */
export function blobToFile(blob: Blob, filename: string, mime = "audio/mpeg"): File {
  return new File([blob], filename, { type: blob.type || mime });
}

// ─────────────── 出图(异步) ───────────────

interface AsyncImageTask {
  id?: string;
  status?: string; // pending | processing | success | failed
  error?: string;
  result?: { data?: Array<{ b64_json?: string; url?: string }> };
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
}

/**
 * gpt-image-2 异步出图:提交 → 轮询直到 success → 返回 base64(无 data: 前缀)。
 * onStatus 可用于 UI 显示「生成中…」。
 */
export async function generateImage(
  prompt: string,
  opts: {
    model?: string;
    size?: string;
    timeoutMs?: number;
    intervalMs?: number;
    onStatus?: (status: string) => void;
    onUsage?: (u: AiUsage) => void;
  } = {},
): Promise<string> {
  ensureKey();
  const model = opts.model ?? IMAGE_MODEL;
  const size = opts.size ?? "1024x1024";

  // 1) 提交
  const submitResp = await fetch(`${BASE_URL}/async/images/generations`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ model, prompt, n: 1, size }),
  });
  const submitRaw = await submitResp.text();
  let submit: AsyncImageTask | null = null;
  try {
    submit = submitRaw ? (JSON.parse(submitRaw) as AsyncImageTask) : null;
  } catch {
    /* keep raw */
  }
  if (!submitResp.ok || !submit?.id) {
    const msg =
      (submit as { error?: string } | null)?.error || submitRaw.slice(0, 300) || submitResp.status;
    throw new Error(`AI 出图提交失败: ${msg}`);
  }
  const taskId = submit.id;

  // 2) 轮询
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const intervalMs = opts.intervalMs ?? 3_000;
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const r = await fetch(`${BASE_URL}/async/images/tasks/${taskId}`, { headers: headers() });
    const task = (await r.json()) as AsyncImageTask;
    if (task.status) opts.onStatus?.(task.status);
    if (task.status === "success") {
      const b64 = task.result?.data?.[0]?.b64_json;
      if (b64) {
        if (task.usage) {
          opts.onUsage?.({
            input_tokens: task.usage.input_tokens ?? 0,
            output_tokens: task.usage.output_tokens ?? 0,
          });
        }
        return b64;
      }
      throw new Error("AI 出图成功但结果为空");
    }
    if (task.status === "failed") {
      throw new Error(`AI 出图失败: ${task.error || "未知原因"}`);
    }
  }
  throw new Error(`AI 出图超时(${timeoutMs / 1000}s),请稍后重试`);
}

// ─────────────── 工具 ───────────────

/** base64(无前缀)→ File,用于直传 TOS */
export function b64ToFile(b64: string, filename: string, mime = "image/png"): File {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const bin = atob(clean);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], filename, { type: mime });
}

/** AI 助手是否已配置可用(决定面板是否提示去配 key) */
export function isMetamindConfigured(): boolean {
  return !!API_KEY;
}
