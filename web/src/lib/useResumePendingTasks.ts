// 续轮询「关掉生成弹窗后仍未回填」的视频任务。
//
// 背景:GenerateRequestModal 提交后在弹窗内轮询 Seedance,完成时把 output_video_url
// 回填到我方任务。如果用户在生成完成前【关掉弹窗】,轮询被清掉 —— 上游其实已生成,
// 但我方任务一直停在 running、没有视频,使用记录里就看不到结果。
//
// 这个 hook 在「使用记录」页面把还在 running/queued 且有 upstream_task_id 的视频任务
// 重新轮询一遍:终态 success 就回填 output_video_url + token(后端据此扣费),
// 终态 failed 就回填失败原因 —— 关掉弹窗后也能在任务记录里看到结果。

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  extractUsage,
  extractVideoUrl,
  getSeedanceTask,
  isTerminal,
  normalizeProgress,
} from "@/api/seedance";
import { patchTask } from "@/api/tasks";
import { saveGenerationResult } from "@/lib/generationResult";
import type { GenerationTask } from "@/types";

export function useResumePendingTasks(tasks: GenerationTask[]) {
  const qc = useQueryClient();
  const inflight = useRef<Set<string>>(new Set());

  // 用「id:status」拼成 key,pending 集合变化时才重建 effect。
  const sig = tasks.map((t) => `${t.id}:${t.status}`).join(",");

  useEffect(() => {
    const pending = tasks.filter(
      (t) =>
        (t.status === "running" || t.status === "queued") &&
        !!t.upstream_task_id &&
        t.platform === "Seedance",
    );
    if (pending.length === 0) return;

    let alive = true;

    const tick = async () => {
      for (const tk of pending) {
        const up = tk.upstream_task_id;
        if (!up || inflight.current.has(tk.id)) continue;
        inflight.current.add(tk.id);
        try {
          const info = await getSeedanceTask(up);
          if (!alive) return;
          const term = isTerminal(info.status);
          if (term === "success") {
            const url = extractVideoUrl(info);
            const usage = extractUsage(info);
            await patchTask(tk.id, {
              status: "success",
              progress: 100,
              output_video_url: url,
              end_time: new Date().toISOString(),
              input_tokens: usage?.prompt_tokens,
              output_tokens: usage?.completion_tokens,
            });
            if (url && tk.project_id) {
              saveGenerationResult(tk.project_id, {
                task_id: up,
                video_url: url,
                resolution: tk.resolution,
              });
            }
            qc.invalidateQueries({ queryKey: ["tasks"] });
            qc.invalidateQueries({ queryKey: ["account"] });
          } else if (term === "failed") {
            await patchTask(tk.id, {
              status: "failed",
              fail_reason: info.fail_reason || info.error?.message || "生成失败",
              end_time: new Date().toISOString(),
            });
            qc.invalidateQueries({ queryKey: ["tasks"] });
          } else {
            // 仍在跑:静默同步进度(不刷新列表,避免抖动)
            await patchTask(tk.id, { progress: normalizeProgress(info.progress) }).catch(() => {});
          }
        } catch {
          /* 轮询错误忽略,下一轮再试 */
        } finally {
          inflight.current.delete(tk.id);
        }
      }
    };

    void tick();
    const timer = window.setInterval(() => void tick(), 6000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
}
