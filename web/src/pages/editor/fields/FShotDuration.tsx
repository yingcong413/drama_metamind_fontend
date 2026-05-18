import type { Project, Shot } from "@/types";

interface Props {
  value: Shot;
  set: (s: Shot) => void;
  project: Project;
}

export function FShotDuration({ value, set, project }: Props) {
  const total = project.global.total_duration_seconds;
  const cur = value.duration_seconds;

  const othersSum = project.shots
    .filter((s) => s.id !== value.id)
    .reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0);

  const maxForThis = total != null ? Math.max(0, total - othersSum) : null;

  const autoCount =
    project.shots.filter((s) => s.id !== value.id && s.duration_seconds == null).length +
    (cur == null ? 1 : 0);

  const onChange = (raw: string) => {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) {
      set({ ...value, duration_seconds: null });
      return;
    }
    const clamped = maxForThis != null ? Math.min(n, maxForThis) : n;
    set({ ...value, duration_seconds: clamped });
  };

  if (total == null) {
    return (
      <div className="dim-2" style={{ fontSize: 12, lineHeight: 1.7 }}>
        请先在「全局场景层 · 01 视频总时长」设置整支视频的总时长，再为单个分镜分配时长。
      </div>
    );
  }

  const overBudget = cur != null && maxForThis != null && cur > maxForThis;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input
          className="input"
          type="number"
          min={1}
          max={maxForThis ?? undefined}
          step={1}
          style={{ width: 140, padding: "10px 14px", fontSize: 14 }}
          placeholder="留空 = 自动分配"
          value={cur ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="dim-2" style={{ fontSize: 12 }}>秒</span>
        {cur != null && (
          <button
            className="btn-ghost btn-sm"
            onClick={() => set({ ...value, duration_seconds: null })}
          >
            清空（改为自动分配）
          </button>
        )}
      </div>

      <div className="dim-2" style={{ fontSize: 12, lineHeight: 1.7 }}>
        视频总时长 <span className="mono" style={{ color: "var(--text)" }}>{total}s</span>
        {" · "}其他分镜已占 <span className="mono">{othersSum}s</span>
        {" · "}本分镜最多可填{" "}
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
            {" · "}另有 <span className="mono">{autoCount}</span> 个分镜未指定，将自动均摊剩余时长
          </>
        )}
      </div>

      {overBudget && (
        <div style={{ fontSize: 12, color: "oklch(72% .15 25)" }}>
          已超出可分配时长，请调小到 {maxForThis}s 以内。
        </div>
      )}
    </div>
  );
}
