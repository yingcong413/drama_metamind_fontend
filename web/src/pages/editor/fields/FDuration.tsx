import type { GlobalLayer } from "@/types";

interface Props {
  value: GlobalLayer;
  set: (g: GlobalLayer) => void;
}

const PRESETS = [5, 10, 15];

export function FDuration({ value, set }: Props) {
  const cur = value.total_duration_seconds;
  const isPreset = cur != null && PRESETS.includes(cur);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="chips">
        {PRESETS.map((s) => (
          <button
            key={s}
            className={`chip ${cur === s ? "selected global" : ""}`}
            onClick={() => set({ ...value, total_duration_seconds: s })}
          >
            {s} 秒
          </button>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          className="dim-2"
          style={{
            fontSize: 11,
            fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: ".06em",
          }}
        >
          自定义
        </span>
        <input
          className="input"
          type="number"
          min={1}
          step={1}
          style={{ width: 120, padding: "8px 12px", fontSize: 14 }}
          placeholder="秒"
          value={cur != null && !isPreset ? cur : ""}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            set({ ...value, total_duration_seconds: Number.isFinite(n) && n > 0 ? n : null });
          }}
        />
        <span className="dim-2" style={{ fontSize: 12 }}>秒</span>
      </div>
    </div>
  );
}
