import { PlayIcon } from "@/components/icons";
import type { Shot } from "@/types";

interface Props {
  activeIndex: number;
  shot: Shot | undefined;
  currentSeconds: number;
  totalSeconds: number;
}

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
};

export function VideoStage({ activeIndex, shot, currentSeconds, totalSeconds }: Props) {
  const playedPct = totalSeconds > 0 ? Math.min(100, (currentSeconds / totalSeconds) * 100) : 0;
  return (
    <div className="video-stage">
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          color: "rgba(255,255,255,.3)",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          letterSpacing: ".1em",
        }}
      >
        VIDEO PREVIEW · 9:16
      </div>
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          padding: "4px 8px",
          background: "rgba(0,0,0,.5)",
          color: "white",
          borderRadius: 6,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
        }}
      >
        分镜 {String(activeIndex + 1).padStart(2, "0")} · {shot?.name ?? "—"}
      </div>
      <div className="video-controls">
        <div className="video-timeline">
          <div className="played" style={{ width: `${playedPct}%` }} />
        </div>
        <div className="row">
          <div className="play">
            <PlayIcon />
          </div>
          <span>
            {fmt(currentSeconds)} / {fmt(totalSeconds)}
          </span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 12, opacity: 0.8 }}>
            <span>1×</span>
            <span>CC</span>
            <span>HD</span>
            <span>⛶</span>
          </div>
        </div>
      </div>
    </div>
  );
}
