import { CloseIcon, CopyIcon, PlayIcon, UploadIcon } from "@/components/icons";
import { formatDateTime, formatYuan } from "@/lib/format";
import type { GenerationTask } from "@/types";

interface Props {
  task: GenerationTask;
  onClose: () => void;
}

export function VideoPreviewModal({ task, onClose }: Props) {
  const previewSeconds = Math.min(99, Math.round(task.duration_seconds * 0.1));
  const shotCount = Math.min(8, Math.round(task.duration_seconds / 8));

  return (
    <>
      <div className="drawer-mask" onClick={onClose} />
      <div className="video-modal">
        <div className="video-modal-head">
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div
              className="dim-2 mono"
              style={{ fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase" }}
            >
              预览 · {task.type.label} · {task.platform}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, fontFamily: "var(--font-mono)" }}>
              {task.id}
            </div>
          </div>
          <button className="btn-ghost btn-icon" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <div className="video-modal-body">
          <div className="video-modal-stage">
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                color: "rgba(255,255,255,.3)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: ".1em",
              }}
            >
              VIDEO 1080×1920 · MP4 · 8.4 MB
            </div>
            <div
              style={{
                position: "absolute",
                top: 14,
                left: 14,
                padding: "4px 8px",
                background: "rgba(0,0,0,.55)",
                color: "white",
                borderRadius: 4,
                fontFamily: "var(--font-mono)",
                fontSize: 10,
              }}
            >
              {Math.round(task.duration_seconds / 8)} 个分镜 ·{" "}
              {(task.duration_seconds / 60).toFixed(1)}m
            </div>
            <div className="video-controls">
              <div className="video-timeline">
                <div className="played" style={{ width: "0%" }} />
              </div>
              <div className="row">
                <div className="play">
                  <PlayIcon />
                </div>
                <span>00:00 / 00:{String(previewSeconds).padStart(2, "0")}</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 12, opacity: 0.8 }}>
                  <span>1×</span>
                  <span>HD</span>
                  <span>⛶</span>
                </div>
              </div>
            </div>
          </div>

          <div className="video-modal-side">
            <div className="vm-section">
              <div
                className="dim-2 mono"
                style={{
                  fontSize: 10, letterSpacing: ".08em",
                  textTransform: "uppercase", marginBottom: 8,
                }}
              >
                任务信息
              </div>
              <div className="vm-info-row"><span className="dim">用户</span><span>{task.user}</span></div>
              <div className="vm-info-row"><span className="dim">渠道</span><span className="mono">{task.channel_id}</span></div>
              <div className="vm-info-row">
                <span className="dim">提交</span>
                <span className="mono" style={{ fontSize: 12 }}>{formatDateTime(task.submit_time)}</span>
              </div>
              <div className="vm-info-row">
                <span className="dim">结束</span>
                <span className="mono" style={{ fontSize: 12 }}>
                  {task.end_time ? formatDateTime(task.end_time) : "—"}
                </span>
              </div>
              <div className="vm-info-row">
                <span className="dim">耗时</span>
                <span className="mono">{task.duration_seconds} s</span>
              </div>
              <div className="vm-info-row">
                <span className="dim">消耗</span>
                <span className="mono" style={{ color: "var(--accent)" }}>
                  ¥ {formatYuan(task.cost_cents)}
                </span>
              </div>
            </div>

            <div className="vm-section">
              <div
                className="dim-2 mono"
                style={{
                  fontSize: 10, letterSpacing: ".08em",
                  textTransform: "uppercase", marginBottom: 8,
                }}
              >
                下载
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button className="btn btn-primary" style={{ justifyContent: "flex-start", padding: "10px 14px" }}>
                  <UploadIcon style={{ transform: "rotate(180deg)" }} /> 下载视频 · MP4 · 1080p
                </button>
                <button className="btn" style={{ justifyContent: "flex-start", padding: "10px 14px" }}>
                  <UploadIcon style={{ transform: "rotate(180deg)" }} /> 下载 ProRes 母版
                  <span className="dim-2 mono" style={{ marginLeft: "auto", fontSize: 10 }}>27 MB</span>
                </button>
                <button className="btn" style={{ justifyContent: "flex-start", padding: "10px 14px" }}>
                  <CopyIcon /> 复制分享链接
                </button>
              </div>
            </div>

            <div className="vm-section">
              <div
                className="dim-2 mono"
                style={{
                  fontSize: 10, letterSpacing: ".08em",
                  textTransform: "uppercase", marginBottom: 8,
                }}
              >
                分镜缩略图
              </div>
              <div className="vm-shots">
                {Array.from({ length: shotCount }).map((_, i) => (
                  <div
                    key={i}
                    className="vm-shot"
                    style={{
                      background: `linear-gradient(135deg, oklch(35% .10 ${(i * 50 + task.type.hue) % 360}), oklch(20% .08 ${(i * 50 + task.type.hue + 60) % 360}))`,
                    }}
                  >
                    <span className="mono">{String(i + 1).padStart(2, "0")}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
