import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, TrashIcon } from "@/components/icons";
import { useT, useTf } from "@/lib/i18n";
import { formatRelative, formatDuration } from "@/lib/format";
import { clearLastProjectIfMatch } from "@/lib/lastProject";
import { deleteProject } from "@/api/projects";
import type { ProjectListItem } from "@/types";

interface Props {
  project: ProjectListItem;
}

export function ProjectCard({ project: p }: Props) {
  const t = useT();
  const tf = useTf();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const onOpen = () => navigate(`/projects/${p.id}/edit`);

  // 删除走 react-query mutation: 成功后失效 ["projects"](触发 Dashboard 列表刷新),
  // 并清理 lastProjectId(如果指向的就是这条),避免下次进 /editor 跳到死项目。
  const del = useMutation({
    mutationFn: () => deleteProject(p.id),
    onSuccess: () => {
      clearLastProjectIfMatch(p.id);
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.removeQueries({ queryKey: ["project", p.id] });
    },
    onError: (e) => {
      alert(`${t("删除失败")}:${(e as Error).message}`);
    },
  });

  const onDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // 不要触发外层 onOpen
    setConfirming(true);
  };
  const onConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    del.mutate();
    setConfirming(false);
  };
  const onCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirming(false);
  };

  return (
    <div className="proj-card" onClick={onOpen} style={{ position: "relative" }}>
      {/* 删除按钮:卡片右上角,半透明,hover 时高亮(继承 .proj-card:hover) */}
      <button
        className="btn btn-sm"
        title={t("删除项目")}
        aria-label={t("删除项目")}
        onClick={onDeleteClick}
        disabled={del.isPending}
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          zIndex: 2,
          padding: "6px 8px",
          background: "rgba(0,0,0,.45)",
          color: "rgba(255,255,255,.85)",
          border: "1px solid rgba(255,255,255,.15)",
          backdropFilter: "blur(4px)",
          cursor: "pointer",
        }}
      >
        <TrashIcon />
      </button>

      <div
        className="proj-cover"
        style={{
          background: `linear-gradient(135deg, oklch(35% .10 ${p.hue}), oklch(20% .08 ${(p.hue + 30) % 360}))`,
        }}
      >
        <span className="badge mono">{tf("{n} 分镜", { n: p.shot_count })}</span>
        <span className={`status ${p.status}`}>
          {p.status === "done" && (
            <>
              <CheckIcon /> {t("已生成")}
            </>
          )}
          {p.status === "draft" && <>{t("草稿")}</>}
          {p.status === "gen" && (
            <>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 50,
                  background: "currentColor",
                  animation: "pulse 1.2s infinite",
                }}
              />{" "}
              {t("生成中")}
            </>
          )}
        </span>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            color: "rgba(255,255,255,.5)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: ".1em",
          }}
        >
          COVER · {p.id.toUpperCase()}
        </div>
      </div>
      <div className="proj-meta">
        <div className="name">{t(p.name)}</div>
        <div className="row">
          <span>{formatDuration(p.duration_seconds)}</span>
          <span>{formatRelative(p.updated_at)}</span>
        </div>
      </div>

      {/* 二次确认浮层:阻止 onOpen,留两个按钮 */}
      {confirming && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 3,
            background: "rgba(0,0,0,.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            padding: 16,
            borderRadius: "inherit",
            color: "var(--text)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 14, lineHeight: 1.5 }}>
            {t("确定删除项目")}<br />
            <strong>「{t(p.name)}」</strong>?
            <br />
            <span className="dim-2" style={{ fontSize: 12 }}>
              {t("该操作不可撤销")}
            </span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="btn btn-sm"
              onClick={onCancel}
              disabled={del.isPending}
            >
              {t("取消")}
            </button>
            <button
              className="btn btn-sm"
              onClick={onConfirm}
              disabled={del.isPending}
              style={{
                background: "oklch(48% .18 25)",
                color: "white",
                borderColor: "transparent",
              }}
            >
              {del.isPending ? t("删除中…") : t("确认删除")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
