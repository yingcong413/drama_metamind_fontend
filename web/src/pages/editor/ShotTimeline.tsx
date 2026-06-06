import { PlusIcon } from "@/components/icons";
import { useT, useTf } from "@/lib/i18n";
import { filledShotCount } from "@/lib/validators";
import { estimateShotSeconds } from "@/lib/shotDuration";
import type { Project } from "@/types";

interface Props {
  project: Project;
  activeShot: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

export function ShotTimeline({ project, activeShot, onSelect, onAdd }: Props) {
  const t = useT();
  const tf = useTf();
  const totalDur = (0.6 + project.shots.length * 0.2 + 1.4).toFixed(1);
  return (
    <div className="timeline-bar">
      <div className="dim-2 mono" style={{ fontSize: 11, padding: "0 8px", whiteSpace: "nowrap" }}>
        {t("分镜时间轴")}
      </div>
      {project.shots.map((s, i) => {
        const isActive = activeShot === s.id;
        return (
          <div
            key={s.id}
            onClick={() => onSelect(s.id)}
            style={{
              flexShrink: 0,
              minWidth: 140,
              padding: "10px 12px",
              borderRadius: 10,
              cursor: "pointer",
              transition: "all .12s",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              background: isActive ? "var(--accent-soft)" : "var(--surface)",
              border: `1px solid ${isActive ? "var(--accent)" : "var(--border-strong)"}`,
            }}
          >
            <span
              style={{
                alignSelf: "flex-start",
                display: "inline-block",
                padding: "3px 8px",
                borderRadius: 4,
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                lineHeight: 1.2,
                letterSpacing: ".04em",
                background: isActive ? "var(--accent)" : "var(--layer-shot-soft)",
                color: isActive ? "var(--accent-fg)" : "var(--layer-shot)",
                fontWeight: isActive ? 700 : 600,
              }}
            >
              {tf("分镜 {n}", { n: String(i + 1).padStart(2, "0") })}
            </span>
            <div
              style={{
                fontWeight: 600,
                color: "var(--text)",
                fontSize: 13,
                lineHeight: 1.3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {t(s.name)}
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--text-secondary)",
                fontSize: 10,
                fontWeight: 500,
              }}
            >
              {filledShotCount(s)}/8 · {estimateShotSeconds(s).toFixed(1)}s
            </div>
          </div>
        );
      })}
      <button className="timeline-add" onClick={onAdd} title={t("添加分镜")}>
        <PlusIcon />
      </button>
      <div style={{ flex: 1 }} />
      <div className="dim-2 mono" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
        {tf("总时长 ≈ {n}s", { n: totalDur })}
      </div>
    </div>
  );
}
