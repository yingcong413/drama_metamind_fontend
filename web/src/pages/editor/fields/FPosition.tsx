import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "@/components/icons";
import { Placeholder } from "@/components/primitives/Placeholder";
import { Upload } from "@/components/primitives/Upload";
import { ZoomableImage } from "@/components/primitives/ZoomableImage";
import { filenameFromUrl, isLoadableUrl } from "@/lib/format";
import { t, useT } from "@/lib/i18n";
import { uploadGlobalImage } from "@/lib/uploadGlobalImage";
import type { GlobalLayer } from "@/types";

interface Props {
  value: GlobalLayer;
  set: (g: GlobalLayer) => void;
}

// 兼容旧 localStorage 里残留的 base64 数据;新上传一律走 TOS
const isDataUrl = (s: string | null | undefined): boolean =>
  !!s && s.startsWith("data:");

export function FPosition({ value, set }: Props) {
  const tr = useT();
  const url = value.position_image_url;
  const replaceRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [imgBroken, setImgBroken] = useState(false);
  useEffect(() => {
    setImgBroken(false);
  }, [url]);

  const applyFile = async (file: File) => {
    setPending(true);
    try {
      const { url: tosUrl } = await uploadGlobalImage(file, { prefix: "global_positions" });
      setFileName(file.name);
      set({ ...value, position_image_url: tosUrl });
    } catch (e) {
      console.error("上传站位图失败", e);
      alert(t("上传站位图失败:") + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPending(false);
    }
  };

  if (!url) {
    return (
      <Upload
        label={pending ? tr("正在上传到 TOS…") : tr("上传站位参考图 · 只需上传一张")}
        onSelect={applyFile}
      />
    );
  }

  const displayName = isDataUrl(url)
    ? (fileName ? fileName : tr("本地上传(老数据 · base64)"))
    : filenameFromUrl(url);
  const canRender = isLoadableUrl(url) && !imgBroken;

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: 12,
        background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8,
      }}
    >
      <div
        className="thumb"
        style={{
          width: 110, flexShrink: 0, aspectRatio: "4/3",
          borderRadius: 6, overflow: "hidden",
        }}
      >
        {canRender && url ? (
          <ZoomableImage
            src={url}
            alt={displayName}
            onError={() => setImgBroken(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <Placeholder label={displayName || url || ""} />
        )}
      </div>
      <div
        style={{
          flex: 1, minWidth: 0, fontSize: 13,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
        title={isDataUrl(url) ? `${displayName} · ${Math.round(url.length / 1024)} KB` : displayName}
      >
        {displayName}
        {isDataUrl(url) && (
          <span className="dim-2 mono" style={{ marginLeft: 8, fontSize: 11 }}>
            {Math.round(url.length / 1024)} KB · base64
          </span>
        )}
      </div>
      <input
        ref={replaceRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) applyFile(f);
          e.target.value = "";
        }}
      />
      <button className="btn-ghost btn-sm" onClick={() => replaceRef.current?.click()}>
        {tr("替换")}
      </button>
      <button
        className="btn-ghost btn-sm"
        onClick={() => {
          setFileName(null);
          set({ ...value, position_image_url: null });
        }}
      >
        <CloseIcon />
      </button>
    </div>
  );
}
