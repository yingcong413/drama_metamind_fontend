import { CloseIcon } from "@/components/icons";
import { Placeholder } from "@/components/primitives/Placeholder";
import { Upload } from "@/components/primitives/Upload";
import type { GlobalLayer } from "@/types";

interface Props {
  value: GlobalLayer;
  set: (g: GlobalLayer) => void;
}

export function FScene({ value, set }: Props) {
  const img = value.scene_images?.[0] ?? null;

  if (!img) {
    return <Upload label="上传场景参考图 · 如果是多视角场景，请把多个视角拼成一张图片再上传" />;
  }

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: 12,
        background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8,
      }}
    >
      <div className="thumb" style={{ width: 110, flexShrink: 0, aspectRatio: "4/3" }}>
        <Placeholder label={img} />
      </div>
      <div
        style={{
          flex: 1, minWidth: 0, fontSize: 13,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
      >
        {img}
      </div>
      <button className="btn-ghost btn-sm">替换</button>
      <button
        className="btn-ghost btn-sm"
        onClick={() => set({ ...value, scene_images: [], scene_selected: null })}
      >
        <CloseIcon />
      </button>
    </div>
  );
}
