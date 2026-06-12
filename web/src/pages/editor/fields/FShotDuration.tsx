import { useRef } from "react";
import { useT, useTf } from "@/lib/i18n";
import type { Project, Shot } from "@/types";

interface Props {
  value: Shot;
  set: (s: Shot) => void;
  project: Project;
}

// 其他分镜占用段的配色(按分镜序号循环取色,与当前分镜的 accent 区分开)
const SEG_COLORS = [
  "oklch(62% .12 230)",
  "oklch(60% .12 150)",
  "oklch(62% .13 290)",
  "oklch(62% .14 25)",
  "oklch(64% .11 190)",
  "oklch(62% .12 330)",
];

export function FShotDuration({ value, set, project }: Props) {
  const t = useT();
  const tf = useTf();
  const trackRef = useRef<HTMLDivElement>(null);
  const total = project.global.total_duration_seconds;
  const cur = value.duration_seconds;

  const others = project.shots
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.id !== value.id && (s.duration_seconds ?? 0) > 0);
  const othersSum = others.reduce((acc, { s }) => acc + (s.duration_seconds ?? 0), 0);
  const maxForThis = total != null ? Math.max(0, total - othersSum) : null;

  const autoCount =
    project.shots.filter((s) => s.id !== value.id && s.duration_seconds == null).length +
    (cur == null ? 1 : 0);

  if (total == null) {
    return (
      <div className="dim-2" style={{ fontSize: 12, lineHeight: 1.7 }}>
        {t("请先在「全局场景层 · 01 视频总时长」设置整支视频的总时长，再为单个分镜分配时长。")}
      </div>
    );
  }

  const pct = (n: number) => `${Math.min(100, Math.max(0, (n / total) * 100))}%`;

  const dragTo = (clientX: number) => {
    const el = trackRef.current;
    if (!el || maxForThis == null) return;
    const r = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const n = Math.min(Math.round(ratio * total), maxForThis);
    set({ ...value, duration_seconds: n <= 0 ? null : n });
  };

  // 其他分镜的占用段:从轨道右端往左依次排列
  let rightEdge = total;
  const segs = others.map(({ s, i }) => {
    const dur = s.duration_seconds ?? 0;
    rightEdge -= dur;
    return { start: rightEdge, dur, idx: i, color: SEG_COLORS[i % SEG_COLORS.length] };
  });

  const overBudget = cur != null && maxForThis != null && cur > maxForThis;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          ref={trackRef}
          className="sdur-track"
          onPointerDown={(e) => {
            dragTo(e.clientX);
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* 合成事件无有效 pointerId */ }
          }}
          onPointerMove={(e) => {
            if (e.buttons & 1) dragTo(e.clientX);
          }}
        >
          <div className="sdur-avail" style={{ width: pct(maxForThis ?? 0) }} />
          <div className="sdur-fill" style={{ width: pct(cur ?? 0) }} />
          {segs.map((g) => (
            <div
              key={g.idx}
              className="sdur-seg"
              style={{
                left: pct(g.start),
                width: pct(g.dur),
                background: g.color,
                borderRadius: g.start + g.dur >= total ? "0 99px 99px 0" : undefined,
              }}
            >
              <span className="sdur-tip">
                {tf("分镜 {n} 已占用 {s} 秒", { n: String(g.idx + 1).padStart(2, "0"), s: g.dur })}
              </span>
            </div>
          ))}
          <div className="sdur-thumb" style={{ left: pct(cur ?? 0) }} />
        </div>
        <span className="mono" style={{ fontSize: 14, fontWeight: 600, minWidth: 52, textAlign: "right" }}>
          {cur != null ? `${cur}s` : <span className="dim-2" style={{ fontWeight: 400 }}>—</span>}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", minHeight: 26 }}>
        {cur == null ? (
          <span className="sdur-auto-badge">
            <span className="dot" />
            {t("自动分配")}
          </span>
        ) : (
          <button
            className="btn-ghost btn-sm"
            onClick={() => set({ ...value, duration_seconds: null })}
          >
            {t("清空（改为自动分配）")}
          </button>
        )}
      </div>

      <div className="dim-2" style={{ fontSize: 12, lineHeight: 1.7 }}>
        {t("视频总时长")} <span className="mono" style={{ color: "var(--text)" }}>{total}s</span>
        {" · "}{t("其他分镜已占")} <span className="mono">{othersSum}s</span>
        {" · "}{t("本分镜最多可填")}{" "}
        <span
          className="mono"
          style={{
            color: overBudget ? "oklch(72% .15 25)" : "var(--accent)",
            fontWeight: 600,
          }}
        >
          {maxForThis}s
        </span>
        {autoCount > 0 && (
          <>
            {" · "}{t("另有")} <span className="mono">{autoCount}</span> {t("个分镜未指定，将自动均摊剩余时长")}
          </>
        )}
      </div>

      {overBudget && (
        <div style={{ fontSize: 12, color: "oklch(72% .15 25)" }}>
          {tf("已超出可分配时长，请调小到 {n}s 以内。", { n: maxForThis ?? 0 })}
        </div>
      )}
    </div>
  );
}
