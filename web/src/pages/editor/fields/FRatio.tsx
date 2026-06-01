import { useT } from "@/lib/i18n";
import type { GlobalLayer, VideoRatio } from "@/types";

interface Props {
  value: GlobalLayer;
  set: (g: GlobalLayer) => void;
}

interface RatioMeta {
  id: VideoRatio;
  cn: string;
  // 缩略示意图的宽高比(用 css aspect-ratio 表示)
  aspect: string;
}

// Seedance 2.0 真实支持的 4 档画面比例
const RATIOS: RatioMeta[] = [
  { id: "16:9",     cn: "横屏 16:9", aspect: "16 / 9" },
  { id: "9:16",     cn: "竖屏 9:16", aspect: "9 / 16" },
  { id: "1:1",      cn: "方形 1:1",  aspect: "1 / 1"  },
  { id: "adaptive", cn: "自适应",     aspect: "4 / 3"  },
];

export function FRatio({ value, set }: Props) {
  const t = useT();
  // null 视作默认 16:9
  const cur = value.ratio ?? "16:9";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {RATIOS.map((r) => {
          const active = cur === r.id;
          return (
            <button
              key={r.id}
              className={`chip ${active ? "selected global" : ""}`}
              onClick={() => set({ ...value, ratio: r.id })}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
              }}
            >
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  width: r.id === "9:16" ? 12 : 22,
                  height: r.id === "9:16" ? 22 : r.id === "1:1" ? 18 : 14,
                  aspectRatio: r.aspect,
                  background: "transparent",
                  border: `1.5px solid ${active ? "var(--accent)" : "var(--text-secondary, #9aa)"}`,
                  borderRadius: 2,
                  flexShrink: 0,
                }}
              />
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                <span style={{ fontSize: 13, lineHeight: 1.2 }}>{t(r.cn)}</span>
                <span className="mono dim-2" style={{ fontSize: 10, lineHeight: 1.4 }}>{r.id}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="dim-2" style={{ fontSize: 11, lineHeight: 1.5 }}>
        {t("Seedance 2.0 接口仅支持以上 4 档比例,默认 16:9。竖屏(9:16)更容易触发字幕生成。")}
      </div>
    </div>
  );
}
