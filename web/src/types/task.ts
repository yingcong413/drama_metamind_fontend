export type TaskStatus = "queued" | "running" | "success" | "failed";
export type TaskType = "i2v" | "t2v" | "v2v" | "char";

export interface TaskTypeInfo {
  id: TaskType;
  label: string;
  hue: number;
}

export interface PromptSnapshot {
  version: string;
  structured_json: unknown;
  natural_text: string;
  locked: boolean;
}

export interface GenerationTask {
  id: string;
  project_id: string | null;
  user_id: string;
  type: TaskTypeInfo;
  platform: string;
  upstream_model: string;
  channel_id: number;
  user: string;
  status: TaskStatus;
  progress: number;
  submit_time: string;
  end_time: string | null;
  duration_seconds: number;
  video_len_seconds: number;
  resolution: "480p" | "720p" | "1080p" | "4k";
  cost_cents: number;
  /** v0.9.1 §10.8.2 token 用量(成功任务,来自 new-api usage.prompt_tokens) */
  input_tokens?: number;
  /** v0.9.1 §10.8.2 token 用量(成功任务,来自 new-api usage.completion_tokens) */
  output_tokens?: number;
  fail_reason: string | null;
  output_video_url: string | null;
  output_master_url: string | null;
  thumbnail_urls: string[];
  prompt: PromptSnapshot | null;
}
