import { useState } from "react";
import { BookIcon } from "@/components/icons";
import type { GlobalLayer } from "@/types";

interface Props {
  value: GlobalLayer;
  set: (g: GlobalLayer) => void;
}

export function FStory({ value, set }: Props) {
  const len = (value.story || "").length;
  const [showEx, setShowEx] = useState(false);
  return (
    <div>
      <textarea
        className="textarea textarea-lg"
        placeholder="一段连贯的故事，将作为整支视频的叙事骨架……"
        value={value.story}
        onChange={(e) => set({ ...value, story: e.target.value })}
      />
      <div
        style={{
          display: "flex", justifyContent: "space-between",
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
          {len} / 50–200 字
          {len < 50 ? " · 偏短" : len > 200 ? " · 偏长" : " · 合适"}
        </span>
      </div>
      {showEx && (
        <div className="field-example" style={{ marginTop: 10 }}>
          <span className="ex-label">示例 1</span>男主在地铁站偶遇前女友，她身边站着新的男友。三人擦肩而过，他没有回头，但脚步停了一下。
          <br /><br />
          <span className="ex-label">示例 2</span>女主第一天到新公司，午休时独自坐在天台。同事递来一杯热咖啡，没有说话便离开。她抬头望向天，第一次笑了。
        </div>
      )}
    </div>
  );
}
