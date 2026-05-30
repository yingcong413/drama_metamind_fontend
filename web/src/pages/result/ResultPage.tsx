import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { EditIcon, PlayIcon } from "@/components/icons";
import { getProject } from "@/api/projects";
import { listTasks } from "@/api/tasks";
import { loadGenerationResults } from "@/lib/generationResult";
import { formatDateTime, formatYuan } from "@/lib/format";
import { StatusBadge } from "../account/StatusBadge";
import type { TaskStatus } from "@/types";

// v0.9.6 §11：结果页按项目列出该项目「全部」生成记录（不再只显示一条）。
// 数据源优先 tasks 表（GET /tasks?project_id=&scope=mine）；拿不到真实任务时
// 回退本地结果列表（loadGenerationResults，已改为多条）。

interface Clip {
  id: string;
  video_url: string | null;
  status: TaskStatus;
  submit_time: string;
  resolution?: string;
  cost_cents?: number;
  fail_reason?: string | null;
  thumbnail?: string | null;
}

export function ResultPage() {
  const navigate = useNavigate();
  const { id = "p1" } = useParams<{ id: string }>();

  const { data: project } = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject(id),
  });

  const tasksQuery = useQuery({
    queryKey: ["tasks", "by-project", id],
    queryFn: () => listTasks({ project_id: id, scope: "mine", page_size: 50 }),
    refetchOnMount: "always",
    staleTime: 0,
  });

  // 统一成 Clip[]：真实任务优先，否则用本地多条结果兜底
  const tasks = tasksQuery.data?.list ?? [];
  let clips: Clip[];
  if (tasks.length > 0) {
    clips = tasks.map((t) => ({
      id: t.id,
      video_url: t.output_video_url,
      status: t.status,
      submit_time: t.submit_time,
      resolution: t.resolution,
      cost_cents: t.cost_cents,
      fail_reason: t.fail_reason,
      thumbnail: t.thumbnail_urls?.[0] ?? null,
    }));
  } else {
    clips = loadGenerationResults(id).map((r) => ({
      id: r.task_id,
      video_url: r.video_url,
      status: "success" as TaskStatus,
      submit_time: new Date(r.saved_at).toISOString(),
      resolution: r.resolution,
    }));
  }

  const [activeId, setActiveId] = useState<string | null>(null);
  const active = clips.find((c) => c.id === activeId) ?? clips[0] ?? null;
  const activeVideoUrl = active?.video_url ?? null;

  if (!project) {
    return (
      <>
        <AppTopBar crumbs={[{ label: "项目", to: "/dashboard" }, { label: "加载中…" }]} />
        <div style={{ padding: 24, color: "var(--text-tertiary)" }}>加载中…</div>
      </>
    );
  }

  const goEdit = () => navigate(`/projects/${project.id}/edit`);

  return (
    <>
      <AppTopBar
        crumbs={[
          { label: "项目", to: "/dashboard" },
          { label: project.name, to: `/projects/${project.id}/edit` },
          { label: "生成结果" },
        ]}
        actions={
          <button className="btn-primary btn btn-sm" onClick={goEdit}>
            <EditIcon /> 修改后再生成
          </button>
        }
      />

      <div className="result" data-screen-label="Generation Result">
        <div className="result-main" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <div className="dim-2 mono" style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase" }}>
              {project.name}
            </div>
            <h1 style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em" }}>
              生成结果 · 共 {clips.length} 次
            </h1>
            <div className="dim" style={{ marginTop: 4, fontSize: 13 }}>
              同一项目的所有生成记录都在这里，点右侧任意一条查看对应视频。
            </div>
          </div>

          {clips.length === 0 ? (
            <div
              style={{
                padding: "48px 24px", textAlign: "center",
                border: "1px dashed var(--border)", borderRadius: 12,
                color: "var(--text-tertiary)",
              }}
            >
              <div style={{ fontSize: 14, marginBottom: 8 }}>这个项目还没有生成记录</div>
              <button className="btn-primary btn btn-sm" onClick={goEdit}>
                <PlayIcon /> 去生成
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: 20, alignItems: "start" }}>
              {/* 播放区 */}
              <div
                style={{
                  background: "#000", borderRadius: 12, overflow: "hidden",
                  aspectRatio: "16 / 9", display: "grid", placeItems: "center",
                }}
              >
                {activeVideoUrl ? (
                  <video
                    key={activeVideoUrl}
                    src={activeVideoUrl}
                    controls
                    style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }}
                  />
                ) : (
                  <div style={{ color: "var(--text-tertiary)", fontSize: 13, textAlign: "center", padding: 24 }}>
                    {active?.status === "failed"
                      ? `生成失败${active.fail_reason ? "：" + active.fail_reason : ""}`
                      : active?.status === "running" || active?.status === "queued"
                        ? "生成进行中，完成后可在此播放…"
                        : "暂无可播放的视频"}
                  </div>
                )}
              </div>

              {/* 记录列表 */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 520, overflowY: "auto" }}>
                {clips.map((c) => {
                  const isActive = active?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setActiveId(c.id)}
                      style={{
                        textAlign: "left", display: "flex", gap: 10, padding: 10, borderRadius: 10,
                        border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`,
                        background: isActive ? "var(--surface-2)" : "var(--surface)",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          width: 72, height: 48, borderRadius: 6, flexShrink: 0,
                          background: "var(--surface-soft, #111)",
                          backgroundSize: "cover", backgroundPosition: "center",
                          backgroundImage: c.thumbnail ? `url(${c.thumbnail})` : undefined,
                          display: "grid", placeItems: "center",
                        }}
                      >
                        {!c.thumbnail && <PlayIcon />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <StatusBadge status={c.status} />
                          {c.resolution && (
                            <span className={`res-chip mono res-${c.resolution}`} style={{ fontSize: 10 }}>
                              {c.resolution.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="mono dim-2" style={{ fontSize: 11 }}>
                          {formatDateTime(c.submit_time)}
                        </div>
                        {typeof c.cost_cents === "number" && c.cost_cents > 0 && (
                          <div className="dim-2" style={{ fontSize: 11, marginTop: 2 }}>
                            ¥{formatYuan(c.cost_cents)}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
