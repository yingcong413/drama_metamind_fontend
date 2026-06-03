import type { CSSProperties } from "react";
import { PlayIcon } from "@/components/icons";
import { formatDateTime, formatYuan } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n";
import type { GenerationTask } from "@/types";
import { StatusBadge } from "./StatusBadge";

interface Props {
  rows: GenerationTask[];
  onPreview: (t: GenerationTask) => void;
}

export function TasksTable({ rows, onPreview }: Props) {
  const t = useT();
  return (
    <div className="tasks-table-wrap">
      <div className="tasks-table">
        <div className="tasks-thead">
          <div className="th time">{t("提交时间")}</div>
          <div className="th time">{t("结束时间")}</div>
          <div className="th dur">{t("耗时")}</div>
          <div className="th vlen">{t("时长")}</div>
          <div className="th res">{t("清晰度")}</div>
          <div className="th user">{t("用户")}</div>
          <div className="th id">{t("任务 ID")}</div>
          <div className="th status">{t("状态")}</div>
          <div className="th cost">{t("花费")}</div>
          <div className="th action">{t("详情")}</div>
        </div>
        {rows.length === 0 ? (
          <div className="tasks-empty">
            <div className="dim-2 mono" style={{ fontSize: 11 }}>NO MATCH</div>
            <div style={{ marginTop: 4 }}>{t("当前筛选条件下没有记录")}</div>
          </div>
        ) : (
          rows.map((task) => (
            <div
              key={task.id}
              className={cn("tasks-row", `status-${task.status}`)}
              style={{ cursor: "pointer" }}
              onClick={() => onPreview(task)}
              title={t("点击查看详情")}
            >
              <div className="td time mono">{formatDateTime(task.submit_time)}</div>
              <div className="td time mono">{task.end_time ? formatDateTime(task.end_time) : "—"}</div>
              <div className="td dur">
                <span className={cn("tag-dur", task.duration_seconds > 300 && "long")}>
                  {task.duration_seconds} s
                </span>
              </div>
              <div className="td vlen">
                <span className="vlen-chip mono">{task.video_len_seconds} s</span>
              </div>
              <div className="td res">
                <span className={cn("res-chip mono", `res-${task.resolution}`)}>{task.resolution}</span>
              </div>
              <div className="td user">
                <div
                  className="user-dot"
                  style={{ "--ph": (task.user.charCodeAt(0) * 7) % 360 } as CSSProperties}
                >
                  {task.user[0]}
                </div>
                <span>{task.user}</span>
              </div>
              <div className="td id mono" title={task.id}>{task.id}</div>
              <div className="td status">
                <StatusBadge status={task.status} />
              </div>
              <div className="td cost">
                {task.cost_cents > 0 ? (
                  <span className="cost-amount mono">
                    <span className="cur">¥</span>
                    {formatYuan(task.cost_cents)}
                  </span>
                ) : (
                  <span className="dim-2 mono">—</span>
                )}
              </div>
              <div className="td action">
                {task.status === "success" ? (
                  <button className="btn-link" onClick={() => onPreview(task)}>
                    <PlayIcon /> {t("点击预览视频")}
                  </button>
                ) : task.status === "failed" ? (
                  <span className="dim-2" style={{ fontSize: 11 }}>{task.fail_reason}</span>
                ) : task.status === "running" ? (
                  <button className="btn-link dim">{t("查看队列")}</button>
                ) : (
                  <span className="dim-2" style={{ fontSize: 11 }}>{t("等待调度")}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
