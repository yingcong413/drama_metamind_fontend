import { useRef, useState } from "react";
import { CloseIcon, PlayIcon, UploadIcon } from "@/components/icons";
import { filenameFromUrl } from "@/lib/format";
import { uploadGlobalAudio } from "@/lib/uploadGlobalImage";
import type { GlobalLayer } from "@/types";

interface Props {
  value: GlobalLayer;
  set: (g: GlobalLayer) => void;
}

export function FNarrationAudio({ value, set }: Props) {
  const url = value.narration_audio_url;
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);

  const applyFile = async (file: File) => {
    setPending(true);
    try {
      // v0.9.3:浏览器侧 SigV4 直传 TOS,拿公网 URL
      // 之前是把 file.name 字符串塞进 narration_audio_url,后端 / Seedance 拿到根本加载不了
      const { url: tosUrl } = await uploadGlobalAudio(file, { prefix: "global_narrations" });
      set({ ...value, narration_audio_url: tosUrl });
    } catch (e) {
      console.error("上传旁白音频失败", e);
      alert("上传旁白音频失败:" + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPending(false);
    }
  };

  const pickFile = () => inputRef.current?.click();
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) applyFile(f);
    e.target.value = "";
  };

  if (url) {
    return (
      <div
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 12px",
          background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          style={{ display: "none" }}
          onChange={onChange}
        />
        <div
          style={{
            width: 24, height: 24, borderRadius: "50%",
            background: "var(--layer-global)", color: "#0B0B0E",
            display: "grid", placeItems: "center",
          }}
        >
          <PlayIcon />
        </div>
        <div
          title={url}
          style={{
            flex: 1, fontSize: 12, fontFamily: "var(--font-mono)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {filenameFromUrl(url, "本地上传音频") || url}
        </div>
        <span className="dim-2 mono" style={{ fontSize: 10 }}>00:00</span>
        <button className="btn-ghost btn-sm" onClick={pickFile} disabled={pending}>
          {pending ? "上传中…" : "替换"}
        </button>
        <button
          className="btn-ghost btn-sm"
          onClick={() => set({ ...value, narration_audio_url: null })}
          disabled={pending}
        >
          <CloseIcon />
        </button>
      </div>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        style={{ display: "none" }}
        onChange={onChange}
      />
      <button
        className="btn"
        style={{ justifyContent: "flex-start", padding: "10px 14px", width: "100%" }}
        onClick={pickFile}
        disabled={pending}
      >
        <UploadIcon />{" "}
        {pending ? "正在上传到 TOS…" : "上传或拖拽旁白音频 · 支持 mp3 / wav / m4a"}
      </button>
    </>
  );
}
