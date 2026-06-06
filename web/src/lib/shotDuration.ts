// lib/shotDuration.ts —— 按分镜「填写的内容量」估算单镜时长。
//
// 之前时长是硬编码(0.6 + i*0.2),跟内容无关。现在按 描述 + 起承转动作 + 台词/独白/旁白
// 的字数估:内容越多,镜头越长。用户手动填了 duration_seconds 则以手填为准。

import type { Shot } from "@/types";

const MIN_SEC = 1.5;
const MAX_SEC = 8;
const CHARS_PER_SEC = 12; // 经验值:约每 12 个字 1 秒

export function estimateShotSeconds(shot: Shot): number {
  // 手动填写优先
  if (typeof shot.duration_seconds === "number" && shot.duration_seconds > 0) {
    return shot.duration_seconds;
  }
  const parts = [
    shot.description,
    shot.action?.start, shot.action?.mid, shot.action?.end,
    shot.lines?.text, shot.mono?.text, shot.narration?.text,
  ].filter(Boolean) as string[];
  const len = parts.join("").length;
  // 台词多 → 适当再加点时间(念白占时)
  const speechLen = (shot.lines?.text?.length ?? 0) + (shot.mono?.text?.length ?? 0) + (shot.narration?.text?.length ?? 0);
  const raw = MIN_SEC + len / CHARS_PER_SEC + speechLen / 24;
  return Math.max(MIN_SEC, Math.min(MAX_SEC, Math.round(raw * 10) / 10));
}

/** 整支视频的估算总时长 = 各分镜估算之和。 */
export function estimateTotalSeconds(shots: Shot[]): number {
  return Math.round(shots.reduce((sum, s) => sum + estimateShotSeconds(s), 0) * 10) / 10;
}
