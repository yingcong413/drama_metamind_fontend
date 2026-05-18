import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { EditIcon, SaveIcon, SparkleIcon } from "@/components/icons";
import { getProject } from "@/api/projects";
import { VideoStage } from "./VideoStage";
import { ShotStrip } from "./ShotStrip";
import { ShotInfoCard } from "./ShotInfoCard";
import { RatingCard } from "./RatingCard";

const VERSION = "v07";
const RESOLUTION = "1080 × 1920";
const TOTAL_SECONDS = 204;
const ELAPSED_GEN_SECONDS = 138;
const CURRENT_PLAY_SECONDS = 78;

export function ResultPage() {
  const navigate = useNavigate();
  const { id = "p1" } = useParams<{ id: string }>();
  const [activeShot, setActiveShot] = useState(0);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject(id),
  });

  if (isLoading || !project) {
    return (
      <>
        <AppTopBar crumbs={[{ label: "项目", to: "/dashboard" }, { label: "加载中…" }]} />
        <div style={{ padding: 24, color: "var(--text-tertiary)" }}>加载中…</div>
      </>
    );
  }

  const fmtDuration = (s: number) =>
    `${Math.floor(s / 60)} 分 ${String(s % 60).padStart(2, "0")} 秒`;
  const characterCount = project.global.characters?.length ?? 0;
  const audioLineCount =
    project.shots.filter((s) => s.lines?.text || s.mono?.text).length +
    (project.global.narration_audio_url ? 1 : 0);

  const goEdit = () => navigate(`/projects/${project.id}/edit`);

  return (
    <>
      <AppTopBar
        crumbs={[
          { label: "项目", to: "/dashboard" },
          { label: project.name, to: `/projects/${project.id}/edit` },
          { label: `生成结果 ${VERSION}` },
        ]}
        actions={
          <>
            <button className="btn btn-sm">
              <SaveIcon /> 下载
            </button>
            <button className="btn-primary btn btn-sm" onClick={goEdit}>
              <EditIcon /> 修改后再生成
            </button>
          </>
        }
      />

      <div className="result" data-screen-label="Generation Result">
        <div className="result-main">
          <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div
                className="dim-2 mono"
                style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase" }}
              >
                {project.name} · {VERSION}
              </div>
              <h1
                style={{
                  margin: "6px 0 0",
                  fontSize: 22,
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                }}
              >
                生成完成 · {RESOLUTION} · {fmtDuration(TOTAL_SECONDS)}
              </h1>
              <div className="dim" style={{ marginTop: 4, fontSize: 13 }}>
                耗时 {fmtDuration(ELAPSED_GEN_SECONDS)} · 使用 {project.shots.length} 个分镜 ·{" "}
                {characterCount} 个角色 · {audioLineCount} 段对白音频
              </div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button className="btn">单镜重生</button>
              <button className="btn">
                <SparkleIcon /> 整片重生
              </button>
            </div>
          </div>

          <VideoStage
            activeIndex={activeShot}
            shot={project.shots[activeShot]}
            currentSeconds={CURRENT_PLAY_SECONDS}
            totalSeconds={TOTAL_SECONDS}
          />

          <ShotStrip
            shots={project.shots}
            activeIndex={activeShot}
            onSelect={setActiveShot}
          />

          <div
            style={{
              marginTop: 24,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            <ShotInfoCard shot={project.shots[activeShot]} />
            <RatingCard />
          </div>
        </div>
      </div>
    </>
  );
}
