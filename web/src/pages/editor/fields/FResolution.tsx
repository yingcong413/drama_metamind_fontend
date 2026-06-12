import type { GlobalLayer, VideoResolution } from "@/types";

interface Props {
  value: GlobalLayer;
  set: (g: GlobalLayer) => void;
}

// 与任务表 GenerationTask.resolution 一致。
const RESOLUTIONS: { id: VideoResolution; cn: string }[] = [
  { id: "480p",  cn: "480p" },
  { id: "720p",  cn: "720p" },
  { id: "1080p", cn: "1080p" },
  { id: "4k",    cn: "4K" },
];

export function FResolution({ value, set }: Props) {
  // null 视作默认 720p
  const cur = value.resolution ?? "720p";
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {RESOLUTIONS.map((r) => (
        <button
          key={r.id}
          className={`chip ${cur === r.id ? "selected global" : ""}`}
          onClick={() => set({ ...value, resolution: r.id })}
          style={{ padding: "8px 18px", fontSize: 13 }}
        >
          {r.cn}
        </button>
      ))}
    </div>
  );
}
