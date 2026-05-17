import { UploadIcon } from "@/components/icons";

interface Props {
  label?: string;
  kind?: "image" | "audio";
}

export function Upload({ label = "拖拽或点击上传", kind = "image" }: Props) {
  return (
    <div className="upload">
      <div className="upload-icon">
        <UploadIcon />
      </div>
      <div>{label}</div>
      <div className="dim-2" style={{ fontSize: 11 }}>
        {kind === "audio"
          ? "支持 mp3 / wav / m4a，单文件 ≤ 20MB"
          : "支持 jpg / png / webp，单文件 ≤ 8MB"}
      </div>
    </div>
  );
}
