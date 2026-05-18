import { ChipSelect } from "@/components/primitives/ChipSelect";
import type { GlobalLayer } from "@/types";

interface Props {
  value: GlobalLayer;
  set: (g: GlobalLayer) => void;
}

export function FStyle({ value, set }: Props) {
  return (
    <ChipSelect
      options={["2D 动画", "3D 动画", "真人实拍", "黑白", "线条风格"]}
      value={value.style?.[0] ?? null}
      onChange={(v) => set({ ...value, style: v ? [v] : [] })}
      layerClass="global"
    />
  );
}
