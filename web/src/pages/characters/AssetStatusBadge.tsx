// AssetStatusBadge —— 素材状态徽标（五态）
// PRD-v0.7 §2.4：蓝处理中 / 绿就绪 / 红失败 + 重新上传 / 灰其它
//
// 使用：
//   <AssetStatusBadge status={asset.status} error={asset.processing_error} />
//
// 颜色基于已有 .micro-tag 风格 + 内联 style 兜底（保证暗黑/明亮主题都能看清）。

import type { AssetStatus } from "@/types";

interface Props {
  status: AssetStatus;
  /** 仅 status=failed 时显示 */
  error?: string | null;
  /** failed 时显示「重新上传」按钮的回调，没传则不显示按钮 */
  onReupload?: () => void;
  /** 紧凑模式：少 padding，给 thumbnail overlay 用 */
  compact?: boolean;
}

const STYLE_MAP: Record<AssetStatus, { bg: string; color: string; label: string }> = {
  uploading: { bg: "#E0E7FF", color: "#3730A3", label: "上传中" },
  processing: { bg: "#DBEAFE", color: "#1E40AF", label: "校验中" },
  active: { bg: "#D1FAE5", color: "#065F46", label: "已就绪" },
  failed: { bg: "#FEE2E2", color: "#991B1B", label: "失败" },
  rejected: { bg: "#FEF3C7", color: "#92400E", label: "已拒收" },
};

export function AssetStatusBadge({ status, error, onReupload, compact }: Props) {
  const s = STYLE_MAP[status];
  const isFailed = status === "failed";
  const padding = compact ? "2px 6px" : "3px 8px";
  const fontSize = compact ? 10 : 11;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          background: s.bg,
          color: s.color,
          fontSize,
          padding,
          borderRadius: 999,
          lineHeight: 1.2,
        }}
        title={isFailed && error ? `失败原因：${error}` : s.label}
      >
        {(status === "processing" || status === "uploading") && (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: s.color,
              animation: "pulse 1.4s ease-in-out infinite",
            }}
          />
        )}
        {s.label}
        {isFailed && error && <span style={{ opacity: 0.7 }}>：{trimError(error)}</span>}
      </span>
      {isFailed && onReupload && (
        <button
          type="button"
          className="btn-ghost"
          style={{
            fontSize,
            padding,
            borderRadius: 999,
            border: `1px solid ${s.color}`,
            color: s.color,
            background: "transparent",
            cursor: "pointer",
          }}
          onClick={(e) => {
            e.stopPropagation();
            onReupload();
          }}
        >
          重新上传
        </button>
      )}
    </span>
  );
}

function trimError(err: string): string {
  // 把火山/mock 的英文错误码翻译成简短中文，超长截断
  const MAP: Record<string, string> = {
    // 图像类
    face_consistency_failed: "人脸不一致",
    multi_face_detected: "图中多人",
    no_face_detected: "未识别到人脸",
    side_face: "侧脸角度过大",
    // 视频类
    video_consistency_failed: "视频帧不一致",
    // 音频类
    voice_too_short: "音频过短",
    voice_quality_low: "音质过低",
    voice_noise_detected: "噪音过多",
  };
  if (MAP[err]) return MAP[err];
  return err.length > 12 ? err.slice(0, 12) + "…" : err;
}
