import type { Shot } from "@/types";

interface Props {
  value: Shot;
  set: (s: Shot) => void;
}

export function FSfx({ value, set }: Props) {
  return (
    <input
      className="input"
      style={{ padding: "10px 14px", fontSize: 14 }}
      placeholder='如："拳击落点"、"玻璃碎裂"、"书页翻动"、"戒指盒触桌的轻响"'
      value={value.sfx ?? ""}
      onChange={(e) => set({ ...value, sfx: e.target.value })}
    />
  );
}
