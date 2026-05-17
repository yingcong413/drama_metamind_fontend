import { cn } from "@/lib/cn";
import type { OutputLayer } from "@/types";

interface Props {
  value: OutputLayer;
  set: (o: OutputLayer) => void;
}

export function FSubtitle({ value, set }: Props) {
  return (
    <div className="segmented" style={{ alignSelf: "flex-start" }}>
      <button className={cn(!value.subtitle && "active")} onClick={() => set({ ...value, subtitle: false })}>
        不要（默认）
      </button>
      <button className={cn(value.subtitle && "active")} onClick={() => set({ ...value, subtitle: true })}>
        要
      </button>
    </div>
  );
}
