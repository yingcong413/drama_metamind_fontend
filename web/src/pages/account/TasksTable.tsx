import type { CSSProperties } from "react";
import { PlayIcon } from "@/components/icons";
import { formatDateTime, formatYuan } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { GenerationTask } from "@/types";
import { StatusBadge } from "./StatusBadge";

interface Props {
  rows: GenerationTask[];
  onPreview: (t: GenerationTask) => void;
}

export function TasksTable({ rows, onPreview }: Props) {
  return (
    <div className="tasks-table-wrap">
      <div className="tasks-table">
        <div className="tasks-thead">
          <div className="th time">提交时间</div>
          <div className="th time">结束时间</div>
          <div className="th dur">耗时</div>
          <div className="th vlen">时长</div>
          <div className="th res">清晰度</div>
          <div className="th user">用户</div>
          <div className="th id">任务 ID</div>
          <div className="th status">状态</div>
          <div className="th progress">进度</div>
          <div className="th cost">花费</div>
          <div className="th action">详情</div>
        </div>
        {rows.length === 0 ? (
          <div className="tasks-empty">
            <div className="dim-2 mono" style={{ fontSize: 11 }}>NO MATCH</div>
            <div style={{ marginTop: 4 }}>当前筛选条件下没有记录</div>
          </div>
        ) : (
          rows.map((t) => (
            <div key={t.id} className={cn("tasks-row", `status-${t.status}`)}>
              <div className="td time mono">{formatDateTime(t.submit_time)}</div>
              <div className="td time mono">{t.end_time ? formatDateTime(t.end_time) : "—"}</div>
              <div className="td dur">
                <span className={cn("tag-dur", t.duration_seconds > 300 && "long")}>
                  {t.duration_seconds} s
                </span>
              </div>
              <div className="td vlen">
                <span className="vlen-chip mono">{t.video_len_seconds} s</span>
              </div>
              <div className="td res">
                <span className={cn("res-chip mono", `res-${t.resolution}`)}>{t.resolution}</span>
              </div>
              <div className="td user">
                <div
                  className="user-dot"
                  style={{ "--ph": (t.user.charCodeAt(0) * 7) % 360 } as CSSProperties}
                >
                  {t.user[0]}
                </div>
                <span>{t.user}</span>
              </div>
              <div className="td id mono" title={t.id}>{t.id}</div>
              <div className="td status">
                <StatusBadge status={t.status} />
              </div>
              <div className="td progress">
                <div className="prog-bar">
                  <div
                    className={cn("prog-fill", `prog-${t.status}`)}
                    style={{ width: t.progress + "%" }}
                  />
                </div>
                <span className="prog-pct mono">{t.progress}%</span>
              </div>
              <div className="td cost">
                {t.cost_cents > 0 ? (
                  <span className="cost-amount mono">
                    <span className="cur">¥</span>
                    {formatYuan(t.cost_cents)}
                  </span>
                ) : (
                  <span className="dim-2 mono">—</span>
                )}
              </div>
              <div className="td action">
                {t.status === "success" ? (
                  <button className="btn-link" onClick={() => onPreview(t)}>
                    <PlayIcon /> 点击预览视频
                  </button>
                ) : t.status === "failed" ? (
                  <span className="dim-2" style={{ fontSize: 11 }}>{t.fail_reason}</span>
                ) : t.status === "running" ? (
                  <button className="btn-link dim">查看队列</button>
                ) : (
                  <span className="dim-2" style={{ fontSize: 11 }}>等待调度</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
