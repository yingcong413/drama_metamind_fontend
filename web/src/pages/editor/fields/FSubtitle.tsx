import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n";
import type { OutputLayer } from "@/types";

interface Props {
  value: OutputLayer;
  set: (o: OutputLayer) => void;
}

export function FSubtitle({ value, set }: Props) {
  const t = useT();
  return (
    <div className="segmented" style={{ alignSelf: "flex-start" }}>
      <button className={cn(!value.subtitle && "active")} onClick={() => set({ ...value, subtitle: false })}>
        {t("不要（默认）")}
      </button>
      <button className={cn(value.subtitle && "active")} onClick={() => set({ ...value, subtitle: true })}>
        {t("要")}
      </button>
    </div>
  );
}
