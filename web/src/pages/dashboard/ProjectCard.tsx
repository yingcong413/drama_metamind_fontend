import { useNavigate } from "react-router-dom";
import { CheckIcon } from "@/components/icons";
import { formatRelative, formatDuration } from "@/lib/format";
import type { ProjectListItem } from "@/types";

interface Props {
  project: ProjectListItem;
}

export function ProjectCard({ project: p }: Props) {
  const navigate = useNavigate();
  const onOpen = () => navigate(`/projects/${p.id}/edit`);

  return (
    <div className="proj-card" onClick={onOpen}>
      <div
        className="proj-cover"
        style={{
          background: `linear-gradient(135deg, oklch(35% .10 ${p.hue}), oklch(20% .08 ${(p.hue + 30) % 360}))`,
        }}
      >
        <span className="badge mono">{p.shot_count} 分镜</span>
        <span className={`status ${p.status}`}>
          {p.status === "done" && (
            <>
              <CheckIcon /> 已生成
            </>
          )}
          {p.status === "draft" && <>草稿</>}
          {p.status === "gen" && (
            <>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 50,
                  background: "currentColor",
                  animation: "pulse 1.2s infinite",
                }}
              />{" "}
              生成中
            </>
          )}
        </span>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            color: "rgba(255,255,255,.5)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: ".1em",
          }}
        >
          COVER · {p.id.toUpperCase()}
        </div>
      </div>
      <div className="proj-meta">
        <div className="name">{p.name}</div>
        <div className="row">
          <span>{formatDuration(p.duration_seconds)}</span>
          <span>{formatRelative(p.updated_at)}</span>
        </div>
      </div>
    </div>
  );
}
