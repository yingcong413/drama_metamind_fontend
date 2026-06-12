import { useEffect, useMemo, useRef, useState, type CSSProperties, type SyntheticEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { CheckIcon, CloseIcon, SaveIcon, SparkleIcon } from "@/components/icons";
import { getProject, listProjects, updateProject } from "@/api/projects";
import { listCharacters } from "@/api/characters";
import { listScenes } from "@/api/scenes";
import { listProps } from "@/api/props";
import { getAccount } from "@/api/account";
import { computeValidation } from "@/lib/validators";
import { generateShots } from "@/lib/aiFill";
import { getLastProjectId, setLastProjectId, clearLastProjectId } from "@/lib/lastProject";
import { useT, useTf } from "@/lib/i18n";
import type { GlobalLayer, OutputLayer, Project, Shot } from "@/types";
import { EditorNav } from "./EditorNav";
import { ShotTimeline } from "./ShotTimeline";
import { GlobalLayerView } from "./GlobalLayerView";
import { ShotView } from "./ShotView";
import { PromptPreviewModal } from "./PromptPreviewModal";
import { GenerateRequestModal } from "./GenerateRequestModal";
import { AiPanel } from "./AiPanel";
import { FrameComposer } from "./FrameComposer";
import { WorkflowCanvas } from "./WorkflowCanvas";
import { useGenModeStore, type GenMode } from "@/stores/genMode";

type ActiveKey = "global" | `shot:${string}`;

// 工作台左上角生成模式:工作流 / 精细控制 ‖ 首尾帧 / 智能多帧(divider 隔断两组)。
const MODE_OPTS: ({ id: GenMode; label: string } | "divider")[] = [
  { id: "workflow", label: "工作流" },
  { id: "regular", label: "精细控制" },
  "divider",
  { id: "first_last", label: "首尾帧模式" },
  { id: "smart_multi", label: "智能多帧模式" },
];

const newShot = (): Shot => ({
  id: "s_" + Date.now().toString(36),
  name: "新分镜",
  description: "",
  order: 0,
  shot_size: null,
  duration_seconds: null,
  cast_ids: [],
  action: { start: "", mid: "", end: "" },
  action_strength: 65,
  micro: { eyes: "", look: "", emotion: "" },
  micro_strength: 65,
  gesture: "",
  gesture_strength: 65,
  camera: [],
  lines: null,
  mono: null,
  narration: null,
  sfx: "",
});

export function EditorPage() {
  const navigate = useNavigate();
  const t = useT();
  const tf = useTf();
  const params = useParams<{ id: string }>();
  const urlId = params.id; // 路由 /editor 时为 undefined;/projects/:id/edit 时为具体 id

  // 路径无 id(顶栏「工作台」直接进):跳到上次工作的项目;没有就跳回项目列表。
  // 用 useEffect 是因为 useNavigate 不能在渲染期间调,且这一跳只发生一次。
  useEffect(() => {
    if (urlId) return; // 已经有 id 了,不动
    const last = getLastProjectId();
    if (last) {
      navigate(`/projects/${last}/edit`, { replace: true });
      return;
    }
    // 没有 last:看看用户是否真的有项目,有就开第一个,无就回 Dashboard
    listProjects({ page_size: 1 }).then((r) => {
      const first = r.list[0]?.id;
      if (first) navigate(`/projects/${first}/edit`, { replace: true });
      else navigate("/dashboard", { replace: true });
    }).catch(() => {
      navigate("/dashboard", { replace: true });
    });
  }, [urlId, navigate]);

  // urlId 未就绪期间用临时占位避免 useQuery 立刻打死后端;后续 useEffect 会跳走
  const projectId = urlId === "new" ? "new" : urlId ?? "__pending__";

  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
    enabled: projectId !== "__pending__",
  });

  // 项目加载成功后,把当前 id 记为 lastProject(下次直接进 /editor 就回到这里)
  useEffect(() => {
    if (projectQuery.data && projectId !== "new" && projectId !== "__pending__") {
      setLastProjectId(projectQuery.data.id ?? projectId);
    }
  }, [projectQuery.data, projectId]);

  // 项目拉取失败(被删了之类) → 清掉 lastProject + 回 Dashboard 让用户重选
  useEffect(() => {
    if (projectQuery.isError && projectId !== "__pending__") {
      clearLastProjectId();
      navigate("/dashboard", { replace: true });
    }
  }, [projectQuery.isError, projectId, navigate]);
  const charsQuery = useQuery({
    queryKey: ["characters"],
    queryFn: listCharacters,
    // 角色库改完(改名/换图/desc 等)再回来时,务必拿到最新数据,
    // 否则 buildPromptText / buildSeedancePayload 算出的 JSON 跟用户期望对不上
    refetchOnMount: "always",
    staleTime: 0,
  });
  const scenesQuery = useQuery({
    queryKey: ["scenes"],
    queryFn: listScenes,
    refetchOnMount: "always",
    staleTime: 0,
  });
  const propsQuery = useQuery({
    queryKey: ["props"],
    queryFn: listProps,
    refetchOnMount: "always",
    staleTime: 0,
  });

  // 账户余额:用于「余额不足无法使用」硬付费墙提醒
  const accountQuery = useQuery({
    queryKey: ["account"],
    queryFn: getAccount,
  });
  const lowBalance = !!accountQuery.data && accountQuery.data.balance_cents <= 0;

  const [project, setProject] = useState<Project | null>(null);
  // 自动保存：basline = 最近一次「落库/加载」时的 project 快照（JSON）。
  // 用「发送出去的快照」当基线，既能判断有无未保存改动，又能避免服务端回显 updated_at 触发自存死循环。
  const savedSnapshotRef = useRef<string | null>(null);
  const latestProjectRef = useRef<Project | null>(null);
  const autosaveTimer = useRef<number | null>(null);
  useEffect(() => {
    const data = projectQuery.data;
    if (!data) return;
    // 同一项目的缓存更新(例如自动保存回写 updated_at)不要覆盖本地正在编辑的内容
    if (data.id === project?.id) return;
    // 切到了另一个项目:先把上一个项目未保存的改动兜底落库,再加载新项目
    const prev = latestProjectRef.current;
    if (prev && prev.id !== data.id && JSON.stringify(prev) !== savedSnapshotRef.current) {
      void persistProject(prev).catch(() => { /* 静默 */ });
    }
    setProject(data);
    savedSnapshotRef.current = JSON.stringify(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectQuery.data, project?.id]);

  // 生成模式(zustand 持久化):首尾帧/智能多帧 = solo(隐藏导航与 AI 面板,渲染 FrameComposer);
  // workflow = 无限画布(隐藏左导航,保留 AI 面板)。
  const genMode = useGenModeStore((s) => s.mode);
  const setGenMode = useGenModeStore((s) => s.setMode);
  const solo = genMode === "first_last" || genMode === "smart_multi";
  const isWorkflow = genMode === "workflow";

  const [activeKey, setActiveKey] = useState<ActiveKey>("global");
  const [activeShot, setActiveShot] = useState<string>("");
  const [scrollAnchor, setScrollAnchor] = useState<string | null>(null);
  const [scrollTick, setScrollTick] = useState(0);
  const [globalCollapsed, setGlobalCollapsed] = useState(false);
  const [shotsCollapsed, setShotsCollapsed] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showGenerateReq, setShowGenerateReq] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const resizerRef = useRef<HTMLDivElement>(null);
  const [aiWidth, setAiWidth] = useState<number | null>(null);
  const draggingRef = useRef(false);
  const qc = useQueryClient();

  // 拖拽分界线调整：往左拉 → 工作台变窄、AI 面板变宽；往右拉 → 反之。
  // 起拖用 JSX 的 onMouseDown/onTouchStart 绑定（分界线在项目加载完才渲染，
  // 不能在 mount 时拿 ref）；移动/松手挂在 window 上，全程跟手。
  const MIN_AI = 320, MAX_AI = 820;
  useEffect(() => {
    const onMove = (clientX: number) => {
      const el = editorRef.current;
      if (!el) return;
      const right = el.getBoundingClientRect().right;
      const w = Math.max(MIN_AI, Math.min(MAX_AI, right - clientX - 3));
      setAiWidth(w);
    };
    const mm = (e: MouseEvent) => { if (draggingRef.current) onMove(e.clientX); };
    const tm = (e: TouchEvent) => { if (draggingRef.current) onMove(e.touches[0].clientX); };
    const up = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.classList.remove("ai-resizing");
      resizerRef.current?.classList.remove("dragging");
    };
    window.addEventListener("mousemove", mm);
    window.addEventListener("touchmove", tm, { passive: false });
    window.addEventListener("mouseup", up);
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("touchmove", tm);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchend", up);
    };
  }, []);

  const startResize = (e: SyntheticEvent) => {
    draggingRef.current = true;
    document.body.classList.add("ai-resizing");
    resizerRef.current?.classList.add("dragging");
    e.preventDefault();
  };

  /**
   * 统一落库。手动「保存」与自动保存共用。
   * - 用「发送出去的快照」更新基线（不把服务端回显写回 state，避免打断用户输入 / 自存循环）
   * - 无改动直接跳过；'new' / 空 id 不写
   */
  const persistProject = async (p: Project): Promise<boolean> => {
    const snap = JSON.stringify(p);
    if (snap === savedSnapshotRef.current) return true; // 无未保存改动
    if (!p.id || p.id === "new") return false;
    const saved = await updateProject(p.id, p);
    savedSnapshotRef.current = snap;
    // 同步进 react-query 缓存,Dashboard / 重进编辑器拿到最新数据
    qc.setQueryData(["project", p.id], saved);
    qc.invalidateQueries({ queryKey: ["projects"] });
    return true;
  };

  const saveProject = async () => {
    if (!project || savingProject) return;
    setSavingProject(true);
    setSaveOk(false);
    try {
      await persistProject(project);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 1800);
    } catch (e) {
      alert(t("保存失败") + ": " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSavingProject(false);
    }
  };

  // 跟踪最新 project,供卸载时兜底落库引用
  useEffect(() => {
    latestProjectRef.current = project;
  }, [project]);

  // 自动保存:编辑后防抖 1s 落库。切页 / 刷新 / 下次进来都是最新内容,不丢。
  useEffect(() => {
    if (!project) return;
    if (JSON.stringify(project) === savedSnapshotRef.current) return; // 无改动不写
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      void persistProject(project).catch((e) => console.warn("[autosave] 自动保存失败:", e));
    }, 1000);
    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  // 卸载(切走页面)时:有未保存改动则立即兜底落库一次(防抖窗口内切走也不丢)
  useEffect(() => {
    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
      const p = latestProjectRef.current;
      if (p && JSON.stringify(p) !== savedSnapshotRef.current) {
        void persistProject(p).catch(() => { /* 静默 */ });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 开 prompt 预览 / 生成视频 modal 之前,确保 characters 是最新的
   * (避免用户刚改完角色库回来,modal 拿到老 cache 算出旧 prompt/JSON)
   */
  const [openingModal, setOpeningModal] = useState<null | "prompt" | "generate">(null);
  const ensureFreshAndOpen = async (which: "prompt" | "generate") => {
    setOpeningModal(which);
    try {
      await qc.refetchQueries({ queryKey: ["characters"] });
      if (which === "prompt") setShowPrompt(true);
      else setShowGenerateReq(true);
    } finally {
      setOpeningModal(null);
    }
  };

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
      if (!el) return false;
      // 用 rect 相对滚动容器算偏移，兼容任意嵌套(分组/行)的定位上下文
      const top = Math.max(0, el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - 16);
      sc.scrollTo({ top, behavior: "smooth" });
      return true;
    };
    // 多次重试：等待目标所在的折叠分组展开后再滚动
    const timers = [0, 60, 160, 320].map((d) => setTimeout(doScroll, d));
    return () => timers.forEach(clearTimeout);
  }, [scrollAnchor, scrollTick]);

  const selectGlobal = (anchor: string | null = null) => {
    setActiveKey("global");
    setScrollAnchor(anchor);
    setScrollTick((n) => n + 1);
  };
  const selectShot = (sid: string, anchor: string | null = null) => {
    setActiveKey(`shot:${sid}`);
    setActiveShot(sid);
    setScrollAnchor(anchor);
    setScrollTick((n) => n + 1);
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

  // 根据「故事内容」调用文字模型,自动拆解并填充多个分镜的各项内容
  // (分镜名 / 画面描述 / 景别 / 起承转动作 / 台词),而不是只把整段塞进描述。
  const autoGenerateShots = async () => {
    if (!project) return;
    const story = (project.global.story || "").trim();
    if (!story) {
      alert(t("请先填写「故事内容」，再自动生成分镜头。"));
      return;
    }
    if (
      project.shots.length > 0 &&
      !confirm(
        tf("已有 {n} 个分镜，自动生成会替换现有分镜，是否继续？", { n: project.shots.length }),
      )
    ) {
      return;
    }
    // 分镜数量:按故事句子数估,clamp 3–8(模型再据此拆)
    const segs = story.split(/[。.!！?？;；\n]+/).map((s) => s.trim()).filter(Boolean);
    const count = Math.max(3, Math.min(8, segs.length || 4));
    try {
      const shots = await generateShots(story, count);
      if (shots.length) {
        setProject((prev) => (prev ? { ...prev, shots, shot_count: shots.length } : prev));
        selectShot(shots[0].id);
      }
    } catch (e) {
      alert(t("自动生成分镜失败：") + (e instanceof Error ? e.message : String(e)));
    }
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
    // v0.9.5 分镜可选：允许删到 0 个；删空后回到全局层。
    if (!confirm(t("删除该分镜及其全部内容？此操作不可撤销。"))) return;
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
    () => (project ? computeValidation(project) : { missing: [], warnings: [], canGenerate: false }),
    [project],
  );

  if (!project || !charsQuery.data) {
    return (
      <>
        <AppTopBar crumbs={[{ label: t("项目"), to: "/dashboard" }, { label: t("加载中…") }]} />
        <div style={{ padding: 24, color: "var(--text-tertiary)" }}>{t("加载中…")}</div>
      </>
    );
  }

  // v0.9.5 分镜可选：0 分镜时 currentShot 为 null,只渲染全局层。
  const currentShot = project.shots.find((s) => s.id === activeShot) ?? project.shots[0] ?? null;
  const shotIndex = currentShot ? project.shots.findIndex((s) => s.id === currentShot.id) : -1;
  const prevShot = shotIndex > 0 ? project.shots[shotIndex - 1] : null;
  const showShotView = activeKey !== "global" && currentShot !== null;

  const modeTabs = (
    <div className="segmented mode-seg">
      {MODE_OPTS.map((m, i) =>
        m === "divider" ? (
          <span key={`d${i}`} className="mode-divider" />
        ) : (
          <button
            key={m.id}
            type="button"
            className={genMode === m.id ? "active" : undefined}
            onClick={() => setGenMode(m.id)}
          >
            {t(m.label)}
          </button>
        ),
      )}
    </div>
  );

  return (
    <>
      <AppTopBar
        crumbs={[{ label: t("项目"), to: "/dashboard" }, { label: project.name }]}
        leftExtra={modeTabs}
        hideNav={solo}
        actions={solo || isWorkflow ? undefined : (
          <>
            {/* 必填项缺失常驻提示:点击展开具体列表 */}
            {!validation.canGenerate && (
              <button
                className="btn btn-sm"
                style={{
                  background: "rgba(255,170,60,.12)",
                  border: "1px solid rgba(255,170,60,.4)",
                  color: "oklch(78% .14 70)",
                }}
                title={tf("缺 {n} 项必填，点击查看", { n: validation.missing.length })}
                onClick={() => setShowMissing(true)}
              >
                ⚠ {tf("还差 {n} 项必填", { n: validation.missing.length })}
              </button>
            )}
            {lowBalance && (
              <button
                className="btn btn-sm"
                style={{
                  background: "rgba(220,38,38,.12)",
                  border: "1px solid rgba(220,38,38,.4)",
                  color: "oklch(70% .18 25)",
                }}
                title={t("余额不足，请充值后再生成")}
                onClick={() => navigate("/account")}
              >
                ⚠ {t("余额不足")}
              </button>
            )}
            <button className="btn btn-sm" onClick={() => saveProject()} disabled={savingProject}>
              <SaveIcon /> {savingProject ? t("保存中…") : t("保存")}
            </button>
            <button
              className="btn-primary btn btn-sm"
              disabled={openingModal === "generate"}
              title={
                lowBalance
                  ? t("余额不足，请充值后再生成")
                  : validation.canGenerate
                  ? t("生成视频")
                  : `${t("还差必填")}: ${validation.missing.map((m) => t(m)).join(" / ")}`
              }
              onClick={() => {
                if (lowBalance) {
                  navigate("/account");
                  return;
                }
                if (!validation.canGenerate) {
                  setShowMissing(true);
                  return;
                }
                void ensureFreshAndOpen("generate");
              }}
            >
              <SparkleIcon /> {lowBalance ? t("余额不足，去充值") : openingModal === "generate" ? t("准备中…") : t("生成视频")}
            </button>
          </>
        )}
      />

      <div
        className={solo ? "editor solo" : isWorkflow ? "editor workflow" : "editor has-ai"}
        ref={editorRef}
        style={!solo && aiWidth ? ({ ["--ai-w"]: aiWidth + "px" } as CSSProperties) : undefined}
      >
        {!solo && !isWorkflow && (
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
        )}

        <main className="main" ref={mainRef}>
          {solo ? (
            <FrameComposer
              mode={genMode === "first_last" ? "first_last" : "smart_multi"}
              value={project.global}
              set={updateGlobal}
              onGenerate={() => navigate(`/projects/${project.id}/result`)}
            />
          ) : isWorkflow ? (
            <WorkflowCanvas
              project={project}
              characters={charsQuery.data}
              scenes={scenesQuery.data ?? []}
              props={propsQuery.data ?? []}
            />
          ) : (
          <>
          {!showShotView || !currentShot ? (
            <GlobalLayerView
              global={project.global}
              setGlobal={updateGlobal}
              output={project.output}
              setOutput={updateOutput}
              characters={charsQuery.data}
              scenes={scenesQuery.data ?? []}
              props={propsQuery.data ?? []}
              onAutoGenShots={autoGenerateShots}
              scrollAnchor={scrollAnchor}
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
            activeShot={currentShot?.id ?? ""}
            onSelect={(sid) => selectShot(sid)}
            onAdd={addShot}
          />
          </>
          )}
        </main>

        {!solo && (
          <>
            <div
              className="ai-resizer"
              ref={resizerRef}
              title={t("拖动调整 AI 面板宽度，双击恢复默认")}
              onMouseDown={startResize}
              onTouchStart={startResize}
              onDoubleClick={() => setAiWidth(null)}
            >
              <span className="grip" />
            </div>

            <AiPanel
              project={project}
              setProject={setProject}
              characters={charsQuery.data}
              scenes={scenesQuery.data ?? []}
              props={propsQuery.data ?? []}
              onCharactersChanged={() => qc.refetchQueries({ queryKey: ["characters"] })}
              onImportStoryboard={(url, opts) => {
                // 整图写入字段 07
                updateGlobal({ ...project.global, storyboard_image_url: url });
                selectGlobal("g-storyboard");
                // 整图 + 自动建分镜:按剧情让模型拆成 count 个分镜,并把第 k 格图严格配给第 k 个分镜
                if (opts?.story && opts?.count) {
                  const cells = opts.cells ?? [];
                  void generateShots(opts.story, opts.count)
                    .then((shots) => {
                      if (!shots.length) return;
                      const withImg = shots.map((s, i) =>
                        cells[i] ? { ...s, ref_image_url: cells[i] } : s,
                      );
                      setProject((prev) =>
                        prev ? { ...prev, shots: withImg, shot_count: withImg.length } : prev,
                      );
                    })
                    .catch((e) => console.warn("[storyboard] 自动建分镜失败:", e));
                }
              }}
            />
          </>
        )}
      </div>

      {showPrompt && (
        <PromptPreviewModal
          project={project}
          characters={charsQuery.data}
          onClose={() => setShowPrompt(false)}
        />
      )}

      {showGenerateReq && (
        <GenerateRequestModal
          project={project}
          characters={charsQuery.data}
          onClose={() => setShowGenerateReq(false)}
          onConfirm={() => navigate(`/projects/${project.id}/result`)}
        />
      )}

      {/* 保存成功小提示 */}
      {saveOk && (
        <div
          style={{
            position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
            padding: "10px 16px",
            background: "rgba(40,200,120,.16)",
            border: "1px solid rgba(40,200,120,.5)",
            borderRadius: 8,
            color: "oklch(78% .15 150)",
            fontSize: 13,
            display: "flex", alignItems: "center", gap: 8,
            zIndex: 1200,
            boxShadow: "0 10px 30px rgba(0,0,0,.3)",
          }}
        >
          <CheckIcon /> {t("已保存 · 项目里可以看到")}
        </div>
      )}

      {/* 缺什么必填项的可见弹窗 */}
      {showMissing && (
        <div
          onClick={() => setShowMissing(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 1100,
            background: "rgba(0,0,0,.55)",
            display: "grid", placeItems: "center",
            backdropFilter: "blur(2px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(480px, 92vw)",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
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
              <div style={{ fontSize: 15, fontWeight: 600 }}>
                {tf("还差 {n} 项必填", { n: validation.missing.length })}
              </div>
              <button className="btn-ghost btn-icon" onClick={() => setShowMissing(false)} title={t("关闭")}>
                <CloseIcon />
              </button>
            </div>
            <div style={{ padding: 18 }}>
              <div className="dim-2" style={{ fontSize: 12, marginBottom: 12 }}>
                {t("把下列内容填完之后，「生成视频」就能正常使用了:")}
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 2, fontSize: 13 }}>
                {validation.missing.map((m, i) => (
                  <li key={i}>{t(m)}</li>
                ))}
              </ul>
              {validation.warnings.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div className="dim-2" style={{ fontSize: 11, marginBottom: 6 }}>
                    {t("以下为建议补充（不影响生成，分镜为可选）:")}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9, fontSize: 12, color: "var(--text-secondary)" }}>
                    {validation.warnings.map((w, i) => (
                      <li key={i}>
                        {tf("分镜 {label} · 未填角色动作", {
                          label: w.name ? `${w.idx}「${t(w.name)}」` : w.idx,
                        })}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="dim-2" style={{ fontSize: 11, marginTop: 14, lineHeight: 1.6 }}>
                {t("提示：分镜为可选。不填分镜也能直接按全局设定整体生成；填了分镜可对每段单独控制动作 / 运镜 / 台词。")}
              </div>
            </div>
            <div
              style={{
                display: "flex", justifyContent: "flex-end", gap: 8,
                padding: "12px 18px",
                borderTop: "1px solid var(--border)",
              }}
            >
              <button className="btn btn-sm" onClick={() => setShowMissing(false)}>
                {t("知道了")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
