import { CloseIcon } from "@/components/icons";
import { Placeholder } from "@/components/primitives/Placeholder";
import { Upload } from "@/components/primitives/Upload";
import type { GlobalLayer } from "@/types";

interface Props {
  value: GlobalLayer;
  set: (g: GlobalLayer) => void;
}

export function FPosition({ value, set }: Props) {
  const url = value.position_image_url;

  if (!url) {
    return <Upload label="上传站位参考图 · 只需上传一张" />;
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
        <Placeholder label={url} />
      </div>
      <div
        style={{
          flex: 1, minWidth: 0, fontSize: 13,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
      >
        {url}
      </div>
      <button className="btn-ghost btn-sm">替换</button>
      <button
        className="btn-ghost btn-sm"
        onClick={() => set({ ...value, position_image_url: null })}
      >
        <CloseIcon />
      </button>
    </div>
  );
}
