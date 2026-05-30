import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "@/components/icons";
import { Placeholder } from "@/components/primitives/Placeholder";
import { Upload } from "@/components/primitives/Upload";
import { filenameFromUrl, isLoadableUrl } from "@/lib/format";
import { uploadGlobalImage } from "@/lib/uploadGlobalImage";
import type { GlobalLayer } from "@/types";

interface Props {
  value: GlobalLayer;
  set: (g: GlobalLayer) => void;
}

// 兼容旧 localStorage 里残留的 base64 数据(老用户的 mock 项目);新上传一律走 TOS
const isDataUrl = (s: string | null | undefined): boolean =>
  !!s && s.startsWith("data:");

export function FScene({ value, set }: Props) {
  const img = value.scene_image ?? null;
  const replaceRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  // 远程图加载失败时回退到 Placeholder
  const [imgBroken, setImgBroken] = useState(false);
  useEffect(() => {
    setImgBroken(false);
  }, [img]);

  const applyFile = async (file: File) => {
    setPending(true);
    try {
      // 直传 TOS,拿公网 URL(不再用 base64,避免 prompt 体积爆炸)
      const { url } = await uploadGlobalImage(file, { prefix: "global_scenes" });
      setFileName(file.name);
      set({ ...value, scene_image: url });
    } catch (e) {
      console.error("上传场景图失败", e);
      alert("上传场景图失败:" + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPending(false);
    }
  };

  if (!img) {
    return (
      <Upload
        label={pending ? "正在上传到 TOS…" : "上传场景参考图 · 如果是多视角场景，请把多个视角拼成一张图片再上传"}
        onSelect={applyFile}
      />
    );
  }

  const displayName = isDataUrl(img)
    ? (fileName ? fileName : "本地上传(老数据 · base64)")
    : filenameFromUrl(img);
  const canRender = isLoadableUrl(img) && !imgBroken;

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
        {canRender ? (
          <img
            src={img}
            alt={displayName}
            onError={() => setImgBroken(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <Placeholder label={displayName || img} />
        )}
      </div>
      <div
        style={{
          flex: 1, minWidth: 0, fontSize: 13,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
        title={isDataUrl(img) ? `${displayName} · ${Math.round(img.length / 1024)} KB` : displayName}
      >
        {displayName}
        {isDataUrl(img) && (
          <span className="dim-2 mono" style={{ marginLeft: 8, fontSize: 11 }}>
            {Math.round(img.length / 1024)} KB · base64
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
        替换
      </button>
      <button
        className="btn-ghost btn-sm"
        onClick={() => {
          setFileName(null);
          set({ ...value, scene_image: null });
        }}
      >
        <CloseIcon />
      </button>
    </div>
  );
}
