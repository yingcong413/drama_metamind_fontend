import { useRef, useState } from "react";
import { CloseIcon, PlayIcon, UploadIcon } from "@/components/icons";
import { Tag } from "@/components/primitives/Tag";
import { useT } from "@/lib/i18n";
import type { OutputLayer } from "@/types";

interface Props {
  value: OutputLayer;
  set: (o: OutputLayer) => void;
}

export function FAmbientSfx({ value, set }: Props) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [audioLabel, setAudioLabel] = useState<string | null>(null);

  const pickFile = () => inputRef.current?.click();
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setAudioLabel(f.name);
    e.target.value = "";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        style={{ display: "none" }}
        onChange={onChange}
      />

      <div>
        <div
          className="dim-2"
          style={{
            fontSize: 11, marginBottom: 6,
            fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: ".06em",
          }}
        >
          {t("文字描述")}
        </div>
        <input
          className="input"
          style={{ padding: "10px 14px", fontSize: 14 }}
          placeholder={t('如："咖啡厅白噪声"、"雨声"、"街道喧嚣"、"安静书房"')}
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
          {t("上传参考音频")} <Tag kind="opt" />
        </div>
        {audioLabel ? (
          <div
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 12px",
              background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6,
            }}
          >
            <div
              style={{
                width: 24, height: 24, borderRadius: "50%",
                background: "var(--layer-output)", color: "#0B0B0E",
                display: "grid", placeItems: "center",
              }}
            >
              <PlayIcon />
            </div>
            <div style={{ flex: 1, fontSize: 12, fontFamily: "var(--font-mono)" }}>{audioLabel}</div>
            <button className="btn-ghost btn-sm" onClick={pickFile}>{t("替换")}</button>
            <button className="btn-ghost btn-sm" onClick={() => setAudioLabel(null)}>
              <CloseIcon />
            </button>
          </div>
        ) : (
          <button
            className="btn"
            style={{ justifyContent: "flex-start", padding: "10px 14px", width: "100%" }}
            onClick={pickFile}
          >
            <UploadIcon /> {t("上传或拖拽音频文件 · 支持 mp3 / wav / m4a")}
          </button>
        )}
      </div>
    </div>
  );
}
