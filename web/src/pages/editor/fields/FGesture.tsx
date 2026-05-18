import { StrengthSlider } from "@/components/primitives/StrengthSlider";
import type { Shot } from "@/types";

interface Props {
  value: Shot;
  set: (s: Shot) => void;
}

export function FGesture({ value, set }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <input
        className="input"
        style={{ padding: "10px 14px", fontSize: 14 }}
        placeholder="如：摸头、眨眼、捏手指、轻叹气、用手指摩挲杯沿"
        value={value.gesture ?? ""}
        onChange={(e) => set({ ...value, gesture: e.target.value })}
      />
      <StrengthSlider
        label="小动作强度"
        value={value.gesture_strength}
        onChange={(v) => set({ ...value, gesture_strength: v })}
      />
    </div>
  );
}
