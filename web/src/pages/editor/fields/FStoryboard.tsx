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

const isDataUrl = (s: string | null | undefined): boolean => !!s && s.startsWith("data:");

export function FStoryboard({ value, set }: Props) {
  const tr = useT();
  const url = value.storyboard_image_url ?? null;
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
      const { url: tosUrl } = await uploadGlobalImage(file, { prefix: "global_storyboard" });
      setFileName(file.name);
      set({ ...value, storyboard_image_url: tosUrl });
    } catch (e) {
      console.error("上传分镜头脚本图失败", e);
      alert(t("上传分镜头脚本图失败:") + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPending(false);
    }
  };

  if (!url) {
    return (
      <Upload
        label={
          pending
            ? tr("正在上传到 TOS…")
            : tr("上传分镜头脚本图 · 只需一张，也可在右侧用大模型生成后导入")
        }
        onSelect={applyFile}
      />
    );
  }

  const displayName = isDataUrl(url)
    ? fileName || tr("分镜头脚本图")
    : filenameFromUrl(url);
  const canRender = isLoadableUrl(url) && !imgBroken;

  return (
    <div
      style={{
        display: "flex", flexDirection: "column", gap: 10,
        padding: 12,
        background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8,
      }}
    >
      <div
        style={{
          width: "100%",
          maxHeight: 380,
          minHeight: 120,
          display: "grid",
          placeItems: "center",
          background: "#0b0d12",
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        {canRender ? (
          <ZoomableImage
            src={url}
            alt={displayName}
            onError={() => setImgBroken(true)}
            style={{ maxWidth: "100%", maxHeight: 380, objectFit: "contain", display: "block" }}
          />
        ) : (
          <Placeholder label={displayName || url || ""} />
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            flex: 1, minWidth: 0, fontSize: 13,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
          title={displayName}
        >
          {displayName}
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
        <button className="btn-ghost btn-sm" onClick={() => replaceRef.current?.click()} disabled={pending}>
          {pending ? tr("上传中…") : tr("替换")}
        </button>
        <button
          className="btn-ghost btn-sm"
          onClick={() => {
            setFileName(null);
            set({ ...value, storyboard_image_url: null });
          }}
          title={tr("移除")}
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}
