import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { listTasks } from "@/api/tasks";
import { PlusIcon, CloseIcon, PlayIcon } from "@/components/icons";
import { DirectorConsole, type DirectorSave } from "./DirectorConsole";
import type { Character, Project, Prop, Scene } from "@/types";

interface Props {
  project: Project;
  characters: Character[];
  scenes: Scene[];
  props: Prop[];
}

type NodeKind = "text" | "image" | "video" | "audio" | "agent" | "script" | "director";

type GenType = "agent" | "image" | "video" | "audio" | "text";

type VideoMode = "t2v" | "i2v" | "flf" | "omni" | "edit";

interface WfGen {
  type: GenType;
  model: string;
  ratio: string;
  res: string;        // 图片 2K/3K;视频 480P/720P/1080P
  count: number;
  prompt: string;
  vmode?: VideoMode;  // 视频子模式
  dur?: number;       // 视频时长(秒)
  refs?: Record<string, string | null>; // 参考槽:slotKey → 素材 url
  // 音频(TTS)参数
  voice?: string;
  emotion?: string;
  speed?: number; tone?: number; volume?: number;
  pitch?: number; intensity?: number; timbre?: number;
  myVoices?: string[]; // 我的复刻音色
}

interface WfNode {
  id: string;
  kind: NodeKind;
  x: number;
  y: number;
  title: string;
  content: string;
  url: string | null;
  gen?: WfGen;
  generated?: boolean; // 由「剧本分镜头」生成,非用户手动新建
  director?: DirectorSave; // 导演台节点的 3D 场景存档
}

interface WfEdge {
  id: string;
  from: string;
  to: string;
}

// 各类节点的固定宽度 / 估算高度(用于连线端点与小地图)
// 所有节点统一 16:9 横屏(宽 480 × 高 270);音频/Agent 为工具节点,保持紧凑
const SIZE: Record<NodeKind, { w: number; h: number }> = {
  text:  { w: 480, h: 270 },
  image: { w: 480, h: 270 },
  video: { w: 480, h: 270 },
  audio: { w: 480, h: 270 },
  agent: { w: 480, h: 116 },
  script: { w: 600, h: 300 },
  director: { w: 480, h: 270 },
};

const KIND_LABEL: Record<NodeKind, string> = {
  text: "文本", image: "图片", video: "视频", audio: "音频", agent: "Agent", script: "剧本分镜头", director: "导演台",
};

const KIND_COLOR: Record<NodeKind, string> = {
  text: "oklch(70% .11 230)",
  image: "oklch(72% .12 70)",
  video: "oklch(68% .12 290)",
  audio: "oklch(70% .12 150)",
  agent: "oklch(70% .13 25)",
  script: "oklch(70% .13 330)",
  director: "oklch(76% .13 60)",
};

// 节点生成器(点击节点弹出的提示词面板)
const GEN_TYPE_LABEL: Record<GenType, string> = {
  agent: "Agent模式", image: "图片生成", video: "视频生成", audio: "音频生成", text: "文本生成",
};
const GEN_TYPE_GLYPH: Record<GenType, string> = { agent: "⚙", image: "▣", video: "▶", audio: "♪", text: "T" };
const GEN_MODELS: Record<GenType, string[]> = {
  agent: ["自动编排"],
  image: ["GPT-Image-2"],
  video: ["Seedance 2.0", "Seedance 2.0 Fast"],
  audio: ["Speech 2.8 HD", "Speech 2.5"],
  text: ["GPT-5.4"],
};
const GEN_BASE_COST: Record<GenType, number> = { agent: 50, image: 30, video: 120, audio: 5, text: 5 };
const GEN_RATIOS = ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "21:9"];

// 音频(TTS)选项
const AUDIO_PAUSE = ["0.3s", "0.5s", "1s", "1.5s"];
const AUDIO_TONE = ["嗯", "啊", "哦", "呃", "哈"];
const AUDIO_VOICES = ["中文男声", "中文女声", "温柔女声", "磁性男声", "少年音", "知性女声"];
const AUDIO_EMOTIONS = ["无", "高兴", "悲伤", "愤怒", "害怕", "厌恶", "惊讶", "中性", "低语"];

// 视频子模式 + 各模式的参考槽
const VMODES: { id: VideoMode; label: string }[] = [
  { id: "t2v", label: "文生视频" },
  { id: "i2v", label: "图生视频" },
  { id: "flf", label: "首尾帧" },
  { id: "omni", label: "全能参考" },
  { id: "edit", label: "视频编辑" },
];
type SlotAccept = "image" | "video" | "audio";
const VMODE_SLOTS: Record<VideoMode, { key: string; accept: SlotAccept; label: string }[]> = {
  t2v: [],
  i2v: [{ key: "image", accept: "image", label: "参考图" }],
  flf: [{ key: "first", accept: "image", label: "首帧" }, { key: "last", accept: "image", label: "尾帧" }],
  omni: [{ key: "image", accept: "image", label: "图片" }, { key: "video", accept: "video", label: "视频" }, { key: "audio", accept: "audio", label: "音频" }],
  edit: [{ key: "video", accept: "video", label: "待编辑视频" }],
};
const VIDEO_DUR = [3, 5, 10];
const VIDEO_RES = ["480P", "720P", "1080P"];

// 剧本分镜头节点本质是文本→文本,复用文本模型(GPT-5.4)
const genTypeOf = (kind: NodeKind): GenType => (kind === "agent" ? "agent" : kind === "script" || kind === "director" ? "text" : kind);
const defaultGen = (kind: NodeKind): WfGen => ({
  type: genTypeOf(kind),
  model: GEN_MODELS[genTypeOf(kind)][0],
  ratio: "16:9",
  res: kind === "video" ? "720P" : "2K",
  count: 1,
  prompt: "",
  ...(kind === "video" ? { vmode: "t2v" as VideoMode, dur: 5, refs: {} } : {}),
  ...(kind === "audio" ? { voice: "中文男声", emotion: "无", speed: 1, tone: 0, volume: 1, pitch: 0, intensity: 0, timbre: 0, myVoices: [] } : {}),
});

