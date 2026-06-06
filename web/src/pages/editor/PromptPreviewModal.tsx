import { useMemo, useState } from "react";
import { CloseIcon, CopyIcon } from "@/components/icons";
import { useT, useTf } from "@/lib/i18n";
import { buildPromptText } from "@/lib/naturalLanguage";
import { useIsVerificationAccount } from "@/stores/auth";
import type { Character, Project } from "@/types";

interface Props {
  project: Project;
  characters: Character[];
  onClose: () => void;
}

export function PromptPreviewModal({ project, characters, onClose }: Props) {
  const t = useT();
  const tf = useTf();
  const canSeePrompt = useIsVerificationAccount();
  // 与生成视频弹窗共用同一份拼接逻辑(lib/naturalLanguage.ts 的 buildPromptText)
  const text = useMemo(
    () => (canSeePrompt ? buildPromptText(project, characters) : ""),
    [project, characters, canSeePrompt],
  );

  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // older browsers — fall back to select-all
      const ta = document.getElementById("prompt-preview-textarea") as HTMLTextAreaElement | null;
      if (ta) {
        ta.select();
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,.55)",
        display: "grid", placeItems: "center",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(820px, 92vw)", height: "min(680px, 86vh)",
          display: "flex", flexDirection: "column",
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
          boxShadow: "0 20px 60px rgba(0,0,0,.5)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 18px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              {tf("提示词预览 · {name}", { name: project.name })}
            </div>
            <div className="dim" style={{ fontSize: 12, marginTop: 2 }}>
              {tf("保存到后端前请检查内容是否符合预期 · 共 {n} 字", { n: text.length })}
            </div>
          </div>
          <button className="btn-ghost btn-icon" onClick={onClose} title={t("关闭")}>
            <CloseIcon />
          </button>
        </div>

        <div style={{ flex: 1, padding: 18, overflow: "hidden", display: "flex" }}>
          <textarea
            id="prompt-preview-textarea"
            readOnly
            value={text}
            style={{
              flex: 1,
              resize: "none",
              padding: 14,
              fontSize: 13,
              lineHeight: 1.65,
              fontFamily: "var(--font-mono), monospace",
              background: "var(--surface-2)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              outline: "none",
              whiteSpace: "pre-wrap",
            }}
          />
        </div>

        <div
          style={{
            display: "flex", justifyContent: "flex-end", gap: 8,
            padding: "12px 18px",
            borderTop: "1px solid var(--border)",
          }}
        >
          <button className="btn btn-sm" onClick={copy}>
            <CopyIcon /> {copied ? t("已复制") : t("复制全部")}
          </button>
          <button className="btn-primary btn btn-sm" onClick={onClose}>
            {t("关闭")}
          </button>
        </div>
      </div>
    </div>
  );
}
