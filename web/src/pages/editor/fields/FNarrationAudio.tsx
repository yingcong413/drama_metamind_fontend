import { CloseIcon, PlayIcon, UploadIcon } from "@/components/icons";
import type { GlobalLayer } from "@/types";

interface Props {
  value: GlobalLayer;
  set: (g: GlobalLayer) => void;
}

export function FNarrationAudio({ value, set }: Props) {
  const url = value.narration_audio_url;

  if (url) {
    return (
      <div
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 12px",
          background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6,
        }}
      >
        <div
          style={{
            width: 24, height: 24, borderRadius: "50%",
            background: "var(--layer-global)", color: "#0B0B0E",
            display: "grid", placeItems: "center",
          }}
        >
          <PlayIcon />
        </div>
        <div style={{ flex: 1, fontSize: 12, fontFamily: "var(--font-mono)" }}>{url}</div>
        <span className="dim-2 mono" style={{ fontSize: 10 }}>00:00</span>
        <button className="btn-ghost btn-sm">替换</button>
        <button
          className="btn-ghost btn-sm"
          onClick={() => set({ ...value, narration_audio_url: null })}
        >
          <CloseIcon />
        </button>
      </div>
    );
  }

  return (
    <button
      className="btn"
      style={{ justifyContent: "flex-start", padding: "10px 14px", width: "100%" }}
    >
      <UploadIcon /> 上传或拖拽旁白音频 · 支持 mp3 / wav / m4a
    </button>
  );
}
