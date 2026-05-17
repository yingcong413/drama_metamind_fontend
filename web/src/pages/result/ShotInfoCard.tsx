import type { Shot } from "@/types";

interface Props {
  shot: Shot | undefined;
}

export function ShotInfoCard({ shot }: Props) {
  const actionText = [shot?.action?.start, shot?.action?.mid, shot?.action?.end]
    .filter(Boolean)
    .join(" → ");
  return (
    <div className="card" style={{ padding: 20 }}>
      <h4
        style={{
          margin: "0 0 8px",
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: ".08em",
          color: "var(--text-tertiary)",
        }}
      >
        当前分镜信息
      </h4>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
        {shot?.name ?? "—"}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>
        {actionText || "—"}
      </div>
    </div>
  );
}
