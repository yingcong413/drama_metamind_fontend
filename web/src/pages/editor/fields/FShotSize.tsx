import { SHOT_SIZES } from "@/lib/fieldDefs";
import { cn } from "@/lib/cn";
import type { Shot } from "@/types";

interface Props {
  value: Shot;
  set: (s: Shot) => void;
}

export function FShotSize({ value, set }: Props) {
  const cur = value.shot_size;
  return (
    <div className="cam-grid">
      {SHOT_SIZES.map((s) => {
        const sel = cur === s.id;
        return (
          <button
            key={s.id}
            className={cn("cam-chip", sel && "selected")}
            onClick={() => set({ ...value, shot_size: sel ? null : s.id })}
          >
            <span className="cam-chip-cn">{s.cn}</span>
            <span className="cam-chip-en">{s.en}</span>
          </button>
        );
      })}
    </div>
  );
}
