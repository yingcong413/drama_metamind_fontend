import { PlusIcon } from "@/components/icons";
import { filledShotCount } from "@/lib/validators";
import type { Project } from "@/types";

interface Props {
  project: Project;
  activeShot: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

export function ShotTimeline({ project, activeShot, onSelect, onAdd }: Props) {
  const totalDur = (0.6 + project.shots.length * 0.2 + 1.4).toFixed(1);
  return (
    <div className="timeline-bar">
      <div className="dim-2 mono" style={{ fontSize: 11, padding: "0 8px", whiteSpace: "nowrap" }}>
        分镜时间轴
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
              分镜 {String(i + 1).padStart(2, "0")}
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
              {s.name}
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--text-secondary)",
                fontSize: 10,
                fontWeight: 500,
              }}
            >
              {filledShotCount(s)}/8 · {(0.6 + i * 0.2).toFixed(1)}s
            </div>
          </div>
        );
      })}
      <button className="timeline-add" onClick={onAdd} title="添加分镜">
        <PlusIcon />
      </button>
      <div style={{ flex: 1 }} />
      <div className="dim-2 mono" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
        总时长 ≈ {totalDur}s
      </div>
    </div>
  );
}
