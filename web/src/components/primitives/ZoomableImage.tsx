import type { CSSProperties } from "react";
import { EyeIcon } from "@/components/icons";
import { useLightboxStore } from "@/stores/lightbox";
import { useT } from "@/lib/i18n";

interface ImgProps {
  src: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  onError?: () => void;
}

// 点击即放大预览的图片。用在「图片本身就是主要点击目标」的场景（库卡片缩略、抽屉缩略、站位图）。
export function ZoomableImage({ src, alt = "", className, style, onError }: ImgProps) {
  const open = useLightboxStore((s) => s.open);
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={{ cursor: "zoom-in", ...style }}
      onError={onError}
      onClick={(e) => {
        e.stopPropagation();
        open(src, alt);
      }}
    />
  );
}

// 放大预览的小角标按钮。用在「容器本身有点击行为（选择/编辑）」的卡片上，
// 避免点图与原有点击冲突：点角标 = 预览，点卡片其他区域 = 原有行为。
export function ZoomButton({ src, alt = "" }: { src: string; alt?: string }) {
  const open = useLightboxStore((s) => s.open);
  const t = useT();
  return (
    <button
      type="button"
      className="zoom-btn"
      title={t("放大预览")}
      aria-label={t("放大预览")}
      onClick={(e) => {
        e.stopPropagation();
        open(src, alt);
      }}
    >
      <EyeIcon />
    </button>
  );
}
