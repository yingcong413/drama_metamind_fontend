import { useT } from "@/lib/i18n";
import type { GlobalLayer, VideoResolution } from "@/types";

interface Props {
  value: GlobalLayer;
  set: (g: GlobalLayer) => void;
}

interface ResMeta {
  id: VideoResolution;
  cn: string;
  hint: string;
}

// 与任务表 GenerationTask.resolution 一致。
const RESOLUTIONS: ResMeta[] = [
  { id: "720p",  cn: "720p", hint: "标清 · 生成快 · 更省积分（默认）" },
  { id: "1080p", cn: "1080p", hint: "高清 · 更耗时 · 更贵" },
  { id: "4k",    cn: "4K",   hint: "超清 · 最耗时 · 最贵" },
];

export function FResolution({ value, set }: Props) {
  const t = useT();
  // null 视作默认 720p
  const cur = value.resolution ?? "720p";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {RESOLUTIONS.map((r) => {
          const active = cur === r.id;
          return (
            <button
              key={r.id}
              className={`chip ${active ? "selected global" : ""}`}
              onClick={() => set({ ...value, resolution: r.id })}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
              }}
            >
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                <span style={{ fontSize: 13, lineHeight: 1.2 }}>{r.cn}</span>
                <span className="dim-2" style={{ fontSize: 10, lineHeight: 1.4 }}>{t(r.hint)}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="dim-2" style={{ fontSize: 11, lineHeight: 1.5 }}>
        {t("默认 720p。1080p 是否真正生效取决于上游模型支持，若上游不支持会以默认分辨率出片。")}
      </div>
    </div>
  );
}
