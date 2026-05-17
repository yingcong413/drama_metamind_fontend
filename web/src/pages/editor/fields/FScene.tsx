import { CloseIcon } from "@/components/icons";
import { Placeholder } from "@/components/primitives/Placeholder";
import { Upload } from "@/components/primitives/Upload";
import type { GlobalLayer } from "@/types";

const PRESET_SCENES = [
  "咖啡厅 · 室内", "街道 · 雨夜", "办公室 · 日常", "卧室 · 夜晚",
  "便利店 · 凌晨", "学校走廊", "天台 · 黄昏", "餐厅包厢",
];

interface Props {
  value: GlobalLayer;
  set: (g: GlobalLayer) => void;
}

export function FScene({ value, set }: Props) {
  const uploaded = value.scene_images ?? [];
  const removeAt = (i: number) => {
    const next = uploaded.filter((_, idx) => idx !== i);
    set({
      ...value,
      scene_images: next,
      scene_selected: value.scene_selected != null && value.scene_selected >= next.length ? null : value.scene_selected,
    });
  };
  return (
    <div>
      <Upload label="上传场景参考图（可多张）" />
      {uploaded.length > 0 && (
        <>
          <div
            className="dim-2"
            style={{
              fontSize: 11, marginTop: 16, marginBottom: 8,
              fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: ".05em",
            }}
          >
            已上传 · {uploaded.length} 张
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {uploaded.map((s, i) => (
              <div
                key={i}
                className={`thumb ${value.scene_selected === i ? "selected" : ""}`}
                onClick={() => set({ ...value, scene_selected: i })}
              >
                <Placeholder label={s} />
                <div
                  className="x"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAt(i);
                  }}
                >
                  <CloseIcon />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      <div
        className="dim-2"
        style={{
          fontSize: 11, marginTop: 20, marginBottom: 8,
          fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: ".05em",
        }}
      >
        预设场景库
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {PRESET_SCENES.map((s) => (
          <div key={s} className="thumb" style={{ aspectRatio: "5/4" }}>
            <Placeholder label={s} />
          </div>
        ))}
      </div>
    </div>
  );
}
