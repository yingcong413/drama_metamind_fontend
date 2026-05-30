import { CloseIcon, CopyIcon, PlayIcon, UploadIcon } from "@/components/icons";
import { formatDateTime, formatYuan } from "@/lib/format";
import type { GenerationTask } from "@/types";

interface Props {
  task: GenerationTask;
  onClose: () => void;
}

export function VideoPreviewModal({ task, onClose }: Props) {
  const videoUrl = task.output_video_url;

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
          <div className="video-modal-stage" style={{ background: "#000" }}>
            {videoUrl ? (
              <video
                src={videoUrl}
                controls
                style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }}
              />
            ) : (
              <div
                style={{
                  position: "absolute", inset: 0,
                  display: "grid", placeItems: "center", gap: 8,
                  color: "rgba(255,255,255,.4)", fontSize: 12,
                }}
              >
                <PlayIcon />
                {task.status === "failed"
                  ? `生成失败${task.fail_reason ? "：" + task.fail_reason : ""}`
                  : "暂无可播放的视频"}
              </div>
            )}
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

          </div>
        </div>
      </div>
    </>
  );
}
