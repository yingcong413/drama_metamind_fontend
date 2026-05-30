import { useState } from "react";
import { BookIcon } from "@/components/icons";
import type { GlobalLayer } from "@/types";

interface Props {
  value: GlobalLayer;
  set: (g: GlobalLayer) => void;
}

const EXAMPLES = [
  "4K 锐利、电影感、暖色调、低对比、柔光",
  "日系胶片、低饱和、自然光、颗粒感",
  "赛博朋克冷蓝紫色调、霓虹反光、夜景",
  "纪录片质感、自然光、手持轻微晃动",
];

export function FImageQuality({ value, set }: Props) {
  const cur = value.image_quality ?? "";
  const len = cur.length;
  const [showEx, setShowEx] = useState(false);

  return (
    <div>
      <textarea
        className="textarea"
        rows={3}
        placeholder="对画质 / 光影 / 色调的额外要求(留空使用默认参数)。例如:4K 锐利、电影感、暖色调"
        value={cur}
        onChange={(e) => set({ ...value, image_quality: e.target.value })}
      />
      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginTop: 8, fontSize: 11, color: "var(--text-tertiary)",
        }}
      >
        <button
          className="btn-ghost"
          style={{ padding: "2px 0", fontSize: 12 }}
          onClick={() => setShowEx((s) => !s)}
        >
          <BookIcon /> 查看示例
        </button>
        <span className="mono">
          {len > 0 ? `${len} 字 · 已启用` : "未填 · 使用默认画质"}
        </span>
      </div>
      {showEx && (
        <div className="field-example" style={{ marginTop: 10 }}>
          {EXAMPLES.map((ex, i) => (
            <div key={i} style={{ marginBottom: i === EXAMPLES.length - 1 ? 0 : 8 }}>
              <span className="ex-label">示例 {i + 1}</span>
              <button
                className="btn-ghost"
                style={{ padding: 0, marginLeft: 4, fontSize: 12 }}
                onClick={() => set({ ...value, image_quality: ex })}
                title="点击填入"
              >
                {ex}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
