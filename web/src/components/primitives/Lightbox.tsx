import { useEffect } from "react";
import { CloseIcon } from "@/components/icons";
import { useLightboxStore } from "@/stores/lightbox";
import { useT } from "@/lib/i18n";

// 全屏图片预览层，挂在 App 根节点。由 useLightboxStore.open(url) 触发。
export function Lightbox() {
  const t = useT();
  const src = useLightboxStore((s) => s.src);
  const alt = useLightboxStore((s) => s.alt);
  const close = useLightboxStore((s) => s.close);

  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [src, close]);

  if (!src) return null;

  return (
    <div className="lightbox-mask" onClick={close} role="dialog" aria-modal="true">
      <button className="lightbox-close" onClick={close} title={t("关闭")} aria-label={t("关闭")}>
        <CloseIcon />
      </button>
      <img
        className="lightbox-img"
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
