// api/tasks.ts —— 使用记录(任务列表)客户端
//
// PRD §10 落地:USE_REAL_AUTH=true 时走真后端 /api/v1/tasks/*
// 与 org.ts 一致 — 任务属于鉴权 / 计费体系,不归"数据 mock"(那个是 characters/projects)。
// 兜底:USE_REAL_AUTH=false 时走 mock(开发期沿用 28 条假数据)。

import { USE_REAL_AUTH, client, get, patch as httpPatch, post } from "./client";
import { mockListTasks, type ListTasksParams } from "./_mock";
import type { GenerationTask, Pagination, PromptSnapshot, TaskStatus } from "@/types";

export type { ListTasksParams };

const USE_MOCK_TASKS = !USE_REAL_AUTH;

// ─────────── 列表 ───────────

export interface ListTasksQuery {
  scope?: "mine" | "all";
  cast_user_id?: string;
  project_id?: string;
  status?: TaskStatus | "all";
  resolution?: "720p" | "1080p" | "all";
  task_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

export function listTasks(params: ListTasksQuery = {}): Promise<Pagination<GenerationTask>> {
  if (USE_MOCK_TASKS) {
    // Mock 不认识 scope,直接走原 ListTasksParams 子集
    return mockListTasks({
      status: params.status,
      resolution: params.resolution,
      task_id: params.task_id,
      page: params.page,
      page_size: params.page_size,
    });
  }
  return get<Pagination<GenerationTask>>("/tasks", params);
}

// ─────────── 详情 ───────────

export function getTask(id: string): Promise<GenerationTask> {
  if (USE_MOCK_TASKS) {
    // Mock 不存详情,返回一个最小占位 — UI 应当从列表里拿
    return Promise.reject(new Error(`mock 模式不支持 getTask`));
  }
  return get<GenerationTask>(`/tasks/${id}`);
}

// ─────────── 创建(供 GenerateRequestModal 在提交 Seedance 时调) ───────────

export interface CreateTaskRequest {
  project_id?: string | null;
  type_id?: "i2v" | "t2v" | "v2v" | "char";
  platform?: string;
  upstream_model?: string;
  channel_id?: number;
  upstream_task_id?: string | null;
  video_len_seconds?: number;
  resolution?: "720p" | "1080p" | "4k";
  prompt?: PromptSnapshot | unknown;
}

export function createTask(input: CreateTaskRequest): Promise<GenerationTask> {
  if (USE_MOCK_TASKS) {
    // Mock 不真存,返回一个临时 task 对象(给 UI 流程跑通)
    return Promise.resolve({
      id: "task_mock_" + Date.now().toString(36),
      project_id: input.project_id ?? null,
      user_id: "u_mock",
      type: { id: input.type_id ?? "i2v", label: "图生视频", hue: 250 },
      platform: input.platform ?? "Seedance",
      upstream_model: input.upstream_model ?? "",
      channel_id: input.channel_id ?? 0,
      user: "你",
      status: "queued",
      progress: 0,
      submit_time: new Date().toISOString(),
      end_time: null,
      duration_seconds: 0,
      video_len_seconds: input.video_len_seconds ?? 0,
      resolution: input.resolution ?? "1080p",
      cost_cents: 0,
      fail_reason: null,
      output_video_url: null,
      output_master_url: null,
      thumbnail_urls: [],
      prompt: (input.prompt as PromptSnapshot | null) ?? null,
    } as GenerationTask);
  }
  return post<GenerationTask>("/tasks", input);
}

// ─────────── 更新(P5:轮询 Seedance 拿到结果后回填) ───────────

export interface UpdateTaskPatch {
  status?: TaskStatus;
  progress?: number;
  end_time?: string | null;
  fail_reason?: string | null;
  output_video_url?: string | null;
  output_master_url?: string | null;
  thumbnail_urls?: string[];
  cost_cents?: number;
  upstream_task_id?: string | null;
  // v0.9.1 §10.8.2 token 用量;传了后端会自动按 ¥2/M+¥28/M 算 cost_cents 覆盖
  input_tokens?: number;
  output_tokens?: number;
}

export function patchTask(id: string, p: UpdateTaskPatch): Promise<GenerationTask> {
  if (USE_MOCK_TASKS) {
    // Mock 模式不真更,返回个 stub
    return Promise.resolve({} as GenerationTask);
  }
  return httpPatch<GenerationTask>(`/tasks/${id}`, p);
}

// ─────────── 统计(P3:Owner 全公司汇总条) ───────────

export interface TaskStats {
  scope: "mine" | "all";
  total_count: number;
  by_status: Record<TaskStatus, number>;
  total_cost_cents: number;
  active_members: number;
  top_submitters: Array<{
    user_id: string;
    name: string;
    count: number;
    cost_cents: number;
  }>;
}

export function getTaskStats(
  scope: "mine" | "all" = "mine",
  range?: { date_from?: string; date_to?: string },
): Promise<TaskStats> {
  if (USE_MOCK_TASKS) {
    return Promise.resolve({
      scope,
      total_count: 0,
      by_status: { queued: 0, running: 0, success: 0, failed: 0 },
      total_cost_cents: 0,
      active_members: 1,
      top_submitters: [],
    });
  }
  return get<TaskStats>("/tasks/stats", { scope, ...range });
}

// ─────────── CSV 导出(P4) ───────────

export async function exportTasksCsv(query: ListTasksQuery): Promise<void> {
  if (USE_MOCK_TASKS) {
    alert("mock 模式不支持导出;请配置真后端(USE_REAL_AUTH=true)");
    return;
  }
  // 用 axios 直接拉 blob,触发浏览器下载
  const resp = await client.get<Blob>("/tasks/export", {
    params: query,
    responseType: "blob",
  });
  // 从响应头取文件名
  const disp = resp.headers["content-disposition"] || "";
  const m = /filename="?([^"]+)"?/i.exec(disp);
  const name = m?.[1] ?? `metamind-tasks-${Date.now()}.csv`;

  const url = URL.createObjectURL(resp.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