// 剧本分镜头:输入剧情文本 → 按规则输出一段分镜头脚本(后端接入前的本地示例转换)
function genStoryboardScript(input: string): string {
  const beats = input
    .split(/[。！？\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);
  const list = beats.length ? beats : ["(请先输入剧情文本)"];
  const SHOTS = ["中景", "近景", "全景", "特写", "中近景", "远景"];
  const MOVES = ["缓推", "横移", "固定", "跟随", "升降", "环绕"];
  return list
    .map((b, i) =>
      `【分镜 ${i + 1}】\n` +
      `画面:${b}\n` +
      `景别:${SHOTS[i % SHOTS.length]}　运镜:${MOVES[i % MOVES.length]}\n` +
      `台词/旁白:${b.slice(0, 16)}${b.length > 16 ? "…" : ""}`,
    )
    .join("\n\n");
}

const ratioBox = (ratio: string, max = 18) => {
  const [a, b] = ratio.split(":").map(Number);
  const w = a >= b ? max : (max * a) / b;
  const h = a >= b ? (max * b) / a : max;
  return { width: Math.max(7, w), height: Math.max(7, h) };
};

const uid = () => Math.random().toString(36).slice(2, 9);

function loadState(pid: string): { nodes: WfNode[]; edges: WfEdge[] } {
  try {
    const raw = localStorage.getItem(`mm-wf-${pid}`);
    if (raw) return JSON.parse(raw);
  } catch { /* 损坏即重置 */ }
  return { nodes: [], edges: [] };
}

export function WorkflowCanvas({ project, characters, scenes, props: propAssets }: Props) {
  const t = useT();
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const init = useMemo(() => loadState(project.id), [project.id]);
  const [nodes, setNodes] = useState<WfNode[]>(init.nodes);
  const [edges, setEdges] = useState<WfEdge[]>(init.edges);
  const [pan, setPan] = useState({ x: 80, y: 60 });
  const [zoom, setZoom] = useState(0.8);
  const [menu, setMenu] = useState<{ sx: number; sy: number; wx: number; wy: number } | null>(null);
  const [nodeMenu, setNodeMenu] = useState<{ id: string; sx: number; sy: number } | null>(null);
  const nodeClipboard = useRef<WfNode | null>(null);
  const [linking, setLinking] = useState<{ from: string; mx: number; my: number } | null>(null);
  const [panel, setPanel] = useState<"assets" | "history" | null>(null);
  const [assetTab, setAssetTab] = useState<"char" | "scene" | "prop">("char");
  const [histTab, setHistTab] = useState<"all" | "video" | "image">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [compMenu, setCompMenu] = useState<"type" | "model" | "size" | "count" | "pause" | "tone" | "voice" | null>(null);
  const [audioParam, setAudioParam] = useState(false);
  const [voiceTab, setVoiceTab] = useState<"sys" | "mine">("sys");
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneTab, setCloneTab] = useState<"upload" | "record">("upload");
  const [recording, setRecording] = useState(false);
  const voiceFileRef = useRef<HTMLInputElement>(null);
  const pendingVoiceNode = useRef<string | null>(null);
  const [compTall, setCompTall] = useState(false);
  const [compSent, setCompSent] = useState(false);
  // @ 提及素材:输入框键入 @ 弹出素材分类菜单(本项目 / 跨项目 / 画布,继续输入即按关键词搜索)
  const [mention, setMention] = useState<{ id: string; q: string } | null>(null);
  const [mentionCat, setMentionCat] = useState<"proj" | "cross" | "canvas" | null>(null);
  const mentionInput = useRef<HTMLTextAreaElement | null>(null);
  const sentTimer = useRef<number | null>(null);
  // 视频参考槽的素材选择器:打开的槽 key + 选中的库 tab
  const [pickSlot, setPickSlot] = useState<string | null>(null);
  const [pickTab, setPickTab] = useState<"char" | "scene" | "prop">("char");
  const refFileRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<{ id: string; key: string } | null>(null);

  // 导演台节点:打开的节点 id(全屏 3D 覆盖层)
  const [directorOpen, setDirectorOpen] = useState<string | null>(null);

  // 底部工具栏:工具(选择/抓手)、隐藏连线、全屏
  const [tool, setTool] = useState<"select" | "hand">("select");
  const [hideEdges, setHideEdges] = useState(false);
  const [isFs, setIsFs] = useState(false);

  // 撤销 / 重做:状态快照栈
  const undoRef = useRef<string[]>([]);
  const redoRef = useRef<string[]>([]);
  const [, bumpHist] = useState(0);
  const snapNow = () => JSON.stringify({ nodes, edges });
  const pushUndo = (snap: string) => {
    undoRef.current.push(snap);
    if (undoRef.current.length > 80) undoRef.current.shift();
    redoRef.current = [];
    bumpHist((v) => v + 1);
  };
  const commit = () => pushUndo(snapNow()); // 在“变更前”调用,记录旧状态
  const applySnap = (s: string) => {
    const o = JSON.parse(s) as { nodes: WfNode[]; edges: WfEdge[] };
    setNodes(o.nodes);
    setEdges(o.edges);
    setSelected(new Set());
    setLinking(null);
    setCompMenu(null);
  };
  const undo = () => {
    if (!undoRef.current.length) return;
    redoRef.current.push(snapNow());
    applySnap(undoRef.current.pop()!);
    bumpHist((v) => v + 1);
  };
  const redo = () => {
    if (!redoRef.current.length) return;
    undoRef.current.push(snapNow());
    applySnap(redoRef.current.pop()!);
    bumpHist((v) => v + 1);
  };
  const canUndo = undoRef.current.length > 0;
  const canRedo = redoRef.current.length > 0;

  const toggleFullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.();
  };
  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // 单选节点(用于生成器面板):仅当恰好选中一个时
  const solo = selected.size === 1 ? [...selected][0] : null;
  const selectOne = (id: string) => {
    setSelected(new Set([id]));
    setCompMenu(null); setCompTall(false); setCompSent(false); setPickSlot(null);
    setAudioParam(false); setCloneOpen(false); setRecording(false);
    setMention(null); setMentionCat(null);
  };
  const addMyVoice = (id: string, name: string) => {
    const cur = nodeById(id)?.gen?.myVoices ?? [];
    patchGen(id, { myVoices: [...cur, name], voice: name });
  };

  const dragRef = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const dragSnapRef = useRef<string | null>(null);
  const dragMovedRef = useRef(false);
  const panRef = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  // 框选(三指/左键在空白处拖拽):屏幕坐标(相对舞台)
  const marqueeRef = useRef<{ sx: number; sy: number } | null>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // 拖拽对齐:吸附参考线(世界坐标)+ 上一帧吸附状态(用于吸附瞬间的抖动反馈)
  const [guides, setGuides] = useState<{ v: number | null; h: number | null }>({ v: null, h: null });
  const prevSnap = useRef<{ v: number | null; h: number | null }>({ v: null, h: null });

  useEffect(() => {
    try {
      localStorage.setItem(`mm-wf-${project.id}`, JSON.stringify({ nodes, edges }));
    } catch { /* 截图/参考图过多可能超出配额,放弃本次持久化 */ }
  }, [nodes, edges, project.id]);

  const tasksQuery = useQuery({
    queryKey: ["wf-tasks"],
    queryFn: () => listTasks({ page: 1, page_size: 30 }),
    enabled: panel === "history",
  });

  // 屏幕坐标 → 世界坐标
  const toWorld = (sx: number, sy: number) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: (sx - r.left - pan.x) / zoom, y: (sy - r.top - pan.y) / zoom };
  };

  const viewCenterWorld = () => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return { x: 200, y: 200 };
    return { x: (r.width / 2 - pan.x) / zoom, y: (r.height / 2 - pan.y) / zoom };
  };

  const addNode = (kind: NodeKind, at?: { x: number; y: number }, patch?: Partial<WfNode>) => {
    commit();
    const base = at ?? viewCenterWorld();
    const count = nodes.filter((n) => n.kind === kind).length;
    const node: WfNode = {
      id: uid(),
      kind,
      x: base.x - SIZE[kind].w / 2,
      y: base.y - SIZE[kind].h / 2,
      title: `${t(KIND_LABEL[kind])} ${count + 1}`,
      content: "",
      url: null,
      ...patch,
    };
    setNodes((ns) => [...ns, node]);
    return node.id;
  };

  const removeNode = (id: string) => {
    commit();
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.from !== id && e.to !== id));
  };

  // 右键节点:复制(存内部剪贴板,可在画布粘贴)/ 克隆(就地复制一份)
  const copyNode = (id: string) => {
    const src = nodeById(id);
    if (src) nodeClipboard.current = JSON.parse(JSON.stringify(src));
  };
  const cloneNode = (id: string) => {
    const src = nodeById(id);
    if (!src) return;
    commit();
    const copy: WfNode = { ...JSON.parse(JSON.stringify(src)), id: uid(), x: src.x + 40, y: src.y + 40 };
    setNodes((ns) => [...ns, copy]);
    selectOne(copy.id);
  };

  // 剧本分镜头:把输入文本经规则生成脚本 → 在右侧新建可编辑脚本节点并自动连线
  // 命名:从用户手动节点生成 → 「原名-1 / -2…」;从生成节点再生成 → 「原名-提示词」
  const generateScriptNode = (src: WfNode) => {
    const input = src.gen?.prompt ?? "";
    if (!input.trim()) return;
    const out = genStoryboardScript(input);
    let newTitle: string;
    if (src.generated) {
      newTitle = `${src.title}-提示词`;
    } else {
      const esc = src.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`^${esc}-(\\d+)$`);
      const max = Math.max(0, ...nodes.map((n) => { const m = n.title.match(re); return m ? parseInt(m[1], 10) : 0; }));
      newTitle = `${src.title}-${max + 1}`;
    }
    commit();
    const id = uid();
    const node: WfNode = {
      id,
      kind: "script",
      x: src.x + SIZE[src.kind].w + 140,
      y: src.y,
      title: newTitle,
      content: out,
      url: null,
      gen: { ...defaultGen("script"), prompt: out },
      generated: true,
    };
    setNodes((ns) => [...ns, node]);
    const eid = `${src.id}->${id}`;
    setEdges((es) => (es.some((x) => x.id === eid) ? es : [...es, { id: eid, from: src.id, to: id }]));
    selectOne(id);
  };

  const fitView = () => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r || nodes.length === 0) return;
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const xe = nodes.map((n) => n.x + SIZE[n.kind].w);
    const ye = nodes.map((n) => n.y + SIZE[n.kind].h);
    const bx = Math.min(...xs) - 60, by = Math.min(...ys) - 60;
    const bw = Math.max(...xe) - bx + 60, bh = Math.max(...ye) - by + 60;
    const z = Math.min(r.width / bw, r.height / bh, 1.4);
    setZoom(z);
    setPan({ x: (r.width - bw * z) / 2 - bx * z, y: (r.height - bh * z) / 2 - by * z });
  };

  // ── 画布平移 / 缩放 / 框选 ──
  const onStagePointerDown = (e: RPointerEvent) => {
    const el = e.target as HTMLElement;
    if (el.closest(".wf-float") || el.closest(".wf-composer")) return;
    const r = wrapRef.current!.getBoundingClientRect();
    // 中键 或 抓手工具 → 平移画布(抓手按在节点上也平移;触控板用双指滚动)
    if (e.button === 1 || (e.button === 0 && tool === "hand")) {
      e.preventDefault();
      setMenu(null);
      panRef.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
      return;
    }
    if (el.closest(".wf-node")) return; // 选择工具:节点交给节点自身处理
    if (e.button !== 0) return;
    setMenu(null);
    setNodeMenu(null);
    setCompMenu(null);
    setPanel(null);
    if (linking) { setLinking(null); return; }
    // 左键在空白处按下 → 开始框选(macOS 三指拖拽会被系统转成左键拖拽)
    marqueeRef.current = { sx: e.clientX - r.left, sy: e.clientY - r.top };
    setMarquee({ x: marqueeRef.current.sx, y: marqueeRef.current.sy, w: 0, h: 0 });
  };

  const onStagePointerMove = (e: RPointerEvent) => {
    if (marqueeRef.current) {
      const r = wrapRef.current!.getBoundingClientRect();
      const cx = e.clientX - r.left, cy = e.clientY - r.top;
      const m = marqueeRef.current;
      setMarquee({ x: Math.min(cx, m.sx), y: Math.min(cy, m.sy), w: Math.abs(cx - m.sx), h: Math.abs(cy - m.sy) });
    } else if (panRef.current) {
      const p = panRef.current;
      setPan({ x: p.px + e.clientX - p.sx, y: p.py + e.clientY - p.sy });
    } else if (dragRef.current) {
      const d = dragRef.current;
      dragMovedRef.current = true;
      const w = toWorld(e.clientX, e.clientY);
      const me = nodes.find((n) => n.id === d.id);
      let nx = w.x - d.ox, ny = w.y - d.oy;
      let gv: number | null = null, gh: number | null = null;
      if (me) {
        const sz = SIZE[me.kind];
        const TH = 8 / zoom;
        const mxs = [0, sz.w / 2, sz.w];
        const mys = [0, sz.h / 2, sz.h];
        for (const o of nodes) {
          if (o.id === d.id) continue;
          const os = SIZE[o.kind];
          if (gv === null) {
            const oxs = [o.x, o.x + os.w / 2, o.x + os.w];
            outerX: for (const ox of oxs) for (const m of mxs) {
              if (Math.abs(nx + m - ox) < TH) { nx = ox - m; gv = ox; break outerX; }
            }
          }
          if (gh === null) {
            const oys = [o.y, o.y + os.h / 2, o.y + os.h];
            outerY: for (const oy of oys) for (const m of mys) {
              if (Math.abs(ny + m - oy) < TH) { ny = oy - m; gh = oy; break outerY; }
            }
          }
          if (gv !== null && gh !== null) break;
        }
      }
      // 吸附瞬间给节点一个轻微抖动
      if ((gv !== null && prevSnap.current.v === null) || (gh !== null && prevSnap.current.h === null)) {
        const el = wrapRef.current?.querySelector(`[data-nid="${d.id}"]`) as HTMLElement | null;
        el?.animate(
          [
            { transform: "translate(0,0)" },
            { transform: "translate(-2px,-1px)" },
            { transform: "translate(2px,1px)" },
            { transform: "translate(-1px,0)" },
            { transform: "translate(0,0)" },
          ],
          { duration: 160 },
        );
      }
      prevSnap.current = { v: gv, h: gh };
      setGuides({ v: gv, h: gh });
      setNodes((ns) => ns.map((n) => (n.id === d.id ? { ...n, x: nx, y: ny } : n)));
    } else if (linking) {
      const w = toWorld(e.clientX, e.clientY);
      setLinking({ ...linking, mx: w.x, my: w.y });
    }
  };

  const onStagePointerUp = () => {
    // 框选收尾:框够大 → 命中节点;否则视作点击空白 → 清空选择
    if (marqueeRef.current) {
      const m = marquee;
      if (m && (m.w > 4 || m.h > 4)) {
        const wx0 = (m.x - pan.x) / zoom, wy0 = (m.y - pan.y) / zoom;
        const wx1 = (m.x + m.w - pan.x) / zoom, wy1 = (m.y + m.h - pan.y) / zoom;
        const hit = new Set<string>();
        for (const n of nodes) {
          const s = SIZE[n.kind];
          if (n.x < wx1 && n.x + s.w > wx0 && n.y < wy1 && n.y + s.h > wy0) hit.add(n.id);
        }
        setSelected(hit);
        if (hit.size !== 1) { setCompMenu(null); setCompTall(false); setCompSent(false); }
      } else {
        setSelected(new Set());
      }
      marqueeRef.current = null;
      setMarquee(null);
    }
    // 节点拖拽结束:位置有变化才记一步撤销
    if (dragRef.current && dragMovedRef.current && dragSnapRef.current) {
      pushUndo(dragSnapRef.current);
    }
    dragSnapRef.current = null;
    dragMovedRef.current = false;
    panRef.current = null;
    dragRef.current = null;
    prevSnap.current = { v: null, h: null };
    setGuides((g) => (g.v !== null || g.h !== null ? { v: null, h: null } : g));
  };

  // React 的 onWheel 是 passive 监听,preventDefault 会报错;这里手动绑非 passive 的原生监听
  const wheelRef = useRef<(e: WheelEvent) => void>(() => {});
  wheelRef.current = (e: WheelEvent) => {
    // 滚轮 / 触控板双指滑动 → 只平移画布(上下/左右滚动),不缩放
    if (e.ctrlKey || e.metaKey) {
      // 触控板捏合 → 缩放(以光标为锚点,平滑)
      const r = wrapRef.current!.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const wx = (mx - pan.x) / zoom, wy = (my - pan.y) / zoom;
      const nz = Math.min(2, Math.max(0.2, zoom * Math.exp(-e.deltaY * 0.004)));
      setZoom(nz);
      setPan({ x: mx - wx * nz, y: my - wy * nz });
    } else {
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const h = (e: WheelEvent) => {
      const tg = e.target as HTMLElement;
      if (tg.closest(".wf-composer") || tg.closest(".wf-float")) return;
      e.preventDefault();
      wheelRef.current(e);
    };
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  }, []);

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const el = e.target as HTMLElement;
    if (el.closest(".wf-float") || el.closest(".wf-composer")) return;
    const r = wrapRef.current!.getBoundingClientRect();
    const nodeEl = el.closest(".wf-node") as HTMLElement | null;
    if (nodeEl) {
      // 右键节点 → 节点菜单(复制 / 克隆 / 删除)
      setMenu(null);
      setNodeMenu({ id: nodeEl.dataset.nid!, sx: e.clientX - r.left, sy: e.clientY - r.top });
      return;
    }
    const w = toWorld(e.clientX, e.clientY);
    setNodeMenu(null);
    setMenu({ sx: e.clientX - r.left, sy: e.clientY - r.top, wx: w.x, wy: w.y });
  };

  // ── 节点拖动 / 连线 ──
  const completeLink = (toId: string) => {
    if (!linking || linking.from === toId) { setLinking(null); return; }
    const id = `${linking.from}->${toId}`;
    if (!edges.some((x) => x.id === id)) {
      commit();
      setEdges((es) => [...es, { id, from: linking.from, to: toId }]);
    }
    setLinking(null);
  };

  const onNodePointerDown = (e: RPointerEvent, n: WfNode) => {
    // 抓手工具:在节点上按下也走平移(交给舞台处理,不拦截)
    if (tool === "hand") return;
    const el = e.target as HTMLElement;
    // 拉线状态下,点目标节点任意位置即确认连线(端口走 onPortClick,避免重复触发)
    if (linking) {
      if (!el.closest(".wf-port")) {
        e.stopPropagation();
        completeLink(n.id);
      }
      return;
    }
    if (!(selected.size === 1 && selected.has(n.id))) selectOne(n.id);
    // 图片/视频/文本节点:按住任意位置都能拖拽(端口和删除按钮除外);其余节点避开内部控件
    const skip = n.kind === "image" || n.kind === "video" || n.kind === "text" || n.kind === "script"
      ? ".wf-port, .wf-node-x"
      : "textarea, input, button, video, audio, .wf-port, .wf-node-x";
    if (el.closest(skip)) return;
    e.stopPropagation();
    setMenu(null);
    const w = toWorld(e.clientX, e.clientY);
    dragRef.current = { id: n.id, ox: w.x - n.x, oy: w.y - n.y };
    dragSnapRef.current = snapNow();
    dragMovedRef.current = false;
  };

  const onPortClick = (e: React.MouseEvent, n: WfNode) => {
    e.stopPropagation();
    if (!linking) {
      const w = toWorld(e.clientX, e.clientY);
      setLinking({ from: n.id, mx: w.x, my: w.y });
    } else {
      completeLink(n.id);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (directorOpen) return; // 导演台打开时,快捷键交给 3D 控制台
      if (e.key === "Escape") {
        if (mention) { setMention(null); setMentionCat(null); return; }
        setLinking(null); setMenu(null); setNodeMenu(null); setCompMenu(null); setPickSlot(null); setSelected(new Set());
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selected.size) {
        const ae = document.activeElement;
        if (ae && /TEXTAREA|INPUT/.test(ae.tagName)) return;
        const ids = selected;
        commit();
        setNodes((ns) => ns.filter((n) => !ids.has(n.id)));
        setEdges((es) => es.filter((e2) => !ids.has(e2.from) && !ids.has(e2.to)));
        setSelected(new Set());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, directorOpen, mention]);

  // ── 上传 / 粘贴 ──
  const pendingAt = useRef<{ x: number; y: number } | null>(null);
  // 空图片节点点「上传」时记下节点 id:选完文件直接填进该节点,取消则节点保持原样
  const pendingFor = useRef<string | null>(null);
  const onPickFile = (file: File) => {
    const kind: NodeKind = file.type.startsWith("video") ? "video" : file.type.startsWith("audio") ? "audio" : "image";
    const fr = new FileReader();
    fr.onload = () => {
      const url = String(fr.result);
      const target = pendingFor.current ? nodes.find((n) => n.id === pendingFor.current) : null;
      if (target && target.kind === kind) {
        commit();
        setNodes((ns) => ns.map((n) => (n.id === target.id ? { ...n, url, title: file.name } : n)));
      } else {
        addNode(kind, pendingAt.current ?? undefined, { url, title: file.name });
      }
      pendingAt.current = null;
      pendingFor.current = null;
    };
    fr.readAsDataURL(file);
  };

  const doPaste = async (at: { x: number; y: number }) => {
    // 优先粘贴「复制节点」的内容;否则粘贴系统剪贴板文本
    if (nodeClipboard.current) {
      const c = nodeClipboard.current;
      commit();
      const copy: WfNode = { ...JSON.parse(JSON.stringify(c)), id: uid(), x: at.x - SIZE[c.kind].w / 2, y: at.y - SIZE[c.kind].h / 2 };
      setNodes((ns) => [...ns, copy]);
      selectOne(copy.id);
      return;
    }
    try {
      const txt = await navigator.clipboard.readText();
      if (txt) addNode("text", at, { content: txt });
    } catch { /* 无权限/为空,忽略 */ }
  };

  // ── 连线几何 ──
  const portPos = (n: WfNode, side: "l" | "r") => ({
    x: side === "l" ? n.x : n.x + SIZE[n.kind].w,
    y: n.y + SIZE[n.kind].h / 2,
  });
  const edgePath = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = Math.max(48, Math.abs(b.x - a.x) / 2);
    return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
  };
  const nodeById = (id: string) => nodes.find((n) => n.id === id);

  // ── 节点生成器 ──
  const genOf = (n: WfNode): WfGen => {
    const g = n.gen ?? defaultGen(n.kind);
    const allowed = GEN_MODELS[g.type] ?? [];
    return allowed.length && !allowed.includes(g.model) ? { ...g, model: allowed[0] } : g;
  };
  const patchGen = (id: string, patch: Partial<WfGen>) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, gen: { ...genOf(n), ...patch } } : n)));
  };
  const genCost = (g: WfGen) => {
    if (g.type === "video") {
      const resF = g.res === "1080P" ? 2 : g.res === "480P" ? 0.6 : 1;
      return Math.round(110 * (g.dur ?? 5) * resF * g.count);
    }
    return GEN_BASE_COST[g.type] * g.count * (g.res === "3K" ? 2 : 1);
  };
  const setRef = (id: string, key: string, url: string | null) => {
    const cur = nodeById(id)?.gen?.refs ?? {};
    patchGen(id, { refs: { ...cur, [key]: url } });
  };

  // ── @ 提及素材 ──
  const onPrompt = (n: WfNode, e: React.ChangeEvent<HTMLTextAreaElement>) => {
    patchGen(n.id, { prompt: e.target.value });
    const el = e.target;
    mentionInput.current = el;
    const pos = el.selectionStart ?? el.value.length;
    const before = el.value.slice(0, pos);
    const at = before.lastIndexOf("@");
    if (at >= 0 && !/\s/.test(before.slice(at + 1))) {
      setMention({ id: n.id, q: before.slice(at + 1) });
      if (before.slice(at + 1)) setMentionCat(null);
    } else {
      setMention(null);
      setMentionCat(null);
    }
  };
  const insertMention = (name: string) => {
    const el = mentionInput.current;
    const m = mention;
    if (!el || !m) return;
    const pos = el.selectionStart ?? el.value.length;
    const before = el.value.slice(0, pos);
    const at = before.lastIndexOf("@");
    if (at < 0) return;
    const next = `${before.slice(0, at)}@${name} ${el.value.slice(pos)}`;
    patchGen(m.id, { prompt: next });
    setMention(null);
    setMentionCat(null);
    const caret = at + name.length + 2;
    window.setTimeout(() => { el.focus(); el.setSelectionRange(caret, caret); }, 0);
  };
  const hueGrad = (hue: number) => `linear-gradient(135deg, oklch(55% .12 ${hue}), oklch(35% .10 ${hue}))`;
  const renderMention = (n: WfNode) => {
    if (!mention || mention.id !== n.id) return null;
    const q = mention.q.trim().toLowerCase();
    const chars = characters.map((c) => ({ key: `c${c.id}`, name: c.name, url: c.ref_image_url, hue: c.hue, tag: "角色" }));
    const scs = scenes.map((s) => ({ key: `s${s.id}`, name: s.name, url: s.image_url, hue: s.hue, tag: "场景" }));
    const prs = propAssets.map((p) => ({ key: `p${p.id}`, name: p.name, url: p.image_url, hue: p.hue, tag: "道具" }));
    const nds = nodes.filter((x) => x.id !== n.id && x.kind !== "agent" && x.kind !== "director");
    const assetRow = (a: { key: string; name: string; url: string | null; hue: number; tag: string }) => (
      <button key={a.key} className="wf-mt-it" onClick={() => insertMention(a.name)}>
        {a.url ? <img src={a.url} alt="" draggable={false} /> : <span className="ph" style={{ background: hueGrad(a.hue) }}>{a.name[0]}</span>}
        <span className="nm">{a.name}</span>
        <span className="tg">{t(a.tag)}</span>
      </button>
    );
    const nodeRow = (x: WfNode) => (
      <button key={x.id} className="wf-mt-it" onClick={() => insertMention(x.title)}>
        <span className="dot" style={{ background: KIND_COLOR[x.kind] }} />
        <span className="nm">{x.title}</span>
        <span className="tg">{t(KIND_LABEL[x.kind])}</span>
      </button>
    );
    if (q) {
      const hits = [...chars, ...scs, ...prs].filter((a) => a.name.toLowerCase().includes(q));
      const nhits = nds.filter((x) => x.title.toLowerCase().includes(q));
      return (
        <div className="wf-mention" onPointerDown={(e) => e.stopPropagation()}>
          <div className="hd">{t("搜索")} “{mention.q}”</div>
          <div className="ls">
            {hits.map(assetRow)}
            {nhits.map(nodeRow)}
            {hits.length + nhits.length === 0 && <div className="emp">{t("无匹配素材")}</div>}
          </div>
        </div>
      );
    }
    return (
      <div className="wf-mention" onPointerDown={(e) => e.stopPropagation()}>
        <div className="hd">{t("分类")}</div>
        {([["proj", "本项目"], ["cross", "跨项目"], ["canvas", "画布"]] as const).map(([k, lb]) => (
          <button key={k} className={cn("wf-mt-cat", mentionCat === k && "on")} onClick={() => setMentionCat(mentionCat === k ? null : k)}>
            {t(lb)} <span className="ar">›</span>
          </button>
        ))}
        <div className="ft">{t("输入关键词搜索")}</div>
        {mentionCat && (
          <div className="wf-mention-sub">
            {mentionCat === "proj" && (
              <div className="ls">
                <div className="hd">{t("角色")}</div>
                {chars.length === 0 && <div className="emp">{t("暂无素材")}</div>}
                {chars.map(assetRow)}
                <div className="hd">{t("场景")}</div>
                {scs.length === 0 && <div className="emp">{t("暂无素材")}</div>}
                {scs.map(assetRow)}
                <div className="hd">{t("道具")}</div>
                {prs.length === 0 && <div className="emp">{t("暂无素材")}</div>}
                {prs.map(assetRow)}
              </div>
            )}
            {mentionCat === "cross" && (
              <div className="ls">
                <div className="hd">{t("角色库(全局,跨项目可用)")}</div>
                {chars.length === 0 && <div className="emp">{t("暂无素材")}</div>}
                {chars.map(assetRow)}
              </div>
            )}
            {mentionCat === "canvas" && (
              <div className="ls">
                <div className="hd">{t("画布节点")}</div>
                {nds.length === 0 && <div className="emp">{t("画布暂无其他节点")}</div>}
                {nds.map(nodeRow)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };
  const submitGen = (n: WfNode) => {
    const g = genOf(n);
    const hasRef = !!g.refs && Object.values(g.refs).some(Boolean);
    if (!g.prompt.trim() && !hasRef) return;
    setCompSent(true);
    if (sentTimer.current) window.clearTimeout(sentTimer.current);
    sentTimer.current = window.setTimeout(() => setCompSent(false), 2600);
  };

  // ── 小地图 ──
  const minimap = useMemo(() => {
    const W = 150, H = 92;
    const r = wrapRef.current?.getBoundingClientRect();
    if (nodes.length === 0 || !r) return null;
    const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
    const xe = nodes.map((n) => n.x + SIZE[n.kind].w), ye = nodes.map((n) => n.y + SIZE[n.kind].h);
    // 只按节点范围定比例,滚动/平移时小地图不再缩放(视口框移动、超出则裁剪)
    const pad = 120;
    const vx = -pan.x / zoom, vy = -pan.y / zoom, vw = r.width / zoom, vh = r.height / zoom;
    const bx = Math.min(...xs) - pad, by = Math.min(...ys) - pad;
    const bw = Math.max(...xe) + pad - bx, bh = Math.max(...ye) + pad - by;
    const s = Math.min(W / bw, H / bh);
    const ox = (W - bw * s) / 2, oy = (H - bh * s) / 2;
    return {
      W, H, bx, by, s, ox, oy,
      rects: nodes.map((n) => ({
        id: n.id,
        x: ox + (n.x - bx) * s, y: oy + (n.y - by) * s,
        w: Math.max(3, SIZE[n.kind].w * s), h: Math.max(2, SIZE[n.kind].h * s),
        c: KIND_COLOR[n.kind],
      })),
      view: { x: ox + (vx - bx) * s, y: oy + (vy - by) * s, w: vw * s, h: vh * s },
    };
  }, [nodes, pan, zoom]);

  // 小地图拖动 → 主画布平移(点哪儿,世界中那个点就居中到视口)
  const miniDragRef = useRef(false);
  const moveToMini = (clientX: number, clientY: number, bodyEl: HTMLElement) => {
    if (!minimap) return;
    const body = bodyEl.getBoundingClientRect();
    const sf = body.width / minimap.W; // 视觉→内部坐标(含 zoom)
    const mx = (clientX - body.left) / sf, my = (clientY - body.top) / sf;
    const wx = minimap.bx + (mx - minimap.ox) / minimap.s;
    const wy = minimap.by + (my - minimap.oy) / minimap.s;
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    setPan({ x: r.width / 2 - wx * zoom, y: r.height / 2 - wy * zoom });
  };
  const onMiniDown = (e: RPointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    miniDragRef.current = true;
    const el = e.currentTarget as HTMLElement;
    moveToMini(e.clientX, e.clientY, el);
    try { el.setPointerCapture(e.pointerId); } catch { /* 合成事件可能无效,忽略 */ }
  };
  const onMiniMove = (e: RPointerEvent) => {
    if (!miniDragRef.current) return;
    moveToMini(e.clientX, e.clientY, e.currentTarget as HTMLElement);
  };
  const onMiniUp = (e: RPointerEvent) => {
    miniDragRef.current = false;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* 忽略 */ }
  };

  const renderNodeBody = (n: WfNode) => {
    switch (n.kind) {
      case "text": {
        const txt = (n.gen?.prompt ?? n.content ?? "").trim();
        return (
          <div className="wf-textbody">
            {txt ? txt : <span className="ph">{t("点击节点写提示词")}</span>}
          </div>
        );
      }
      case "script": {
        // 节点正文实时显示下方框里输入/生成的文本
        const out = (n.gen?.prompt ?? n.content ?? "").trim();
        return (
          <div className="wf-textbody">
            {out ? out : <span className="ph">{n.generated ? t("分镜头脚本(可编辑)") : t("点击节点输入剧情,生成分镜头脚本")}</span>}
          </div>
        );
      }
      case "image":
        return n.url ? (
          <img className="wf-media" src={n.url} alt={n.title} draggable={false} />
        ) : (
          <div className="wf-empty static">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.5-3.5L7 22"/></svg>
            {t("点击节点写提示词,或在面板上传参考图")}
          </div>
        );
      case "video":
        return n.url ? (
          <video className="wf-media" src={n.url} controls preload="metadata" />
        ) : (
          <div className="wf-empty static"><PlayIcon /> {t("空视频节点 · 可从生成历史添加")}</div>
        );
      case "audio":
        return n.url ? (
          <div className="wf-aplayer"><audio className="wf-audio" src={n.url} controls /></div>
        ) : (
          <div className="wf-empty static">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></svg>
          </div>
        );
      case "director":
        return (
          <div className="dc-card">
            <div className="dc-card-inner" />
            <button className="dc-launch" onClick={(e) => { e.stopPropagation(); setDirectorOpen(n.id); }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3.5 9.5h17v9a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z" />
                <path d="m3.5 9.5 1-4.2 16.2 2-0.7 2.2" />
                <path d="m8.2 6 2.4 3M13 6.6l2.4 3" />
              </svg>
              Director Console
            </button>
          </div>
        );
      case "agent":
        return (
          <div className="wf-agent">
            <span className="wf-agent-ico">⚙</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{t("Agent 节点")}</div>
              <div className="dim-2" style={{ fontSize: 11, lineHeight: 1.5 }}>{t("连接上游素材,自动执行生成任务(开发中)")}</div>
            </div>
          </div>
        );
    }
  };

  const assets =
    assetTab === "char"
      ? characters.map((c) => ({ id: c.id, name: c.name, url: c.ref_image_url, hue: c.hue }))
      : assetTab === "scene"
        ? scenes.map((s) => ({ id: s.id, name: s.name, url: s.image_url, hue: s.hue }))
        : propAssets.map((p) => ({ id: p.id, name: p.name, url: p.image_url, hue: p.hue }));

  const tasks = (tasksQuery.data?.list ?? []).filter((tk) =>
    histTab === "all" ? true : histTab === "video" ? !!tk.output_video_url : !tk.output_video_url,
  );

  return (
    <div
      ref={wrapRef}
      className={cn("wf-stage", tool === "hand" && "hand")}
      onPointerDown={onStagePointerDown}
      onPointerMove={onStagePointerMove}
      onPointerUp={onStagePointerUp}
      onContextMenu={onContextMenu}
    >
      {/* 内容层 */}
      <div className="wf-world" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
        {guides.v !== null && <div className="wf-guide v" style={{ left: guides.v }} />}
        {guides.h !== null && <div className="wf-guide h" style={{ top: guides.h }} />}
        <svg className="wf-edges">
          {!hideEdges && edges.map((e) => {
            const a = nodeById(e.from), b = nodeById(e.to);
            if (!a || !b) return null;
            const d = edgePath(portPos(a, "r"), portPos(b, "l"));
            // 选中节点时,它左右两侧的连线高亮并有从左到右的流水点
            const lit = selected.has(e.from) || selected.has(e.to);
            return (
              <g key={e.id}>
                <path className={cn(lit && "lit")} d={d} />
                {lit && <path className="flow" d={d} pathLength={100} />}
              </g>
            );
          })}
          {linking && nodeById(linking.from) && (
            <path className="tmp" d={edgePath(portPos(nodeById(linking.from)!, "r"), { x: linking.mx, y: linking.my })} />
          )}
        </svg>

        {nodes.map((n) => (
          <div
            key={n.id}
            data-nid={n.id}
            className={cn("wf-node", n.kind, n.generated && "is-generated", selected.has(n.id) && "selected", linking && linking.from !== n.id && "linkable")}
            style={{ left: n.x, top: n.y, width: SIZE[n.kind].w }}
            onPointerDown={(e) => onNodePointerDown(e, n)}
          >
            <div className="wf-node-label">
              <span className="dot" style={{ background: KIND_COLOR[n.kind] }} />
              {n.title}
              {n.generated && <span className="wf-gen-badge">✦ {t("生成")}</span>}
              <button className="wf-node-x" title={t("删除节点")} onClick={(e) => { e.stopPropagation(); removeNode(n.id); }}>
                <CloseIcon />
              </button>
            </div>
            <div className="wf-node-body">{renderNodeBody(n)}</div>
            <button className="wf-port l" title={t("连接")} onClick={(e) => onPortClick(e, n)}><PlusIcon /></button>
            <button className="wf-port r" title={t("连接")} onClick={(e) => onPortClick(e, n)}><PlusIcon /></button>
          </div>
        ))}

        {(() => {
          const n = solo ? nodeById(solo) : null;
          if (!n || n.kind === "agent" || n.kind === "director") return null;
          const g = genOf(n);
          const W = compTall ? 760 : 560;
          const showSize = g.type === "image" || g.type === "video";
          const showThumb = n.kind === "image" || n.kind === "video";
          const ph = g.type === "text" ? t("描述你想生成的文本…") : g.type === "audio" ? t("描述你想生成的音频…") : t("描述你想生成的画面…");

          // ── 视频节点:5 子模式 + 参考槽(可从角色/场景/道具库导入或上传) ──
          if (n.kind === "video") {
            const VW = compTall ? 760 : 560;
            const vmode = g.vmode ?? "t2v";
            const slots = VMODE_SLOTS[vmode];
            const pickList =
              pickTab === "char" ? characters.map((c) => ({ id: c.id, name: c.name, url: c.ref_image_url, hue: c.hue }))
              : pickTab === "scene" ? scenes.map((s) => ({ id: s.id, name: s.name, url: s.image_url, hue: s.hue }))
              : propAssets.map((p) => ({ id: p.id, name: p.name, url: p.image_url, hue: p.hue }));
            const slotIcon = (a: SlotAccept) =>
              a === "video" ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m10 9 5 3-5 3z" fill="currentColor" stroke="none" /></svg>
              : a === "audio" ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></svg>
              : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.5-3.5L7 22" /></svg>;
            const hasRef = slots.some((s) => g.refs?.[s.key]);
            const canSend = !!g.prompt.trim() || hasRef;
            return (
              <div
                className={cn("wf-composer wf-vcomposer", compTall && "tall")}
                style={{ left: n.x + SIZE[n.kind].w / 2 - VW / 2, top: n.y + SIZE[n.kind].h + 26, width: VW }}
                onPointerDown={(e) => e.stopPropagation()}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
              >
                <button className="wf-comp-expand" title={t("展开")} onClick={() => setCompTall((v) => !v)}>⤢</button>
                {renderMention(n)}
                <div className="wf-vtabs">
                  {VMODES.map((m) => (
                    <button key={m.id} className={cn("wf-vtab", vmode === m.id && "on")} onClick={() => { patchGen(n.id, { vmode: m.id }); setPickSlot(null); }}>
                      {t(m.label)}
                    </button>
                  ))}
                </div>

                {slots.length > 0 && (
                  <>
                    <div className="wf-vhint">
                      <span>{t("角色素材需通过虚拟角色库审核后方可使用(支持在参考槽内选择素材库或右键上传)")}</span>
                      <button className="wf-vhint-up" onClick={() => { pendingRef.current = { id: n.id, key: slots[0].key }; refFileRef.current?.click(); }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V4m0 0 4 4m-4-4-4 4" /><path d="M5 16v3h14v-3" /></svg>
                        {t("上传")}
                      </button>
                    </div>
                    <div className="wf-slots">
                      {slots.map((s) => {
                        const url = g.refs?.[s.key] ?? null;
                        return (
                          <div className="wf-slot-wrap" key={s.key}>
                            <button
                              className={cn("wf-slot", url && "filled")}
                              title={t(s.label)}
                              onClick={() => { if (s.accept === "image") { setPickTab("char"); setPickSlot(pickSlot === s.key ? null : s.key); } else { pendingRef.current = { id: n.id, key: s.key }; refFileRef.current?.click(); } }}
                              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); pendingRef.current = { id: n.id, key: s.key }; refFileRef.current?.click(); }}
                            >
                              {url ? (s.accept === "image" ? <img src={url} alt="" draggable={false} /> : slotIcon(s.accept)) : slotIcon(s.accept)}
                              {url && (
                                <span className="wf-slot-x" title={t("移除")} onClick={(e) => { e.stopPropagation(); setRef(n.id, s.key, null); }}>
                                  <CloseIcon />
                                </span>
                              )}
                            </button>
                            <span className="wf-slot-lb">{t(s.label)}</span>
                            {pickSlot === s.key && s.accept === "image" && (
                              <div className="wf-pick" onPointerDown={(e) => e.stopPropagation()}>
                                <div className="wf-pick-tabs">
                                  <button className={cn(pickTab === "char" && "on")} onClick={() => setPickTab("char")}>{t("角色库")}</button>
                                  <button className={cn(pickTab === "scene" && "on")} onClick={() => setPickTab("scene")}>{t("场景库")}</button>
                                  <button className={cn(pickTab === "prop" && "on")} onClick={() => setPickTab("prop")}>{t("道具库")}</button>
                                </div>
                                <div className="wf-pick-grid">
                                  <button className="wf-pick-up" onClick={() => { pendingRef.current = { id: n.id, key: s.key }; setPickSlot(null); refFileRef.current?.click(); }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V4m0 0 4 4m-4-4-4 4" /><path d="M5 16v3h14v-3" /></svg>
                                    {t("本地上传")}
                                  </button>
                                  {pickList.length === 0 && <div className="wf-pick-empty">{t("该库暂无素材")}</div>}
                                  {pickList.map((a) => (
                                    <button className="wf-pick-it" key={a.id} onClick={() => { setRef(n.id, s.key, a.url); setPickSlot(null); }}>
                                      {a.url ? <img src={a.url} alt={a.name} draggable={false} /> : <span className="ph" style={{ background: `linear-gradient(135deg, oklch(55% .12 ${a.hue}), oklch(35% .10 ${a.hue}))` }}>{a.name[0]}</span>}
                                      <span className="nm">{a.name}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                <textarea
                  className="wf-comp-input"
                  placeholder={t("描述您的修改或生成需求…")}
                  maxLength={10000}
                  value={g.prompt}
                  onChange={(e) => onPrompt(n, e)}
                />
                <div className="wf-vcount">{g.prompt.length}/10000</div>

                <div className="wf-comp-row">
                  <div className="wf-comp-dd">
                    <button className="wf-comp-chip" onClick={() => setCompMenu(compMenu === "type" ? null : "type")}>
                      <span className="gl">{GEN_TYPE_GLYPH[g.type]}</span> {t(GEN_TYPE_LABEL[g.type])} <span className="cv">⌄</span>
                    </button>
                    {compMenu === "type" && (
                      <div className="wf-comp-menu">
                        {(Object.keys(GEN_TYPE_LABEL) as GenType[]).map((k) => (
                          <button key={k} onClick={() => { patchGen(n.id, { type: k, model: GEN_MODELS[k][0] }); setCompMenu(null); }}>
                            <span className="gl">{GEN_TYPE_GLYPH[k]}</span> {t(GEN_TYPE_LABEL[k])}
                            {g.type === k && <span className="ck">✓</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="wf-comp-dd">
                    <button className="wf-comp-chip" onClick={() => setCompMenu(compMenu === "model" ? null : "model")}>
                      {g.model} <span className="cv">⌄</span>
                    </button>
                    {compMenu === "model" && (
                      <div className="wf-comp-menu">
                        {GEN_MODELS.video.map((m) => (
                          <button key={m} onClick={() => { patchGen(n.id, { model: m }); setCompMenu(null); }}>
                            {m}{g.model === m && <span className="ck">✓</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="wf-comp-dd">
                    <button className="wf-comp-chip" onClick={() => setCompMenu(compMenu === "size" ? null : "size")}>
                      <span className="rbx" style={ratioBox(g.ratio, 14)} /> {g.ratio} / {g.dur ?? 5}S / {g.res} <span className="cv">⌄</span>
                    </button>
                    {compMenu === "size" && (
                      <div className="wf-comp-pop">
                        <div className="lbl">{t("比例")}</div>
                        <div className="wf-ratio-grid">
                          {GEN_RATIOS.map((r) => (
                            <button key={r} className={cn("wf-ratio-it", g.ratio === r && "on")} onClick={() => patchGen(n.id, { ratio: r })}>
                              <span className="bx" style={ratioBox(r)} />{r}
                            </button>
                          ))}
                        </div>
                        <div className="lbl">{t("时长")}</div>
                        <div className="wf-res-seg">
                          {VIDEO_DUR.map((d) => (
                            <button key={d} className={cn((g.dur ?? 5) === d && "on")} onClick={() => patchGen(n.id, { dur: d })}>{d}S</button>
                          ))}
                        </div>
                        <div className="lbl">{t("清晰度")}</div>
                        <div className="wf-res-seg">
                          {VIDEO_RES.map((r) => (
                            <button key={r} className={cn(g.res === r && "on")} onClick={() => patchGen(n.id, { res: r })}>{r}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <span className="wf-comp-cost">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4.5 13H11l-1.5 9L18 11h-6.5L13 2z" /></svg>
                    {genCost(g)}
                  </span>
                  <button className="wf-comp-send" title={t("生成")} disabled={!canSend} onClick={() => submitGen(n)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5m0 0-6 6m6-6 6 6" /></svg>
                  </button>
                </div>
                {compSent && <div className="wf-comp-sent">{t("已提交生成任务(示例:后端接入后生效)")}</div>}
              </div>
            );
          }

          // ── 音频节点:文本转语音(TTS)+ 参数设置 ──
          if (n.kind === "audio") {
            const AW = compTall ? 760 : 560;
            const insert = (tok: string) => { patchGen(n.id, { prompt: (g.prompt || "") + tok }); setCompMenu(null); };
            const slider = (label: string, value: number, set: (v: number) => void, min: number, max: number, step: number, valText: string) => (
              <div className="wf-sld-row">
                <span className="wf-sld-lb">{t(label)}</span>
                <input type="range" className="wf-sld" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} />
                <span className="wf-sld-val">{valText}</span>
              </div>
            );
            return (
              <div
                className={cn("wf-composer wf-acomposer", compTall && "tall")}
                style={{ left: n.x + SIZE[n.kind].w / 2 - AW / 2, top: n.y + SIZE[n.kind].h + 26, width: AW }}
                onPointerDown={(e) => e.stopPropagation()}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
              >
                <button className="wf-comp-expand" title={t("展开")} onClick={() => setCompTall((v) => !v)}>⤢</button>
                {renderMention(n)}
                <div className="wf-atop">
                  <div className="wf-comp-dd">
                    <button className="wf-atag" onClick={() => setCompMenu(compMenu === "pause" ? null : "pause")}>{t("停顿")} <span className="cv">⌄</span></button>
                    {compMenu === "pause" && (
                      <div className="wf-comp-menu narrow">
                        {AUDIO_PAUSE.map((p) => <button key={p} onClick={() => insert(`[${t("停顿")}${p}]`)}>{p}</button>)}
                      </div>
                    )}
                  </div>
                  <div className="wf-comp-dd">
                    <button className="wf-atag" onClick={() => setCompMenu(compMenu === "tone" ? null : "tone")}>{t("语气词")} <span className="cv">⌄</span></button>
                    {compMenu === "tone" && (
                      <div className="wf-comp-menu narrow">
                        {AUDIO_TONE.map((w) => <button key={w} onClick={() => insert(w)}>{w}</button>)}
                      </div>
                    )}
                  </div>
                </div>
                <textarea
                  className="wf-comp-input"
                  placeholder={t("输入要合成的文字…")}
                  value={g.prompt}
                  onChange={(e) => onPrompt(n, e)}
                />
                <div className="wf-comp-row">
                  <div className="wf-comp-dd">
                    <button className="wf-comp-chip" onClick={() => setCompMenu(compMenu === "type" ? null : "type")}>
                      <span className="gl">{GEN_TYPE_GLYPH[g.type]}</span> {t(GEN_TYPE_LABEL[g.type])} <span className="cv">⌄</span>
                    </button>
                    {compMenu === "type" && (
                      <div className="wf-comp-menu">
                        {(Object.keys(GEN_TYPE_LABEL) as GenType[]).map((k) => (
                          <button key={k} onClick={() => { patchGen(n.id, { type: k, model: GEN_MODELS[k][0] }); setCompMenu(null); }}>
                            <span className="gl">{GEN_TYPE_GLYPH[k]}</span> {t(GEN_TYPE_LABEL[k])}{g.type === k && <span className="ck">✓</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="wf-comp-dd">
                    <button className="wf-comp-chip" onClick={() => setCompMenu(compMenu === "model" ? null : "model")}>
                      {g.model} <span className="cv">⌄</span>
                    </button>
                    {compMenu === "model" && (
                      <div className="wf-comp-menu">
                        {GEN_MODELS.audio.map((m) => (
                          <button key={m} onClick={() => { patchGen(n.id, { model: m }); setCompMenu(null); }}>{m}{g.model === m && <span className="ck">✓</span>}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button className={cn("wf-comp-chip", audioParam && "on")} onClick={() => setAudioParam((v) => !v)}>{t("参数设置")}</button>
                  <span className="wf-comp-cost">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4.5 13H11l-1.5 9L18 11h-6.5L13 2z" /></svg>
                    {genCost(g)}
                  </span>
                  <button className="wf-comp-send" title={t("生成")} disabled={!g.prompt.trim()} onClick={() => submitGen(n)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5m0 0-6 6m6-6 6 6" /></svg>
                  </button>
                </div>

                {audioParam && (
                  <div className="wf-aparams">
                    <div className="wf-apar-head">
                      <span className="ttl">{t("音色设置")}</span>
                      <button className="wf-apar-reset" onClick={() => patchGen(n.id, { speed: 1, tone: 0, volume: 1, pitch: 0, intensity: 0, timbre: 0, emotion: "无", voice: "中文男声" })}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.7 3L3 13" /></svg>
                        {t("一键重置")}
                      </button>
                    </div>
                    <div className="wf-aseg">
                      <button className={cn(voiceTab === "sys" && "on")} onClick={() => setVoiceTab("sys")}>{t("系统音色")}</button>
                      <button className={cn(voiceTab === "mine" && "on")} onClick={() => setVoiceTab("mine")}>{t("我的音色")}</button>
                    </div>
                    {voiceTab === "sys" ? (
                      <div className="wf-avoice">
                        <div className="wf-comp-dd" style={{ flex: 1 }}>
                          <button className="wf-avoice-pick" onClick={() => setCompMenu(compMenu === "voice" ? null : "voice")}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 10v4M8 7v10M12 5v14M16 8v8M20 11v2" /></svg>
                            <span className="nm">{g.voice}</span>
                            <span className="cv">⌄</span>
                          </button>
                          {compMenu === "voice" && (
                            <div className="wf-comp-menu" style={{ left: 0, right: 0 }}>
                              {AUDIO_VOICES.map((v) => (
                                <button key={v} onClick={() => { patchGen(n.id, { voice: v }); setCompMenu(null); }}>{v}{g.voice === v && <span className="ck">✓</span>}</button>
                              ))}
                            </div>
                          )}
                        </div>
                        <button className="wf-avoice-play" title={t("试听")}><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></button>
                      </div>
                    ) : (
                      <div className="wf-myvoices">
                        {(g.myVoices ?? []).length === 0 ? (
                          <div className="wf-myvoices-empty">{t("暂无复刻音色")}</div>
                        ) : (
                          (g.myVoices ?? []).map((v) => (
                            <button key={v} className={cn("wf-myvoice", g.voice === v && "on")} onClick={() => patchGen(n.id, { voice: v })}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 10v4M8 7v10M12 5v14M16 8v8M20 11v2" /></svg>
                              <span className="nm">{v}</span>
                              {g.voice === v && <span className="ck">✓</span>}
                            </button>
                          ))
                        )}
                        <button className="wf-addvoice" onClick={() => { setCloneTab("upload"); setRecording(false); setCloneOpen(true); }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                          {t("添加复刻音色")}
                        </button>
                      </div>
                    )}

                    {cloneOpen && (
                      <div className="wf-clone-mask" onPointerDown={(e) => e.stopPropagation()}>
                        <div className="wf-clone">
                          <div className="wf-clone-head">
                            {t("添加复刻音色")}
                            <button className="wf-clone-x" onClick={() => setCloneOpen(false)}><CloseIcon /></button>
                          </div>
                          <div className="wf-clone-tabs">
                            <button className={cn(cloneTab === "upload" && "on")} onClick={() => setCloneTab("upload")}>{t("上传文件")}</button>
                            <button className={cn(cloneTab === "record" && "on")} onClick={() => setCloneTab("record")}>{t("录制音频")}</button>
                          </div>
                          <div className="wf-clone-body">
                            <div className="wf-clone-cost"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4.5 13H11l-1.5 9L18 11h-6.5L13 2z" /></svg> {t("添加音色")} · 850</div>
                            {cloneTab === "upload" ? (
                              <button className="wf-clone-drop" onClick={() => { pendingVoiceNode.current = n.id; voiceFileRef.current?.click(); }}>
                                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></svg>
                                <span className="t1">{t("点击或拖拽上传音频文件")}</span>
                                <span className="t2">{t("支持 mp3 / m4a / wav,10秒~5分钟,最大 20MB")}</span>
                              </button>
                            ) : (
                              <div className="wf-clone-rec">
                                <button className={cn("wf-mic", recording && "on")} onClick={() => {
                                  if (recording) { setRecording(false); addMyVoice(n.id, `${t("录制音色")} ${(g.myVoices ?? []).length + 1}`); setCloneOpen(false); }
                                  else setRecording(true);
                                }}>
                                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
                                </button>
                                <span className="t1">{recording ? t("录音中…再次点击结束") : t("点击开始录音(10秒 ~ 3分钟)")}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="wf-apar-sub">{t("基础调节")}</div>
                    {slider("语速", g.speed ?? 1, (v) => patchGen(n.id, { speed: v }), 0.5, 2, 0.05, (g.speed ?? 1).toFixed(2))}
                    {slider("语调", g.tone ?? 0, (v) => patchGen(n.id, { tone: v }), -12, 12, 1, String(g.tone ?? 0))}
                    {slider("音量", g.volume ?? 1, (v) => patchGen(n.id, { volume: v }), 0, 2, 0.1, (g.volume ?? 1).toFixed(1))}

                    <div className="wf-apar-sub">{t("音色效果调节")}</div>
                    {slider("音高", g.pitch ?? 0, (v) => patchGen(n.id, { pitch: v }), -12, 12, 1, String(g.pitch ?? 0))}
                    {slider("强度", g.intensity ?? 0, (v) => patchGen(n.id, { intensity: v }), -12, 12, 1, String(g.intensity ?? 0))}
                    {slider("音色调节", g.timbre ?? 0, (v) => patchGen(n.id, { timbre: v }), -12, 12, 1, String(g.timbre ?? 0))}

                    <div className="wf-apar-sub">{t("情绪")}</div>
                    <div className="wf-emos">
                      {AUDIO_EMOTIONS.map((em) => (
                        <button key={em} className={cn("wf-emo", (g.emotion ?? "无") === em && "on")} onClick={() => patchGen(n.id, { emotion: em })}>{t(em)}</button>
                      ))}
                    </div>
                  </div>
                )}
                {compSent && <div className="wf-comp-sent">{t("已提交生成任务(示例:后端接入后生效)")}</div>}
              </div>
            );
          }

          // ── 剧本分镜头节点 ──
          // 手动新建:输入剧情 → 「生成剧本分镜头新节点」;生成出来的节点:只留模型/费用 + 「生成提示词」按钮
          if (n.kind === "script") {
            const SW = compTall ? 760 : 600;
            const isGen = !!n.generated;
            return (
              <div
                className={cn("wf-composer", compTall && "tall")}
                style={{ left: n.x + SIZE[n.kind].w / 2 - SW / 2, top: n.y + SIZE[n.kind].h + 26, width: SW }}
                onPointerDown={(e) => e.stopPropagation()}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
              >
                <button className="wf-comp-expand" title={t("展开")} onClick={() => setCompTall((v) => !v)}>⤢</button>
                {renderMention(n)}
                <textarea
                  className="wf-comp-input"
                  placeholder={isGen ? t("分镜头脚本内容(可编辑)…") : t("粘贴或输入剧情文本,生成分镜头脚本…")}
                  value={g.prompt}
                  onChange={(e) => onPrompt(n, e)}
                />
                <div className="wf-comp-row">
                  {!isGen && <span className="wf-comp-chip static"><span className="gl">≣</span> {t("剧本分镜头生成")}</span>}
                  <div className="wf-comp-dd">
                    <button className="wf-comp-chip" onClick={() => setCompMenu(compMenu === "model" ? null : "model")}>
                      {g.model} <span className="cv">⌄</span>
                    </button>
                    {compMenu === "model" && (
                      <div className="wf-comp-menu">
                        {GEN_MODELS.text.map((m) => (
                          <button key={m} onClick={() => { patchGen(n.id, { model: m }); setCompMenu(null); }}>{m}{g.model === m && <span className="ck">✓</span>}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="wf-comp-cost">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4.5 13H11l-1.5 9L18 11h-6.5L13 2z" /></svg>
                    5
                  </span>
                  <button className="wf-comp-genbtn" disabled={!g.prompt.trim()} onClick={() => generateScriptNode(n)}>
                    {isGen ? t("生成提示词") : t("生成剧本分镜头新节点")}
                  </button>
                </div>
              </div>
            );
          }

          const pickList =
            pickTab === "char" ? characters.map((c) => ({ id: c.id, name: c.name, url: c.ref_image_url, hue: c.hue }))
            : pickTab === "scene" ? scenes.map((s) => ({ id: s.id, name: s.name, url: s.image_url, hue: s.hue }))
            : propAssets.map((p) => ({ id: p.id, name: p.name, url: p.image_url, hue: p.hue }));
          return (
            <div
              className={cn("wf-composer", compTall && "tall")}
              style={{ left: n.x + SIZE[n.kind].w / 2 - W / 2, top: n.y + SIZE[n.kind].h + 26, width: W }}
              onPointerDown={(e) => e.stopPropagation()}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
            >
              <button className="wf-comp-expand" title={t("展开")} onClick={() => setCompTall((v) => !v)}>⤢</button>
              {renderMention(n)}
              {showThumb && (
                <div className="wf-comp-thumb-wrap">
                  <button
                    className="wf-comp-thumb"
                    title={t("选择参考图")}
                    onClick={() => { setPickTab("char"); setPickSlot(pickSlot === "main" ? null : "main"); }}
                  >
                    {n.url ? <img src={n.url} alt="" draggable={false} /> : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.5-3.5L7 22"/></svg>
                    )}
                  </button>
                  {pickSlot === "main" && (
                    <div className="wf-pick" onPointerDown={(e) => e.stopPropagation()}>
                      <div className="wf-pick-tabs">
                        <button className={cn(pickTab === "char" && "on")} onClick={() => setPickTab("char")}>{t("角色库")}</button>
                        <button className={cn(pickTab === "scene" && "on")} onClick={() => setPickTab("scene")}>{t("场景库")}</button>
                        <button className={cn(pickTab === "prop" && "on")} onClick={() => setPickTab("prop")}>{t("道具库")}</button>
                      </div>
                      <div className="wf-pick-grid">
                        <button className="wf-pick-up" onClick={() => { pendingFor.current = n.id; setPickSlot(null); fileRef.current?.click(); }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V4m0 0 4 4m-4-4-4 4" /><path d="M5 16v3h14v-3" /></svg>
                          {t("本地上传")}
                        </button>
                        {pickList.length === 0 && <div className="wf-pick-empty">{t("该库暂无素材")}</div>}
                        {pickList.map((a) => (
                          <button className="wf-pick-it" key={a.id} onClick={() => { setNodes((ns) => ns.map((x) => (x.id === n.id ? { ...x, url: a.url, title: a.name } : x))); setPickSlot(null); }}>
                            {a.url ? <img src={a.url} alt={a.name} draggable={false} /> : <span className="ph" style={{ background: `linear-gradient(135deg, oklch(55% .12 ${a.hue}), oklch(35% .10 ${a.hue}))` }}>{a.name[0]}</span>}
                            <span className="nm">{a.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <textarea
                className="wf-comp-input"
                placeholder={ph}
                value={g.prompt}
                onChange={(e) => onPrompt(n, e)}
              />
              <div className="wf-comp-row">
                <div className="wf-comp-dd">
                  <button className="wf-comp-chip" onClick={() => setCompMenu(compMenu === "type" ? null : "type")}>
                    <span className="gl">{GEN_TYPE_GLYPH[g.type]}</span> {t(GEN_TYPE_LABEL[g.type])} <span className="cv">⌄</span>
                  </button>
                  {compMenu === "type" && (
                    <div className="wf-comp-menu">
                      {(Object.keys(GEN_TYPE_LABEL) as GenType[]).map((k) => (
                        <button key={k} onClick={() => { patchGen(n.id, { type: k, model: GEN_MODELS[k][0] }); setCompMenu(null); }}>
                          <span className="gl">{GEN_TYPE_GLYPH[k]}</span> {t(GEN_TYPE_LABEL[k])}
                          {g.type === k && <span className="ck">✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="wf-comp-dd">
                  <button className="wf-comp-chip" onClick={() => setCompMenu(compMenu === "model" ? null : "model")}>
                    {g.model} <span className="cv">⌄</span>
                  </button>
                  {compMenu === "model" && (
                    <div className="wf-comp-menu">
                      {GEN_MODELS[g.type].map((m) => (
                        <button key={m} onClick={() => { patchGen(n.id, { model: m }); setCompMenu(null); }}>
                          {m}
                          {g.model === m && <span className="ck">✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {showSize && (
                  <div className="wf-comp-dd">
                    <button className="wf-comp-chip" onClick={() => setCompMenu(compMenu === "size" ? null : "size")}>
                      <span className="rbx" style={ratioBox(g.ratio, 14)} /> {g.ratio} / {g.res} <span className="cv">⌄</span>
                    </button>
                    {compMenu === "size" && (
                      <div className="wf-comp-pop">
                        <div className="lbl">{t("比例")}</div>
                        <div className="wf-ratio-grid">
                          {GEN_RATIOS.map((r) => (
                            <button key={r} className={cn("wf-ratio-it", g.ratio === r && "on")} onClick={() => patchGen(n.id, { ratio: r })}>
                              <span className="bx" style={ratioBox(r)} />
                              {r}
                            </button>
                          ))}
                        </div>
                        <div className="lbl">{t("清晰度")}</div>
                        <div className="wf-res-seg">
                          {(["2K", "3K"] as const).map((r) => (
                            <button key={r} className={cn(g.res === r && "on")} onClick={() => patchGen(n.id, { res: r })}>{r}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="wf-comp-dd">
                  <button className="wf-comp-chip" onClick={() => setCompMenu(compMenu === "count" ? null : "count")}>
                    ×{g.count} <span className="cv">⌄</span>
                  </button>
                  {compMenu === "count" && (
                    <div className="wf-comp-menu narrow">
                      {[1, 2, 3, 4].map((c) => (
                        <button key={c} onClick={() => { patchGen(n.id, { count: c }); setCompMenu(null); }}>
                          ×{c}
                          {g.count === c && <span className="ck">✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <span className="wf-comp-cost">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4.5 13H11l-1.5 9L18 11h-6.5L13 2z"/></svg>
                  {genCost(g)}
                </span>
                <button className="wf-comp-send" title={t("生成")} disabled={!g.prompt.trim()} onClick={() => submitGen(n)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5m0 0-6 6m6-6 6 6"/></svg>
                </button>
              </div>
              {compSent && <div className="wf-comp-sent">{t("已提交生成任务(示例:后端接入后生效)")}</div>}
            </div>
          );
        })()}
      </div>

      {/* 框选矩形 */}
      {marquee && (marquee.w > 1 || marquee.h > 1) && (
        <div className="wf-marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />
      )}

      {/* 左中:素材库 / 生成历史 */}
      <div className="wf-float wf-rail">
        <button className={cn("wf-rail-btn", panel === "assets" && "active")} onClick={() => setPanel(panel === "assets" ? null : "assets")}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
          <span>{t("素材库")}</span>
        </button>
        <button className={cn("wf-rail-btn", panel === "history" && "active")} onClick={() => setPanel(panel === "history" ? null : "history")}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          <span>{t("生成历史")}</span>
        </button>
      </div>

      {panel === "assets" && (
        <div className="wf-float wf-panel">
          <div className="wf-panel-head">
            {t("素材库")}
            <button className="btn-ghost btn-icon" onClick={() => setPanel(null)}><CloseIcon /></button>
          </div>
          <div className="segmented" style={{ margin: "0 14px 10px" }}>
            <button className={assetTab === "char" ? "active" : ""} onClick={() => setAssetTab("char")}>{t("角色")}</button>
            <button className={assetTab === "scene" ? "active" : ""} onClick={() => setAssetTab("scene")}>{t("场景")}</button>
            <button className={assetTab === "prop" ? "active" : ""} onClick={() => setAssetTab("prop")}>{t("道具")}</button>
          </div>
          <div className="wf-panel-grid">
            {assets.length === 0 && <div className="dim-2" style={{ fontSize: 12, padding: 12 }}>{t("暂无素材,请先到对应库里创建。")}</div>}
            {assets.map((a) => (
              <button
                key={a.id}
                className="wf-asset"
                title={t("添加到画布")}
                onClick={() => addNode("image", undefined, { url: a.url, title: a.name })}
              >
                {a.url ? (
                  <img src={a.url} alt={a.name} draggable={false} />
                ) : (
                  <span className="ph" style={{ background: `linear-gradient(135deg, oklch(55% .12 ${a.hue}), oklch(35% .10 ${a.hue}))` }}>{a.name[0]}</span>
                )}
                <span className="nm">{a.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {panel === "history" && (
        <div className="wf-float wf-panel">
          <div className="wf-panel-head">
            {t("生成历史")}
            <button className="btn-ghost btn-icon" onClick={() => setPanel(null)}><CloseIcon /></button>
          </div>
          <div className="segmented" style={{ margin: "0 14px 10px" }}>
            <button className={histTab === "all" ? "active" : ""} onClick={() => setHistTab("all")}>{t("全部")}</button>
            <button className={histTab === "video" ? "active" : ""} onClick={() => setHistTab("video")}>{t("视频")}</button>
            <button className={histTab === "image" ? "active" : ""} onClick={() => setHistTab("image")}>{t("图片")}</button>
          </div>
          <div className="wf-panel-list">
            {tasksQuery.isLoading && <div className="dim-2" style={{ fontSize: 12, padding: 12 }}>{t("加载中…")}</div>}
            {!tasksQuery.isLoading && tasks.length === 0 && (
              <div className="dim-2" style={{ fontSize: 12, padding: 12 }}>{t("暂无生成记录。")}</div>
            )}
            {tasks.map((tk) => (
              <button
                key={tk.id}
                className="wf-hist"
                onClick={() => tk.output_video_url && addNode("video", undefined, { url: tk.output_video_url, title: tk.id })}
              >
                <span className="th">{tk.output_video_url ? <PlayIcon /> : "—"}</span>
                <span className="meta">
                  <span className="mono id">{tk.id}</span>
                  <span className="dim-2">{tk.resolution} · {tk.video_len_seconds}s · {tk.status}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 右键菜单(分区:本地上传 / 添加节点 / 画布操作)*/}
      {menu && (
        <div className="wf-float wf-menu wf-menu-rich" style={{ left: menu.sx, top: menu.sy }}>
          <div className="wf-mi-sec">{t("本地上传")}</div>
          <button className="wf-mi" onClick={() => { pendingAt.current = { x: menu.wx, y: menu.wy }; setMenu(null); fileRef.current?.click(); }}>
            <span className="ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4m0 0 4 4m-4-4-4 4" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
            </span>
            <span className="tx"><b>{t("上传")}</b><small>{t("支持图片 / 视频 / 音频")}</small></span>
          </button>

          <div className="wf-mi-sec sp">{t("添加节点")}</div>
          <button className="wf-mi" onClick={() => { addNode("text", { x: menu.wx, y: menu.wy }); setMenu(null); }}>
            <span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 6h14M5 6V5m14 1V5M12 6v13M9 19h6" /></svg></span>
            <span className="tx"><b>{t("文本")}</b><small>{t("纯文本素材 / 提示词")}</small></span>
          </button>
          <button className="wf-mi" onClick={() => { addNode("image", { x: menu.wx, y: menu.wy }); setMenu(null); }}>
            <span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.5-3.5L7 22" /></svg></span>
            <span className="tx"><b>{t("图片")} <span className="badge">GPT-Image-2</span></b><small>{t("静态图像素材")}</small></span>
          </button>
          <button className="wf-mi" onClick={() => { addNode("video", { x: menu.wx, y: menu.wy }); setMenu(null); }}>
            <span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="15" height="14" rx="3" /><path d="m17 9 5-3v12l-5-3z" /></svg></span>
            <span className="tx"><b>{t("视频")} <span className="badge">Seedance 2.0</span></b><small>{t("片段、运镜与镜头")}</small></span>
          </button>
          <button className="wf-mi" onClick={() => { addNode("audio", { x: menu.wx, y: menu.wy }); setMenu(null); }}>
            <span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></svg></span>
            <span className="tx"><b>{t("音频")} <span className="badge">Speech 2.8 HD</span></b><small>{t("配音 / 音效 / 音乐")}</small></span>
          </button>
          <button className="wf-mi" onClick={() => { addNode("script", { x: menu.wx, y: menu.wy }); setMenu(null); }}>
            <span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M7 8h10M7 12h10M7 16h6" /></svg></span>
            <span className="tx"><b>{t("剧本分镜头")} <span className="badge">GPT-5.4</span></b><small>{t("剧情文本生成分镜头脚本")}</small></span>
          </button>
          <button className="wf-mi" onClick={() => { addNode("director", { x: menu.wx, y: menu.wy }); setMenu(null); }}>
            <span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 9.5h17v9a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z" /><path d="m3.5 9.5 1-4.2 16.2 2-0.7 2.2" /><path d="m8.2 6 2.4 3M13 6.6l2.4 3" /></svg></span>
            <span className="tx"><b>{t("导演台")} <span className="badge">3D</span></b><small>{t("3D 站位 / 机位 / 姿势编排")}</small></span>
          </button>

          <div className="wf-mi-sep" />
          <div className="wf-mi-row">
            <button className="wf-mi-act" onClick={() => { fitView(); setMenu(null); }}>⤢ {t("适应屏幕")}</button>
            <button className="wf-mi-act" onClick={() => { void doPaste({ x: menu.wx, y: menu.wy }); setMenu(null); }}>▤ {t("粘贴")}</button>
          </div>
        </div>
      )}

      {/* 节点右键菜单 */}
      {nodeMenu && (
        <div className="wf-float wf-menu" style={{ left: nodeMenu.sx, top: nodeMenu.sy }}>
          <button onClick={() => { copyNode(nodeMenu.id); setNodeMenu(null); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
            {t("复制节点")}
          </button>
          <button onClick={() => { cloneNode(nodeMenu.id); setNodeMenu(null); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /><path d="M14.5 12.5v4M12.5 14.5h4" /></svg>
            {t("克隆节点")}
          </button>
          <div className="sep" />
          <button className="danger" onClick={() => { removeNode(nodeMenu.id); setSelected(new Set()); setNodeMenu(null); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></svg>
            {t("删除节点")}
          </button>
        </div>
      )}

      {/* 小地图 */}
      <div className="wf-float wf-minimap">
        <div className="wf-minimap-head">{t("小地图")}</div>
        <div
          className="wf-minimap-body"
          style={{ width: 150, height: 92 }}
          onPointerDown={onMiniDown}
          onPointerMove={onMiniMove}
          onPointerUp={onMiniUp}
        >
          {minimap?.rects.map((rc) => (
            <span key={rc.id} className="nd" style={{ left: rc.x, top: rc.y, width: rc.w, height: rc.h, background: rc.c }} />
          ))}
          {minimap && (
            <span className="vp" style={{ left: minimap.view.x, top: minimap.view.y, width: minimap.view.w, height: minimap.view.h }} />
          )}
          {!minimap && <span className="dim-2" style={{ fontSize: 10, position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>{t("画布为空")}</span>}
        </div>
      </div>

      {/* 底部工具条 */}
      <div className="wf-float wf-tools">
        <div className="wf-tool-seg">
          <button className={cn(tool === "select" && "on")} title={t("选择")} onClick={() => setTool("select")}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l13.5 6.2-5.7 1.9-1.9 5.7z" /></svg>
          </button>
          <button className={cn(tool === "hand" && "on")} title={t("抓手 · 拖移画布")} onClick={() => setTool("hand")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 11V6.6a1.3 1.3 0 0 1 2.6 0V10" />
              <path d="M9.6 10V5a1.3 1.3 0 0 1 2.6 0v5" />
              <path d="M12.2 10.3V6a1.3 1.3 0 0 1 2.6 0v4.4" />
              <path d="M14.8 11V8a1.3 1.3 0 0 1 2.6 0v5.6a5.4 5.4 0 0 1-5.4 5.4h-1a4.4 4.4 0 0 1-3.5-1.8L4.5 14a1.4 1.4 0 0 1 2.1-1.7L8 14" />
            </svg>
          </button>
        </div>
        <span className="wf-tool-div" />
        <button title={t("缩小")} onClick={() => setZoom((z) => Math.max(0.2, z * 0.9))}>−</button>
        <button className="pct" title={t("适应屏幕")} onClick={fitView}>{Math.round(zoom * 100)}%</button>
        <button title={t("放大")} onClick={() => setZoom((z) => Math.min(2, z * 1.1))}>+</button>
        <button title={isFs ? t("退出全屏") : t("画布全屏")} onClick={toggleFullscreen}>
          {isFs ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
          )}
        </button>
        <span className="wf-tool-div" />
        <button className={cn(hideEdges && "on")} title={hideEdges ? t("显示连线") : t("隐藏连线")} onClick={() => setHideEdges((v) => !v)}>
          {hideEdges ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.8 2.8M9.4 5.2A9.7 9.7 0 0 1 12 5c5.5 0 9 7 9 7a16 16 0 0 1-2.6 3.4M6 6.5A16 16 0 0 0 3 12s3.5 7 9 7a9.4 9.4 0 0 0 2.6-.4" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" /><circle cx="12" cy="12" r="2.6" /></svg>
          )}
        </button>
        <span className="wf-tool-div" />
        <button title={t("撤销")} disabled={!canUndo} onClick={undo}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.7 3L3 13" /></svg>
        </button>
        <button title={t("重做")} disabled={!canRedo} onClick={redo}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6.7 3L21 13" /></svg>
        </button>
      </div>

      {/* 空画布引导 */}
      {nodes.length === 0 && (
        <div className="wf-hint">{t("右键空白处添加节点,或从左侧「素材库 / 生成历史」选择素材开始搭建工作流。")}</div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*,audio/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPickFile(f);
          e.target.value = "";
        }}
      />
      <input
        ref={refFileRef}
        type="file"
        accept="image/*,video/*,audio/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          const pr = pendingRef.current;
          if (f && pr) {
            const fr = new FileReader();
            fr.onload = () => setRef(pr.id, pr.key, String(fr.result));
            fr.readAsDataURL(f);
          }
          pendingRef.current = null;
          e.target.value = "";
        }}
      />
      <input
        ref={voiceFileRef}
        type="file"
        accept="audio/*,.mp3,.m4a,.wav"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          const id = pendingVoiceNode.current;
          if (f && id) { addMyVoice(id, f.name.replace(/\.[^.]+$/, "")); setCloneOpen(false); }
          pendingVoiceNode.current = null;
          e.target.value = "";
        }}
      />

      {/* 导演台:全屏 3D 控制台(portal 到 body,场景存档随节点持久化)*/}
      {directorOpen && (() => {
        const n = nodeById(directorOpen);
        if (!n) return null;
        return (
          <DirectorConsole
            initial={n.director}
            onSave={(d) => setNodes((ns) => ns.map((x) => (x.id === n.id ? { ...x, director: d } : x)))}
            onClose={() => setDirectorOpen(null)}
            onExportImage={(url, name) => addNode("image", { x: n.x + SIZE.director.w + 380, y: n.y + 135 }, { url, title: name })}
            onExportShot={(url, name) => {
              // 截图节点挂在导演台右侧,按已连出的数量纵向排开,并自动连线
              const outCount = edges.filter((e) => e.from === n.id).length;
              const id = addNode(
                "image",
                { x: n.x + SIZE.director.w + 420, y: n.y + 135 + outCount * 340 },
                { url, title: `${n.title} ${name}` },
              );
              const eid = `${n.id}->${id}`;
              setEdges((es) => (es.some((x) => x.id === eid) ? es : [...es, { id: eid, from: n.id, to: id }]));
            }}
          />
        );
      })()}
    </div>
  );
}
