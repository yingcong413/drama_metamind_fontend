import { useRef, type DragEvent, type ChangeEvent } from "react";
import { UploadIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";

interface Props {
  label?: string;
  kind?: "image" | "audio";
  onSelect?: (file: File) => void;
}

export function Upload({ label, kind = "image", onSelect }: Props) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const accept = kind === "audio" ? "audio/*" : "image/*";

  const handleFile = (file: File | undefined | null) => {
    if (file && onSelect) onSelect(file);
  };

  const onClick = () => inputRef.current?.click();
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0]);
    e.target.value = "";
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files?.[0]);
  };
  const onDragOver = (e: DragEvent<HTMLDivElement>) => e.preventDefault();

  return (
    <div
      className="upload"
      onClick={onClick}
      onDrop={onDrop}
      onDragOver={onDragOver}
      style={{ cursor: "pointer" }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={onChange}
        style={{ display: "none" }}
      />
      <div className="upload-icon">
        <UploadIcon />
      </div>
      <div>{label ?? t("拖拽或点击上传")}</div>
      <div className="dim-2" style={{ fontSize: 11 }}>
        {kind === "audio"
          ? t("支持 mp3 / wav / m4a，单文件 ≤ 20MB")
          : t("支持 jpg / png / webp，单文件 ≤ 8MB")}
      </div>
    </div>
  );
}
