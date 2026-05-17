import { cn } from "@/lib/cn";
import type { OutputLayer } from "@/types";

interface Props {
  value: OutputLayer;
  set: (o: OutputLayer) => void;
  k: keyof Pick<OutputLayer, "subtitle" | "music">;
  on?: string;
  off?: string;
}

export function FToggle({ value, set, k, on = "要", off = "不要" }: Props) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <div className="segmented">
        <button className={cn(!value[k] && "active")} onClick={() => set({ ...value, [k]: false })}>
          {off}（默认）
        </button>
        <button className={cn(value[k] && "active")} onClick={() => set({ ...value, [k]: true })}>
          {on}
        </button>
      </div>
    </div>
  );
}
