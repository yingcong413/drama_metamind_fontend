import { useTf } from "@/lib/i18n";
import type { GlobalLayer } from "@/types";

interface Props {
  value: GlobalLayer;
  set: (g: GlobalLayer) => void;
}

// 滑块允许的最小/最大秒数(用户视角)
// v0.9.5: 不再向 Seedance 的 5/8/11 三档对齐 —— 用户拖到几秒就提交几秒。
const MIN_SECONDS = 4;
const MAX_SECONDS = 15;
const DEFAULT_SECONDS = 5;

export function FDuration({ value, set }: Props) {
  const tf = useTf();
  const cur = value.total_duration_seconds ?? DEFAULT_SECONDS;
  const clamped = Math.max(MIN_SECONDS, Math.min(MAX_SECONDS, cur));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* 进度条 + 当前值 */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span
          className="dim-2 mono"
          style={{ fontSize: 12, minWidth: 22, textAlign: "right" }}
        >
          {MIN_SECONDS}s
        </span>
        <input
          type="range"
          min={MIN_SECONDS}
          max={MAX_SECONDS}
          step={1}
          value={clamped}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            set({
              ...value,
              total_duration_seconds: Number.isFinite(n) ? n : null,
            });
          }}
          style={{
            flex: 1,
            accentColor: "var(--accent)",
            cursor: "pointer",
          }}
        />
        <span className="dim-2 mono" style={{ fontSize: 12, minWidth: 28 }}>
          {MAX_SECONDS}s
        </span>
        <span
          className="mono"
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--accent)",
            minWidth: 56,
            textAlign: "right",
          }}
        >
          {tf("{n} 秒", { n: clamped })}
        </span>
      </div>
      <div className="dim-2" style={{ fontSize: 12, lineHeight: 1.5 }}>
        {tf("全片时长 {n} 秒,该数值会直接写入提示词与 Seedance 请求。", { n: clamped })}
      </div>
    </div>
  );
}
