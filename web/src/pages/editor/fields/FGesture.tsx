import type { Shot } from "@/types";

interface Props {
  value: Shot;
  set: (s: Shot) => void;
}

export function FGesture({ value, set }: Props) {
  return (
    <input
      className="input"
      style={{ padding: "10px 14px", fontSize: 14 }}
      placeholder="如：摸头、眨眼、捏手指、轻叹气、用手指摩挲杯沿"
      value={value.gesture ?? ""}
      onChange={(e) => set({ ...value, gesture: e.target.value })}
    />
  );
}
