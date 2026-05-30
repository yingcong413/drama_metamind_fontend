/**
 * 生成视频结果的本地持久化（按项目存「多条」列表）。
 *
 * v0.9.6 起改为列表:每次生成成功 append 一条,结果页按项目列出全部历史,
 * 不再覆盖式只存最近一条。真后端模式下结果以 tasks 表为准,本地列表是兜底
 * (纯 mock / 后端还没同步时也能看到刚生成的多条)。
 *
 * 注:Seedance 返回的视频 URL 是带签名的临时地址,可能几小时后失效。
 */

const PREFIX = "metamind-mock-v1-results-";
const MAX = 50;

export interface GenerationResult {
  /** Seedance task id(也作列表去重键) */
  task_id: string;
  /** 视频可播放 URL(http/https) */
  video_url: string;
  /** 分辨率(可选,展示用) */
  resolution?: string;
  /** 写入时间戳(ms) */
  saved_at: number;
}

function keyOf(projectId: string): string {
  return PREFIX + projectId;
}

/** 读取某项目的全部生成结果(最新在前) */
export function loadGenerationResults(projectId: string): GenerationResult[] {
  try {
    const raw = localStorage.getItem(keyOf(projectId));
    if (!raw) return [];
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as GenerationResult[]) : [];
  } catch {
    return [];
  }
}

/** append 一条生成结果(按 task_id 去重,最新在前,上限 MAX) */
export function saveGenerationResult(
  projectId: string,
  payload: Omit<GenerationResult, "saved_at">,
): void {
  try {
    const list = loadGenerationResults(projectId).filter((r) => r.task_id !== payload.task_id);
    list.unshift({ ...payload, saved_at: Date.now() });
    localStorage.setItem(keyOf(projectId), JSON.stringify(list.slice(0, MAX)));
  } catch (e) {
    console.warn("[generationResult] save failed", e);
  }
}

/** 兼容旧用法:返回最近一条 */
export function loadGenerationResult(projectId: string): GenerationResult | null {
  return loadGenerationResults(projectId)[0] ?? null;
}

export function clearGenerationResult(projectId: string): void {
  try {
    localStorage.removeItem(keyOf(projectId));
  } catch {
    /* ignore */
  }
}
