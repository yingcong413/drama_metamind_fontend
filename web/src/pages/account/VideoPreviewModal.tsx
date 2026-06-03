import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CloseIcon, CopyIcon, PlayIcon, SparkleIcon, UploadIcon } from "@/components/icons";
import { formatDateTime, formatYuan } from "@/lib/format";
import { useT, useTf } from "@/lib/i18n";
import type { GenerationTask } from "@/types";

interface Props {
  task: GenerationTask;
  onClose: () => void;
}

export function VideoPreviewModal({ task, onClose }: Props) {
  const t = useT();
  const tf = useTf();
  const navigate = useNavigate();
  const videoUrl = task.output_video_url;

  // 给模型的所有提示词:优先自然语言文本,退化到结构化 JSON,再退化到占位
  const promptText =
    task.prompt?.natural_text?.trim() ||
    (task.prompt?.structured_json
      ? JSON.stringify(task.prompt.structured_json, null, 2)
      : "") ||
    t("本任务未保存提示词记录");

  const [copied, setCopied] = useState(false);
  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
    } catch {
      const ta = document.getElementById("vm-prompt-textarea") as HTMLTextAreaElement | null;
      ta?.select();
      document.execCommand("copy");
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleRegenerate = () => {
    if (!task.project_id) {
      alert(t("该任务未关联项目，无法重新生成"));
      return;
    }
    onClose();
    navigate(`/projects/${task.project_id}/edit`);
  };

  const handleDownload = () => {
    if (!videoUrl) return;
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = "";
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

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
              {t("预览")} · {task.type.label} · {task.platform}
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
                  ? task.fail_reason
                    ? tf("生成失败：{reason}", { reason: task.fail_reason })
                    : t("生成失败")
                  : t("暂无可播放的视频")}
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
                {t("任务信息")}
              </div>
              <div className="vm-info-row"><span className="dim">{t("用户")}</span><span>{task.user}</span></div>
              <div className="vm-info-row"><span className="dim">{t("渠道")}</span><span className="mono">{task.channel_id}</span></div>
              <div className="vm-info-row">
                <span className="dim">{t("提交")}</span>
                <span className="mono" style={{ fontSize: 12 }}>{formatDateTime(task.submit_time)}</span>
              </div>
              <div className="vm-info-row">
                <span className="dim">{t("结束")}</span>
                <span className="mono" style={{ fontSize: 12 }}>
                  {task.end_time ? formatDateTime(task.end_time) : "—"}
                </span>
              </div>
              <div className="vm-info-row">
                <span className="dim">{t("耗时")}</span>
                <span className="mono">{task.duration_seconds} s</span>
              </div>
              <div className="vm-info-row">
                <span className="dim">{t("消耗")}</span>
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
                {t("操作")}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  className="btn btn-primary"
                  style={{ justifyContent: "flex-start", padding: "10px 14px" }}
                  onClick={handleRegenerate}
                >
                  <SparkleIcon /> {t("重新生成视频")}
                </button>
                <button
                  className="btn"
                  style={{ justifyContent: "flex-start", padding: "10px 14px" }}
                  onClick={handleDownload}
                  disabled={!videoUrl}
                >
                  <UploadIcon style={{ transform: "rotate(180deg)" }} /> {t("下载原视频")}
                </button>
              </div>
            </div>

            <div className="vm-section">
              <div
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <span
                  className="dim-2 mono"
                  style={{ fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase" }}
                >
                  {t("提示词")}
                </span>
                <button className="btn-ghost btn-sm" onClick={copyPrompt} style={{ padding: "2px 8px" }}>
                  <CopyIcon /> {copied ? t("已复制") : t("复制")}
                </button>
              </div>
              <textarea
                id="vm-prompt-textarea"
                readOnly
                value={promptText}
                style={{
                  width: "100%",
                  minHeight: 220,
                  resize: "vertical",
                  padding: 12,
                  fontSize: 12,
                  lineHeight: 1.6,
                  fontFamily: "var(--font-mono), monospace",
                  background: "var(--surface-2)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  outline: "none",
                  whiteSpace: "pre-wrap",
                  boxSizing: "border-box",
                }}
              />
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
