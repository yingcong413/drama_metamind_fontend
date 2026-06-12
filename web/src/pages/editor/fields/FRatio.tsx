import { useT } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import type { GlobalLayer, VideoRatio } from "@/types";

interface Props {
  value: GlobalLayer;
  set: (g: GlobalLayer) => void;
}

interface RatioMeta {
  id: VideoRatio;
  cn: string;
  w: number;
  h: number;
  smart?: boolean;
}

const RATIOS: RatioMeta[] = [
  { id: "adaptive", cn: "智能", w: 1, h: 1, smart: true },
  { id: "21:9", cn: "21:9", w: 21, h: 9 },
  { id: "16:9", cn: "16:9", w: 16, h: 9 },
  { id: "4:3",  cn: "4:3",  w: 4,  h: 3 },
  { id: "1:1",  cn: "1:1",  w: 1,  h: 1 },
  { id: "3:4",  cn: "3:4",  w: 3,  h: 4 },
  { id: "9:16", cn: "9:16", w: 9,  h: 16 },
];

// 把比例缩到 22×22 的方框里
function box(w: number, h: number) {
  const M = 22;
  return w >= h ? { w: M, h: Math.round((M * h) / w) } : { w: Math.round((M * w) / h), h: M };
}

export function FRatio({ value, set }: Props) {
  const t = useT();
  const cur = value.ratio ?? "16:9";
  return (
    <div className="ratio-pick">
      {RATIOS.map((r) => {
        const active = cur === r.id;
        const b = box(r.w, r.h);
        return (
          <button
            key={r.id}
            className={cn("ratio-opt", active && "active")}
            onClick={() => set({ ...value, ratio: r.id })}
          >
            <span className="ratio-ico" style={{ height: 26 }}>
              {r.smart ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 4H5a1 1 0 0 0-1 1v4M15 4h4a1 1 0 0 1 1 1v4M9 20H5a1 1 0 0 1-1-1v-4M15 20h4a1 1 0 0 0 1-1v-4" />
                </svg>
              ) : (
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    width: b.w,
                    height: b.h,
                    border: "1.7px solid currentColor",
                    borderRadius: 3,
                  }}
                />
              )}
            </span>
            <span className="ratio-lbl">{t(r.cn)}</span>
          </button>
        );
      })}
    </div>
  );
}
