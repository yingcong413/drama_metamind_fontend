import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { SaveIcon, SparkleIcon } from "@/components/icons";
import { getProject } from "@/api/projects";
import { listCharacters } from "@/api/characters";
import { computeValidation } from "@/lib/validators";
import type { GlobalLayer, OutputLayer, Project, Shot } from "@/types";
import { EditorNav } from "./EditorNav";
import { ShotTimeline } from "./ShotTimeline";
import { GlobalLayerView } from "./GlobalLayerView";
import { ShotView } from "./ShotView";

type ActiveKey = "global" | `shot:${string}`;

const newShot = (): Shot => ({
  id: "s_" + Date.now().toString(36),
  name: "新分镜",
  order: 0,
  cast_ids: [],
  action: { start: "", mid: "", end: "" },
  micro: { eyes: "", look: "", emotion: "" },
  gesture: "",
  camera: [],
  lines: null,
  mono: null,
  narration: null,
  sfx: "",
});

export function EditorPage() {
  const navigate = useNavigate();
  const { id = "p1" } = useParams<{ id: string }>();
  const projectId = id === "new" ? "new" : id;

  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
  });
  const charsQuery = useQuery({ queryKey: ["characters"], queryFn: listCharacters });

  const [project, setProject] = useState<Project | null>(null);
  useEffect(() => {
    if (projectQuery.data) setProject(projectQuery.data);
  }, [projectQuery.data]);

  const [activeKey, setActiveKey] = useState<ActiveKey>("global");
  const [activeShot, setActiveShot] = useState<string>("");
  const [scrollAnchor, setScrollAnchor] = useState<string | null>(null);
  const [globalCollapsed, setGlobalCollapsed] = useState(false);
  const [shotsCollapsed, setShotsCollapsed] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (project && !activeShot && project.shots[0]) {
      setActiveShot(project.shots[0].id);
    }
  }, [project, activeShot]);

  useEffect(() => {
    if (!mainRef.current || scrollAnchor) return;
    const sc = mainRef.current.querySelector<HTMLElement>(".main-content");
    if (sc) sc.scrollTop = 0;
  }, [activeKey, activeShot, scrollAnchor]);

  useEffect(() => {
    if (!scrollAnchor) return;
    const target = scrollAnchor;
    const doScroll = () => {
      const main = mainRef.current;
      if (!main) return;
      const sc = main.querySelector<HTMLElement>(".main-content");
      if (!sc) return;
      const el = sc.querySelector<HTMLElement>(`[data-anchor="${target}"]`);
      if (!el) return;
      const top = Math.max(0, el.offsetTop - 24);
      sc.scrollTop = top;
      sc.scrollTo({ top, behavior: "smooth" });
    };
    const t1 = setTimeout(doScroll, 30);
    const t2 = setTimeout(doScroll, 200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [scrollAnchor]);

  const selectGlobal = (anchor: string | null = null) => {
    setActiveKey("global");
    setScrollAnchor(anchor);
  };
  const selectShot = (sid: string, anchor: string | null = null) => {
    setActiveKey(`shot:${sid}`);
    setActiveShot(sid);
    setScrollAnchor(anchor);
  };

  const updateGlobal = (g: GlobalLayer) => project && setProject({ ...project, global: g });
  const updateOutput = (o: OutputLayer) => project && setProject({ ...project, output: o });
  const updateShot = (sid: string, updater: Shot | ((s: Shot) => Shot)) => {
    if (!project) return;
    setProject({
      ...project,
      shots: project.shots.map((s) =>
        s.id === sid ? (typeof updater === "function" ? updater(s) : updater) : s,
      ),
    });
  };

  const addShot = () => {
    if (!project) return;
    const next = { ...newShot(), order: project.shots.length };
    setProject({ ...project, shots: [...project.shots, next] });
    selectShot(next.id);
  };
  const duplicateShot = (sid: string) => {
    if (!project) return;
    const src = project.shots.find((s) => s.id === sid);
    if (!src) return;
    const copy: Shot = JSON.parse(JSON.stringify(src));
    copy.id = "s_" + Date.now().toString(36);
    copy.name = src.name + " · 副本";
    const idx = project.shots.findIndex((s) => s.id === sid);
    const next = [...project.shots];
    next.splice(idx + 1, 0, copy);
    setProject({ ...project, shots: next });
  };
  const deleteShot = (sid: string) => {
    if (!project) return;
    if (project.shots.length <= 1) {
      alert("至少需要保留一个分镜");
      return;
    }
    if (!confirm("删除该分镜及其全部内容？此操作不可撤销。")) return;
    const idx = project.shots.findIndex((s) => s.id === sid);
    const remaining = project.shots.filter((s) => s.id !== sid);
    setProject({ ...project, shots: remaining });
    if (activeShot === sid) {
      const next = remaining[Math.max(0, idx - 1)];
      if (next) selectShot(next.id);
      else selectGlobal();
    }
  };

  const validation = useMemo(
    () => (project ? computeValidation(project) : { missing: [], canGenerate: false }),
    [project],
  );

  if (!project || !charsQuery.data) {
    return (
      <>
        <AppTopBar crumbs={[{ label: "项目", to: "/dashboard" }, { label: "加载中…" }]} />
        <div style={{ padding: 24, color: "var(--text-tertiary)" }}>加载中…</div>
      </>
    );
  }

  const currentShot = project.shots.find((s) => s.id === activeShot) ?? project.shots[0];
  const shotIndex = project.shots.findIndex((s) => s.id === currentShot.id);
  const prevShot = shotIndex > 0 ? project.shots[shotIndex - 1] : null;

  return (
    <>
      <AppTopBar
        crumbs={[{ label: "项目", to: "/dashboard" }, { label: project.name }]}
        actions={
          <>
            <button className="btn btn-sm"><SaveIcon /> 保存</button>
            <button
              className="btn-primary btn btn-sm"
              disabled={!validation.canGenerate}
              title={!validation.canGenerate ? `缺少必填：${validation.missing.join(" / ")}` : "生成视频"}
              onClick={() => navigate(`/projects/${project.id}/result`)}
            >
              <SparkleIcon /> 生成视频
            </button>
          </>
        }
      />

      <div className="editor">
        <EditorNav
          project={project}
          activeKey={activeKey}
          activeShot={activeShot}
          scrollAnchor={scrollAnchor}
          globalCollapsed={globalCollapsed}
          shotsCollapsed={shotsCollapsed}
          toggleGlobal={() => setGlobalCollapsed((c) => !c)}
          toggleShots={() => setShotsCollapsed((c) => !c)}
          selectGlobal={selectGlobal}
          selectShot={selectShot}
          duplicateShot={duplicateShot}
          deleteShot={deleteShot}
          addShot={addShot}
        />

        <main className="main" ref={mainRef}>
          {activeKey === "global" ? (
            <GlobalLayerView
              global={project.global}
              setGlobal={updateGlobal}
              output={project.output}
              setOutput={updateOutput}
              characters={charsQuery.data}
            />
          ) : (
            <ShotView
              shot={currentShot}
              shotIndex={shotIndex}
              project={project}
              setShot={(s) => updateShot(currentShot.id, s)}
              characters={charsQuery.data}
              addShot={addShot}
              duplicateShot={() => duplicateShot(currentShot.id)}
              deleteShot={() => deleteShot(currentShot.id)}
              prevShot={prevShot}
              isFirst={shotIndex === 0}
              onJumpToField5={() => selectGlobal("g-characters")}
            />
          )}

          <ShotTimeline
            project={project}
            activeShot={currentShot.id}
            onSelect={(sid) => selectShot(sid)}
            onAdd={addShot}
          />
        </main>
      </div>
    </>
  );
}
