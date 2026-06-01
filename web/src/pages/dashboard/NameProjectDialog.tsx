// NameProjectDialog —— 「新建项目」轻量弹窗
// 设计：
//   - 输入框自动聚焦；Enter 提交；ESC 关闭
//   - 空名字 → 自动用「未命名项目」
//   - 不引入第三方 Modal 组件，复用 drawer-mask 半透明遮罩 + 内联 style

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";

interface Props {
  open: boolean;
  /** 提交后给上层的回调；返回 Promise 让按钮自动 disabled 直到 resolve */
  onSubmit: (name: string) => Promise<void> | void;
  onClose: () => void;
  pending?: boolean;
}

const FALLBACK_NAME = "未命名项目";

export function NameProjectDialog({ open, onSubmit, onClose, pending }: Props) {
  const t = useT();
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // 打开时清空 + 聚焦
  useEffect(() => {
    if (open) {
      setName("");
      // 等下一帧再 focus，确保 input 已经挂载
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, onClose]);

  if (!open) return null;

  const submit = () => {
    if (pending) return;
    const trimmed = name.trim() || FALLBACK_NAME;
    onSubmit(trimmed);
  };

  return (
    <>
      <div
        className="drawer-mask"
        onClick={pending ? undefined : onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("新建项目")}
        style={{
          position: "fixed",
          left: "50%",
          top: "30%",
          transform: "translateX(-50%)",
          width: 420,
          maxWidth: "calc(100vw - 32px)",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: 20,
          zIndex: 1000,
          boxShadow: "0 12px 36px rgba(0,0,0,0.3)",
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 6 }}>{t("新建项目")}</div>
        <div className="dim" style={{ fontSize: 12, marginBottom: 14 }}>
          {t("给项目起个名字方便以后找到。可以稍后在编辑器里改。")}
        </div>

        <input
          ref={inputRef}
          className="input input-lg"
          placeholder={t(FALLBACK_NAME)}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={pending}
          maxLength={60}
          style={{ width: "100%", boxSizing: "border-box" }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 18,
          }}
        >
          <button className="btn" onClick={onClose} disabled={pending}>
            {t("取消")}
          </button>
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={pending}
          >
            {pending ? t("创建中…") : t("创建并进入编辑")}
          </button>
        </div>
      </div>
    </>
  );
}
