import { UploadIcon } from "@/components/icons";
import { Tag } from "@/components/primitives/Tag";
import type { OutputLayer } from "@/types";

interface Props {
  value: OutputLayer;
  set: (o: OutputLayer) => void;
}

export function FAmbientSfx({ value, set }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div
          className="dim-2"
          style={{
            fontSize: 11, marginBottom: 6,
            fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: ".06em",
          }}
        >
          文字描述
        </div>
        <input
          className="input"
          style={{ padding: "10px 14px", fontSize: 14 }}
          placeholder='如："咖啡厅白噪声"、"雨声"、"街道喧嚣"、"安静书房"'
          value={value.ambient_sfx ?? ""}
          onChange={(e) => set({ ...value, ambient_sfx: e.target.value })}
        />
      </div>

      <div>
        <div
          className="dim-2"
          style={{
            fontSize: 11, marginBottom: 6,
            fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: ".06em",
            display: "flex", alignItems: "center", gap: 8,
          }}
        >
          上传参考音频 <Tag kind="opt" />
        </div>
        <button className="btn" style={{ justifyContent: "flex-start", padding: "10px 14px", width: "100%" }}>
          <UploadIcon /> 上传或拖拽音频文件 · 支持 mp3 / wav / m4a
        </button>
      </div>
    </div>
  );
}
