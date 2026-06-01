import { PlayIcon } from "@/components/icons";
import type { Shot } from "@/types";
import { useT, useTf } from "@/lib/i18n";

interface Props {
  activeIndex: number;
  shot: Shot | undefined;
  currentSeconds: number;
  totalSeconds: number;
  /** 真实生成的视频 URL(由 ResultPage 从 localStorage 读出来传入)。空则显示占位。 */
  videoUrl?: string | null;
}

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
};

export function VideoStage({
  activeIndex,
  shot,
  currentSeconds,
  totalSeconds,
  videoUrl,
}: Props) {
  const t = useT();
  const tf = useTf();
  const playedPct = totalSeconds > 0 ? Math.min(100, (currentSeconds / totalSeconds) * 100) : 0;

  // 有真实 URL → 用原生 <video> 渲染,带浏览器控件
  if (videoUrl) {
    return (
      <div className="video-stage" style={{ position: "relative", background: "#000" }}>
        <video
          src={videoUrl}
          controls
          playsInline
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            background: "#000",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            padding: "4px 8px",
            background: "rgba(0,0,0,.55)",
            color: "white",
            borderRadius: 6,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            pointerEvents: "none",
          }}
        >
          {tf("分镜 {n} · {name}", { n: String(activeIndex + 1).padStart(2, "0"), name: shot?.name ?? "—" })}
        </div>
      </div>
    );
  }

  // 无 URL → 保留占位 UI(还没生成,或生成失败)
  return (
    <div className="video-stage">
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          color: "rgba(255,255,255,.4)",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          letterSpacing: ".1em",
          textAlign: "center",
          padding: 24,
          lineHeight: 1.6,
        }}
      >
        <div>
          <div>VIDEO PREVIEW · 9:16</div>
          <div style={{ marginTop: 12, fontSize: 11, opacity: 0.7 }}>
            {t("该项目尚未生成或视频地址已失效")}
            <br />
            {t("回到编辑器点「生成视频」获取结果")}
          </div>
        </div>
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
        {tf("分镜 {n} · {name}", { n: String(activeIndex + 1).padStart(2, "0"), name: shot?.name ?? "—" })}
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
