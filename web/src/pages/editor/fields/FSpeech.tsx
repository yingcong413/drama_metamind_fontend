import { useRef, useState } from "react";
import { CloseIcon, MicIcon, PlayIcon } from "@/components/icons";
import { Tag } from "@/components/primitives/Tag";
import { t, useT } from "@/lib/i18n";
import { uploadGlobalAudio } from "@/lib/uploadGlobalImage";
import type { Character, Shot, SpeechBlock } from "@/types";

export type SpeechKind = "lines" | "mono" | "narration";

interface Props {
  value: Shot;
  set: (s: Shot) => void;
  kind: SpeechKind;
  characters: Character[];
  bindCharacter?: boolean;
  withAudio?: boolean;
  accentVar?: string;
  shotCharOptions?: string[];
}

const PLACEHOLDERS: Record<SpeechKind, string> = {
  lines:     "如：你来了。",
  mono:      "如：已经三个月没来这家店了。",
  narration: "如：那一年的雨季，比往年都要长。",
};

export function FSpeech({
  value, set, kind, characters,
  bindCharacter = true,
  withAudio = true,
  accentVar = "--layer-shot",
  shotCharOptions,
}: Props) {
  const tr = useT();
  const v: SpeechBlock = value[kind] ?? { char_id: null, text: "", audio_url: null };
  const update = (patch: Partial<SpeechBlock>) => set({ ...value, [kind]: { ...v, ...patch } });
  const ids = shotCharOptions ?? [];
  const options = ids
    .map((id) => characters.find((c) => c.id === id))
    .filter((c): c is Character => !!c);

  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const pickFile = () => inputRef.current?.click();
  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    // v0.9.3:浏览器侧 SigV4 直传 TOS,拿公网 URL
    // 之前只存 file.name 或 blob URL,Seedance 拿到没法用
    setPending(true);
    try {
      const prefix = kind === "lines" ? "speech_lines"
        : kind === "mono" ? "speech_mono"
        : "speech_narration";
      const { url } = await uploadGlobalAudio(f, { prefix });
      update({ audio_url: url });
    } catch (err) {
      console.error("上传台词/独白/旁白音频失败", err);
      alert(t("上传音频失败:") + (err instanceof Error ? err.message : String(err)));
    } finally {
      setPending(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {bindCharacter && (
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div
            className="dim-2"
            style={{
              fontSize: 11, width: 60,
              fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: ".06em",
            }}
          >
            {tr("角色")}
          </div>
          {options.length === 0 ? (
            <div className="dim-2" style={{ fontSize: 12, flex: 1 }}>
              {tr("请先在本分镜顶部「出场角色」步骤选定角色")}
            </div>
          ) : (
            <select
              className="select"
              style={{ flex: 1, maxWidth: 240 }}
              value={v.char_id ?? ""}
              onChange={(e) => update({ char_id: e.target.value || null })}
            >
              <option value="">{tr("— 选择角色 —")}</option>
              {options.map((c) => (
                <option key={c.id} value={c.id}>{c.name}（{c.role}）</option>
              ))}
            </select>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div
          className="dim-2"
          style={{
            fontSize: 11, width: 60,
            fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: ".06em",
            paddingTop: 8,
          }}
        >
          {tr("内容")}
        </div>
        <textarea
          className="textarea"
          style={{ flex: 1, minHeight: 60 }}
          placeholder={tr(PLACEHOLDERS[kind])}
          value={v.text ?? ""}
          onChange={(e) => update({ text: e.target.value })}
        />
      </div>

      {withAudio && (
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div
          className="dim-2"
          style={{
            fontSize: 11, width: 60,
            fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: ".06em",
          }}
        >
          {tr("音频")}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          style={{ display: "none" }}
          onChange={onChange}
        />
        {v.audio_url ? (
          <div
            style={{
              flex: 1, display: "flex", alignItems: "center", gap: 10,
              padding: "8px 12px",
              background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6,
            }}
          >
            <div
              style={{
                width: 24, height: 24, borderRadius: "50%",
                background: `var(${accentVar})`, color: "#0B0B0E",
                display: "grid", placeItems: "center",
              }}
            >
              <PlayIcon />
            </div>
            <div style={{ flex: 1, fontSize: 12, fontFamily: "var(--font-mono)" }}>{v.audio_url}</div>
            <span className="dim-2 mono" style={{ fontSize: 10 }}>00:03</span>
            <button className="btn-ghost btn-sm" onClick={pickFile} disabled={pending}>
              {pending ? tr("上传中…") : tr("替换")}
            </button>
            <button
              className="btn-ghost btn-sm"
              onClick={() => update({ audio_url: null })}
              disabled={pending}
            >
              <CloseIcon />
            </button>
          </div>
        ) : (
          <button
            className="btn btn-sm"
            style={{ flex: 1, justifyContent: "flex-start", padding: "8px 12px" }}
            onClick={pickFile}
            disabled={pending}
          >
            <MicIcon />{" "}
            {pending ? tr("正在上传到 TOS…") : tr("上传或录制音频")}{" "}
            <Tag kind="audio">{tr("需音频")}</Tag>
          </button>
        )}
      </div>
      )}
    </div>
  );
}
