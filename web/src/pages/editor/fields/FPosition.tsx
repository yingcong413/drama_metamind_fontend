import { Placeholder } from "@/components/primitives/Placeholder";
import { Upload } from "@/components/primitives/Upload";
import type { GlobalLayer } from "@/types";

interface Props {
  value: GlobalLayer;
  set: (g: GlobalLayer) => void;
}

export function FPosition({ value }: Props) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Upload label="上传站位参考图" />
      <div className="thumb" style={{ aspectRatio: "4/3" }}>
        <Placeholder label={value.position_image_url ?? "站位草图 v2"} />
      </div>
    </div>
  );
}
