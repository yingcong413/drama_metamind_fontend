import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PlayIcon } from "@/components/icons";
import { listTasks } from "@/api/tasks";
import { formatDateTime } from "@/lib/format";
import { useT, useTf } from "@/lib/i18n";
import type { GenerationTask } from "@/types";
import { StatusBadge } from "@/pages/account/StatusBadge";
import { VideoPreviewModal } from "@/pages/account/VideoPreviewModal";

// 首尾帧 / 智能多帧 模式下的「生成记录」,参照常规模式(使用记录)的任务列表。
// 点击任一条 → 复用 VideoPreviewModal:查看 / 下载视频 + 查看提示词。
export function FrameRecords() {
  const t = useT();
  const tf = useTf();
  const [preview, setPreview] = useState<GenerationTask | null>(null);

  const q = useQuery({
    queryKey: ["tasks", "frame-records"],
    queryFn: () => listTasks({ scope: "mine", page: 1, page_size: 20 }),
  });
  const rows = q.data?.list ?? [];

  return (
    <div className="fc-records">
      <div className="fc-records-head">
        <span className="fc-records-title">{t("生成记录")}</span>
        <span className="dim-2 mono" style={{ fontSize: 11 }}>{tf("{n} 条", { n: rows.length })}</span>
      </div>

      {q.isLoading ? (
        <div className="dim-2" style={{ fontSize: 12, padding: "16px 0" }}>{t("加载中…")}</div>
      ) : rows.length === 0 ? (
        <div className="dim-2" style={{ fontSize: 12, padding: "16px 0" }}>{t("暂无生成记录")}</div>
      ) : (
        <div className="fc-records-list">
          {rows.map((task) => (
            <button key={task.id} className="fc-record" onClick={() => setPreview(task)} title={t("点击查看 / 下载")}>
              <span className="fc-record-thumb">
                {task.thumbnail_urls?.[0] ? (
                  <img src={task.thumbnail_urls[0]} alt="" />
                ) : (
                  <PlayIcon />
                )}
              </span>
              <span className="fc-record-main">
                <span className="fc-record-id mono">{task.id}</span>
                <span className="dim-2" style={{ fontSize: 11 }}>
                  {formatDateTime(task.submit_time)} · {task.video_len_seconds}s · {task.resolution}
                </span>
              </span>
              <StatusBadge status={task.status} />
            </button>
          ))}
        </div>
      )}

      {preview && <VideoPreviewModal task={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
