import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n";
import type { OutputLayer } from "@/types";

interface Props {
  value: OutputLayer;
  set: (o: OutputLayer) => void;
  k: keyof Pick<OutputLayer, "subtitle" | "music" | "generate_audio">;
  on?: string;
  off?: string;
  defaultLabel?: "off" | "on";
}

export function FToggle({ value, set, k, on = "要", off = "不要", defaultLabel = "off" }: Props) {
  const t = useT();
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <div className="segmented">
        <button className={cn(!value[k] && "active")} onClick={() => set({ ...value, [k]: false })}>
          {t(off)}{defaultLabel === "off" && t("（默认）")}
        </button>
        <button className={cn(value[k] && "active")} onClick={() => set({ ...value, [k]: true })}>
          {t(on)}{defaultLabel === "on" && t("（默认）")}
        </button>
      </div>
    </div>
  );
}
