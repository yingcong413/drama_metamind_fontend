import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useT, useTf } from "@/lib/i18n";
import type { Character, Project, Scene, Prop } from "@/types";
import { StoryboardWizard, type StoryboardSelection } from "./StoryboardWizard";
import { b64ToFile, chatComplete, generateImage, isMetamindConfigured, type AiUsage, type ChatMessage } from "@/api/metamind";
import { generateAndFill } from "@/lib/aiFill";
import { uploadGlobalImage } from "@/lib/uploadGlobalImage";
import { createCharacter } from "@/api/characters";
import { registerAssetUrl } from "@/api/assets";
import { createScene } from "@/api/scenes";
import { createProp } from "@/api/props";
import { createTask, patchTask } from "@/api/tasks";
import { avatarHue } from "@/lib/avatarHue";
import { cropGridToUrls, gridLayout } from "@/lib/cropGrid";
import { useIsOwner } from "@/stores/auth";
import { useQueryClient } from "@tanstack/react-query";

interface AiPanelProps {
  project: Project;
  setProject: (p: Project) => void;
  characters: Character[];
  scenes: Scene[];
  props: Prop[];
  onCharactersChanged: () => void;
  /**
   * 把分镜头脚本宫格图导入「字段 07 · 分镜头脚本」(global.storyboard_image_url)。
   * 传了 opts.story + opts.count 时,额外按故事自动在分镜层建 count 个分镜(整图 + 自动建分镜);
   * opts.cells 为按格裁切好的每格图 URL(顺序 = 镜号),用于把第 k 格严格配给第 k 个分镜。
   */
  onImportStoryboard?: (
    imageUrl: string,
    opts?: { story?: string; count?: number; cells?: string[] },
  ) => void;
}

type FlowKind = "image" | "text";
type ModelKind = FlowKind;
type FlowId = "character" | "scene" | "prop" | "story" | "storyboard";

// 自由文本里识别「N 宫格分镜头」意图(秦总案例:一段剧情 + “帮我生成一张九宫格的分镜头”)。
// 命中则按宫格数把整段剧情画成分镜头脚本,并支持导入「字段 07」。
function detectStoryboardIntent(text: string): { hit: boolean; grid: number } {
  const hit = /宫格|分镜头|分镜脚本|story\s*board|storyboard/i.test(text);
  let grid = 9;
  const ar = text.match(/(\d{1,2})\s*宫格/);
  const cn = text.match(/([两二三四五六七八九]|十[一二三四五六七八九]?|十)\s*宫格/);
  const CN_NUM: Record<string, number> = {
    两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
    十: 10, 十一: 11, 十二: 12, 十三: 13, 十四: 14, 十五: 15, 十六: 16,
  };
  if (ar) grid = parseInt(ar[1], 10);
  else if (cn) grid = CN_NUM[cn[1]] ?? 9;
  return { hit, grid };
}

// 把一段剧情文本包装成「N 宫格分镜头脚本」出图提示词(秦总案例的处理方式)。
// 明确给出 行×列 网格,方便后续严格按格裁切、逐格配给对应分镜。
function buildStoryboardPromptFromText(story: string, n: number): string {
  const { cols, rows } = gridLayout(n);
  return (
    `把下面这段剧情画成一张 ${n} 宫格的分镜头脚本(storyboard 故事板),` +
    `严格排成 ${rows} 行 × ${cols} 列的等大网格(每格大小一致、对齐规整、格子间留细白边),` +
    `按从左到右、从上到下的顺序,每一格画一个连续的电影镜头并在左上角标注镜号(①②③…),` +
    `分镜草图风格,镜头之间动作连贯、可直接用于拍摄参考。` +
    `画面只画剧情描述的内容,不要添加任何未提及的元素。剧情:${story}`
  );
}
type Ans = Record<string, string | null>;
type TextMode = "choose" | "hasScript" | "noScript";

interface Step {
  key: string;
  q: string;
  opts: string[];
  type?: "lib" | "text";
  source?: "character" | "scene" | "prop";
}
interface FlowDef {
  kind: FlowKind;
  label: string;
  steps: Step[];
}

const MODEL_OPTIONS: Record<ModelKind, string[]> = {
  image: ["GPT-Image-2", "gemini-3-pro-image-preview", "gemini-3.1-flash-image-preview"],
  text: ["GPT-5.5", "Claude Opus-4.8"],
};

const FLOWS: Record<FlowId, FlowDef> = {
  character: {
    kind: "image",
    label: "生成角色",
    steps: [
      { key: "style", q: "想要什么风格的角色？", opts: ["卡通", "二次元", "写实", "国风", "真实"] },
      { key: "gender", q: "角色性别是？", opts: ["男", "女", "不限"] },
      { key: "identity", q: "角色的身份 / 职业是？", opts: ["学生", "上班族", "医生", "警察", "古装侠客", "霸道总裁"] },
      { key: "age", q: "大概的年龄段？", opts: ["少年", "青年", "中年", "老年"] },
      { key: "temper", q: "气质或性格倾向？", opts: ["冷艳", "温柔", "活泼", "阴鸷", "憨厚"] },
    ],
  },
  scene: {
    kind: "image",
    label: "生成场景",
    steps: [
      { key: "place", q: "想生成什么场景？", opts: ["工厂", "学校", "医院", "家庭", "公园", "办公室", "街道", "咖啡馆"] },
      { key: "time", q: "画面是什么时间？", opts: ["白天", "黄昏", "夜晚"] },
      { key: "mood", q: "想要什么氛围？", opts: ["明亮", "温馨", "冷峻", "压抑", "梦幻"] },
    ],
  },
  prop: {
    kind: "image",
    label: "生成道具",
    steps: [
      { key: "ptype", q: "想生成哪类道具？", opts: ["武器", "饰品", "文件", "电子产品", "食物", "其他"] },
      { key: "material", q: "风格或材质？", opts: ["古风", "现代", "金属", "木质", "布艺"] },
      { key: "color", q: "主色调？", opts: ["黑", "白", "金", "红", "蓝", "原木色"] },
    ],
  },
  storyboard: {
    kind: "image",
    label: "生成分镜图",
    steps: [
      { key: "chars", q: "选择角色库", opts: [], type: "lib", source: "character" },
      { key: "scenes", q: "选择场景库", opts: [], type: "lib", source: "scene" },
      { key: "props", q: "选择道具库", opts: [], type: "lib", source: "prop" },
      { key: "content", q: "填写分镜内容", opts: [], type: "text" },
    ],
  },
  story: {
    kind: "text",
    label: "剧情定制",
    steps: [
      { key: "genre", q: "想要一个什么类型的剧？", opts: ["古装", "都市", "悬疑", "校园", "职场", "武侠", "甜宠"] },
      { key: "plot", q: "想要什么样的剧情走向？", opts: ["复仇逆袭", "破镜重圆", "身份反转", "双向暗恋", "悬案侦破", "热血成长"] },
      { key: "lead", q: "主角大概是个什么人？", opts: ["霸道总裁", "侠女", "学生", "打工人", "神秘来客"] },
      { key: "conflict", q: "核心冲突或最大看点是？", opts: ["误会", "背叛", "追逐", "对决", "久别重逢"] },
      { key: "tone", q: "整体情绪基调？", opts: ["紧张", "甜蜜", "热血", "悲情", "爆笑"] },
      { key: "length", q: "想要多长？", opts: ["6 秒", "8 秒", "单集 15 秒", "多分镜连续剧"] },
    ],
  },
};

const ADOPT_MSG: Record<FlowId, string> = {
  character: "✓ 已加入角色库，可在「字段 08 · 角色调用」中选用。",
  scene: "✓ 已加入场景库（全公司可见），并选入本剧「字段 04 · 场景」，可在「场景库」中复用。",
  prop: "✓ 已加入道具库（全公司可见），并选入本剧「字段 06 · 道具」，可在「道具库」中复用。",
  story: "✓ 已写入「字段 09 · 故事内容」。",
  storyboard: "✓ 已导入「字段 07 · 分镜头脚本」，左侧可继续编辑或替换。",
};

// 子账号(Member)无新建素材库权限:生成的场景/道具图只挂到本项目字段,不进共享库。
const MEMBER_SCENE_MSG = "✓ 已挂到本项目「字段 04 · 场景」。共享场景库仅母账号可新建，如需入库请联系母账号。";
const MEMBER_PROP_MSG = "✓ 已挂到本项目「字段 06 · 道具」。共享道具库仅母账号可新建，如需入库请联系母账号。";

const GEN_STATUS: Record<FlowKind, string[]> = {
  image: ["正在理解设定…", "构图与打光…", "渲染画面细节…"],
  text: ["正在构思设定…", "编排分镜节拍…", "润色台词…"],
};

interface Beat {
  n: string;
  text: ReactNode;
}
interface StoryPreset {
  q: string;
  title: string;
  meta: string;
  hook: string;
  beats: Beat[];
}
const TEXT_PRESETS: StoryPreset[] = [
  {
    q: "办公室职场短剧",
    title: "《加班那夜》",
    meta: "都市职场 · 约 8 秒",
    hook: "deadline 前夜，三人小组的暗流与试探。",
    beats: [
      { n: "01", text: "工位特写：女主盯着屏幕，手指悬在「发送」键上方迟疑。" },
      { n: "02", text: "会议室玻璃门后，上司的身影忽明忽暗。" },
      { n: "03", text: "走廊，男主递来一杯咖啡：「还没走？」" },
    ],
  },
  {
    q: "古装武侠片剧情",
    title: "《剑落寒江》",
    meta: "古装武侠 · 约 11 秒",
    hook: "恩怨两清的最后一剑，落在江心。",
    beats: [
      { n: "01", text: "江畔夜雨，女侠负剑而立，发丝被风吹起。" },
      { n: "02", text: "对岸黑衣人按刀，雨幕中只见眼神。" },
      { n: "03", text: "剑光一闪，江面碎成万点寒星。" },
    ],
  },
];

const TITLES: [string, string][] = [
  ["武侠", "《剑落寒江》"],
  ["古装", "《宫阙惊变》"],
  ["悬疑", "《第七通来电》"],
  ["校园", "《夏天的尾声》"],
  ["职场", "《加班那夜》"],
  ["都市", "《雨夜归人》"],
  ["甜宠", "《心动信号》"],
];
const titleFor = (g: string) => {
  for (const [k, t] of TITLES) if ((g || "").includes(k)) return t;
  return "《未命名短剧》";
};

const hueOf = (s: string) => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
};
const summaryOf = (def: FlowDef, ans: Ans) =>
  def.steps.map((s) => ans[s.key] || "AI 匹配").join(" · ");

// 把向导的回答拼成一段中文描述提示词,喂给真实生成后端
const PROMPT_HEAD: Record<FlowId, string> = {
  character: "为短剧生成一张角色参考图,要求:",
  scene: "为短剧生成一张场景参考图,要求:",
  prop: "为短剧生成一张道具参考图,要求:",
  story: "为短剧定制一段剧情与分镜方案,要求:",
  storyboard: "为短剧生成一张分镜头脚本(storyboard),要求:",
};
function buildPrompt(id: FlowId, ans: Ans): string {
  // 分镜头脚本:按所选角色 / 场景 / 道具 + 分镜内容,拼成「N 宫格 + 每格一个连续镜头 + 标镜号」的出图提示词。
  if (id === "storyboard") {
    const n = ans.gridN ? parseInt(ans.gridN, 10) || 9 : 9;
    const { cols, rows } = gridLayout(n);
    const charsPart = ans.chars ? `出场角色:${ans.chars};` : "";
    const scenesPart = ans.scenes ? `场景:${ans.scenes};` : "";
    const propsPart = ans.props ? `关键道具:${ans.props};` : "";
    const contentPart = ans.content ? `分镜内容:${ans.content}。` : "";
    return (
      `生成一张 ${n} 宫格的分镜头脚本(storyboard 故事板),严格排成 ${rows} 行 × ${cols} 列的等大网格,` +
      `每格大小一致、对齐规整、格子间留细白边,按从左到右、从上到下的顺序,` +
      `每一格画一个连续的电影镜头并在左上角标注镜号(①②③…);` +
      `${charsPart}${scenesPart}${propsPart}${contentPart}` +
      `分镜草图风格,镜头之间动作连贯、可直接用于拍摄参考。画面只画分镜内容,不要添加任何未提及的元素。`
    );
  }
  const def = FLOWS[id];
  const parts = def.steps
    .map((s) => {
      const v = ans[s.key];
      if (!v) return null;
      return `${s.q.replace(/[？?]/g, "")}：${v}`;
    })
    .filter(Boolean);
  return PROMPT_HEAD[id] + parts.join("；") + "。";
}

// 文字模型「自由聊天」的系统设定:纯对话,不回填工程、不输出 JSON。
// 想真正填入工作台请走「已有剧本」导入或「没有剧本」向导。
const CHAT_SYSTEM =
  "你是「制影」AI 短剧创作助手。用简洁、友好的中文和用户自由聊天,围绕短剧创作、剧情、分镜、台词、运镜、配音等给建议或灵感。" +
  "这是纯聊天:不要输出 JSON,也不要假装已经把内容写入工程或工作台。" +
  "如果用户希望把内容真正填进工作台,提示他可以用文字模型里的「已有剧本」导入,或「没有剧本」逐步向导。";
// 自由聊天最多带入的历史轮数(user+assistant 各算一条),避免上下文无限增长。
const CHAT_HISTORY_MAX = 20;
// 出图兜底单价:网关没返回 token 用量时,每张图按 0.3 元(30 分)计费。
const IMAGE_FALLBACK_CENTS = 30;

const I = {
  spark: (
    <svg viewBox="0 0 16 16" fill="none" width="13" height="13">
      <path d="M8 2l1.2 3.6L13 7l-3.8 1.4L8 12l-1.2-3.6L3 7l3.8-1.4L8 2z" fill="currentColor" />
    </svg>
  ),
  person: (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
      <circle cx="8" cy="5" r="2.6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M3 13.2c0-2.4 2.2-3.8 5-3.8s5 1.4 5 3.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  scene: (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
      <rect x="2.2" y="3.5" width="11.6" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.6 11l3-3 2.2 2 2.4-2.6L13.4 11" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="6" cy="6.4" r="1" fill="currentColor" />
    </svg>
  ),
  prop: (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
      <path d="M8 2l5.5 3.2v5.6L8 14 2.5 10.8V5.2L8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M8 14V8M2.5 5.2 8 8l5.5-2.8" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ),
  film: (
    <svg viewBox="0 0 16 16" fill="none" width="15" height="15">
      <rect x="2.5" y="3.5" width="11" height="9" rx="1.3" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.5 6.5h11M6 3.5v9M10 3.5v9" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 16 16" fill="none" width="13" height="13">
      <path d="M9.5 4 6 8l3.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  send: (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
      <path d="M8 13V3M4 7l4-4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

function Beats({ beats }: { beats: Beat[] }) {
  return (
    <>
      {beats.map((b, i) => (
        <div className="beat" key={i}>
          <span className="bn">{b.n}</span>
          {b.text}
        </div>
      ))}
    </>
  );
}

type Msg =
  | { id: string; role: "user"; kind: "user"; text: string }
  | { id: string; role: "bot"; kind: "text"; node: ReactNode }
  | { id: string; role: "bot"; kind: "loading" }
  | { id: string; role: "bot"; kind: "genproc"; flowKind: FlowKind; pct: number; status: string; summary: string }
  | { id: string; role: "bot"; kind: "result"; flowId: FlowId; ans: Ans; summary: string; imageUrl?: string; storyText?: string }
  | { id: string; role: "bot"; kind: "free"; freeKind: "image"; text: string }
  | { id: string; role: "bot"; kind: "freeimg"; imageUrl: string; prompt: string; storyboard?: boolean; sbStory?: string; sbGrid?: number }
  | { id: string; role: "bot"; kind: "chat"; text: string };

let seq = 0;
const uid = () => "m" + ++seq;

// 模块级缓存:AI 面板会话按项目 id 保存,切到角色库/其它页再回到工作台不丢内容。
// (仅存活于当前会话内存;含 JSX 节点,不做持久化/刷新保留。)
type Session = { messages: Msg[]; flowId: FlowId | null; flowStep: number; flowAns: Ans };
interface PanelSnapshot {
  model: ModelKind;
  selectedModel: string;
  messages: Msg[];
  input: string;
  flowId: FlowId | null;
  flowStep: number;
  flowAns: Ans;
  sessions: Partial<Record<ModelKind, Session>>;
  chatLog: ChatMessage[];
}
const panelCache = new Map<string, PanelSnapshot>();

function Intro({ model }: { model: ModelKind }): ReactNode {
  const t = useT();
  if (model === "image")
    return (
      <>
        {t("你好，我是生图助手。选一个入口，我会")}
        <strong>{t("一步一步问你几个问题")}</strong>
        {t("，再为你生成参考图：角色加入角色库，场景 / 道具加入对应素材库，并自动选入本剧。")}
      </>
    );
  return (
    <>
      {t("你好，我是剧情助手。你可以")}
      <strong>{t("导入已有剧本")}</strong>
      {t("一键填入全局与分镜，也可以让我")}
      <strong>{t("一步步提问")}</strong>
      {t("帮你从零写出剧本。")}
    </>
  );
}

// localStorage 持久化:只存可序列化的消息(用户输入 / 出图 / 剧情结果),
// 跳过含 JSX 的系统文案(text)与瞬时态(loading/genproc);开场白在恢复时按模型重建。
const LS_PREFIX = "metamind-ai-panel:";
const PERSIST_KINDS = new Set(["user", "result", "free", "freeimg", "chat"]);
const serializableMsgs = (msgs: Msg[]): Msg[] => msgs.filter((m) => PERSIST_KINDS.has(m.kind));
const withIntro = (model: ModelKind, msgs: Msg[]): Msg[] => [
  { id: uid(), role: "bot", kind: "text", node: <Intro model={model} /> },
  ...msgs,
];

function saveLS(key: string, snap: PanelSnapshot) {
  try {
    const data = {
      model: snap.model,
      selectedModel: snap.selectedModel,
      input: snap.input,
      flowId: snap.flowId,
      flowStep: snap.flowStep,
      flowAns: snap.flowAns,
      messages: serializableMsgs(snap.messages),
      sessions: Object.fromEntries(
        Object.entries(snap.sessions).map(([k, s]) => [
          k,
          s ? { ...s, messages: serializableMsgs(s.messages) } : s,
        ]),
      ),
      chatLog: snap.chatLog,
    };
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(data));
  } catch {
    /* 隐私模式 / 配额超限:静默忽略 */
  }
}

function loadLS(key: string): PanelSnapshot | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return null;
    const d = JSON.parse(raw) as {
      model?: ModelKind;
      selectedModel?: string;
      input?: string;
      flowId?: FlowId | null;
      flowStep?: number;
      flowAns?: Ans;
      messages?: Msg[];
      sessions?: Partial<Record<ModelKind, Session>>;
      chatLog?: ChatMessage[];
    };
    const model: ModelKind = d.model ?? "image";
    const sessions: Partial<Record<ModelKind, Session>> = {};
    for (const k of Object.keys(d.sessions ?? {}) as ModelKind[]) {
      const s = d.sessions![k];
      if (s) sessions[k] = { ...s, messages: withIntro(k, s.messages ?? []) };
    }
    return {
      model,
      selectedModel: d.selectedModel ?? MODEL_OPTIONS[model][0],
      input: d.input ?? "",
      flowId: d.flowId ?? null,
      flowStep: d.flowStep ?? 0,
      flowAns: d.flowAns ?? {},
      messages: withIntro(model, d.messages ?? []),
      sessions,
      chatLog: d.chatLog ?? [],
    };
  } catch {
    return null;
  }
}

export function AiPanel({ project, setProject, characters, scenes, props, onCharactersChanged, onImportStoryboard }: AiPanelProps) {
  const t = useT();
  const tf = useTf();
  const configured = isMetamindConfigured();
  const qc = useQueryClient();
  // 会话缓存键:按项目 id。切到角色库等页面再切回工作台时从缓存恢复,不丢生成内容。
  // 同会话内用内存缓存(全保真);跨刷新用 localStorage(只恢复可序列化内容)。
  const cacheKey = project.id || "draft";
  const cached = panelCache.get(cacheKey) ?? loadLS(cacheKey);

  const [model, setModel] = useState<ModelKind>(cached?.model ?? "image");
  const [selectedModel, setSelectedModel] = useState(cached?.selectedModel ?? MODEL_OPTIONS.image[0]);
  const [messages, setMessages] = useState<Msg[]>(cached?.messages ?? []);
  const [input, setInput] = useState(cached?.input ?? "");
  const [textMode, setTextMode] = useState<TextMode>("choose");
  // 点击生成图放大查看(灯箱)
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);

  const [flowId, setFlowId] = useState<FlowId | null>(cached?.flowId ?? null);
  const [flowStep, setFlowStep] = useState(cached?.flowStep ?? 0);
  const [flowAns, setFlowAns] = useState<Ans>(cached?.flowAns ?? {});
  const lastResult = useRef<{ flowId: FlowId; ans: Ans } | null>(null);

  // 每个模型各自保存会话(消息 + 向导状态),切走再切回不丢历史。
  const sessions = useRef<Partial<Record<ModelKind, Session>>>(cached?.sessions ?? {});

  // 始终拿到最新 project,供异步采用回调使用
  const projectRef = useRef(project);
  projectRef.current = project;
  const charSeq = useRef(0);
  const sceneSeq = useRef(0);
  const propSeq = useRef(0);
  // 分镜头脚本整图的 b64(按 url 索引):本会话内裁切宫格时从 b64 裁(同源,不污染 canvas)。
  const sbB64Ref = useRef<Map<string, string>>(new Map());
  // R9:共享素材库只有母账号(Owner)能写;子账号生成的场景/道具图只能挂到本项目字段(不进共享库)。
  const isOwner = useIsOwner();
  // 文字模型自由聊天的上下文(多轮),与「导入/向导」无关,不回填工程。跨刷新从缓存恢复。
  const chatLog = useRef<ChatMessage[]>(cached?.chatLog ?? []);

  // 每次真实 AI 调用(出图/文本)都记一条任务,后端按 token 算费并扣余额,
  // 与视频任务一致地出现在「使用记录」。失败不影响生成体验。
  // 记一条 AI 用量任务到「使用记录」。
  // - 有 token 用量(usage):按 token 让后端算费用并扣费;
  // - 无 token(网关没回 usage,如部分出图模型):用兜底单价 fallbackCents 直接计费。
  async function recordAiTask(
    type: "ai_image" | "ai_text",
    aiModel: string,
    usage: AiUsage | null,
    fallbackCents = 0,
  ) {
    try {
      const created = await createTask({
        project_id: projectRef.current.id,
        type_id: type,
        platform: "metamind",
        upstream_model: aiModel,
      });
      if (usage && (usage.input_tokens > 0 || usage.output_tokens > 0)) {
        await patchTask(created.id, {
          status: "success",
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
        });
      } else if (fallbackCents > 0) {
        await patchTask(created.id, { status: "success", cost_cents: fallbackCents });
      } else {
        await patchTask(created.id, { status: "success" });
      }
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["account"] });
    } catch {
      /* 记录失败不影响生成体验 */
    }
  }

  // 任意状态变化都写回模块级缓存(同会话全保真)+ localStorage(跨刷新恢复)。
  useEffect(() => {
    const snap: PanelSnapshot = { model, selectedModel, messages, input, flowId, flowStep, flowAns, sessions: sessions.current, chatLog: chatLog.current };
    panelCache.set(cacheKey, snap);
    saveLS(cacheKey, snap);
  }, [cacheKey, model, selectedModel, messages, input, flowId, flowStep, flowAns]);

  const bodyRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    return () => {
      timers.current.forEach((id) => {
        window.clearInterval(id);
        window.clearTimeout(id);
      });
    };
  }, []);

  const hint =
    model === "image"
      ? "为角色 / 场景 / 道具生成参考图，或生成分镜图（宫格）：角色入角色库，场景 / 道具入对应素材库，分镜图可导入「字段 07」。"
      : "生成短剧剧情、分镜脚本与台词建议。";

  const placeholder =
    model === "image"
      ? "描述你想生成的角色 / 场景 / 道具…"
      : "回答上面的问题，或自己描述剧情…";

  function freshSession(next: ModelKind): Session {
    return {
      messages: [{ id: uid(), role: "bot", kind: "text", node: <Intro model={next} /> }],
      flowId: null,
      flowStep: 0,
      flowAns: {},
    };
  }

  function switchModel(next: ModelKind) {
    if (next === model) return;
    // 快照当前模型会话,便于切回时恢复
    sessions.current[model] = { messages, flowId, flowStep, flowAns };
    const restored = sessions.current[next] ?? freshSession(next);
    setModel(next);
    setSelectedModel(MODEL_OPTIONS[next][0]);
    setMessages(restored.messages);
    setFlowId(restored.flowId);
    setFlowStep(restored.flowStep);
    setFlowAns(restored.flowAns);
    // 切到文字模型时回到入口分叉(已有剧本 / 没有剧本)
    setTextMode("choose");
  }

  // 文字模型入口分叉:选「没有剧本」直接进向导,「已有剧本」展示上传面板
  function chooseText(mode: TextMode) {
    setTextMode(mode);
    if (mode === "noScript") startFlow("story");
  }

  function backToTextChoose() {
    setFlowId(null);
    setTextMode("choose");
  }

  function setGenproc(mid: string, status: string, pct: number) {
    setMessages((m) => m.map((x) => (x.id === mid && x.kind === "genproc" ? { ...x, status, pct } : x)));
  }
  function failGen(mid: string, err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    setMessages((m) =>
      m.map((x) =>
        x.id === mid
          ? { id: mid, role: "bot", kind: "text", node: <span className="dim">{t("生成失败：") + msg}</span> }
          : x,
      ),
    );
  }

  function startGeneration(id: FlowId, ans: Ans) {
    const def = FLOWS[id];
    const summary =
      id === "storyboard"
        ? [ans.chars, ans.scenes, ans.props, ans.content].filter(Boolean).join(" · ") || t("分镜图")
        : summaryOf(def, ans);
    const mid = uid();
    setMessages((m) => [
      ...m,
      { id: mid, role: "bot", kind: "genproc", flowKind: def.kind, pct: 0, status: GEN_STATUS[def.kind][0], summary },
    ]);

    if (!configured) {
      failGen(mid, new Error(t("未配置 AI 密钥，无法生成。")));
      return;
    }

    const prompt = buildPrompt(id, ans);

    if (def.kind === "image") {
      setGenproc(mid, GEN_STATUS.image[0], 20);
      (async () => {
        let imgUsage: AiUsage | null = null;
        try {
          const b64 = await generateImage(prompt, {
            onStatus: (s) => {
              const pct = s === "success" ? 95 : s === "processing" ? 70 : 40;
              setGenproc(mid, s === "processing" ? GEN_STATUS.image[1] : GEN_STATUS.image[0], pct);
            },
            onUsage: (u) => { imgUsage = u; },
          });
          setGenproc(mid, GEN_STATUS.image[2], 95);
          const file = b64ToFile(b64, `${id}_${Date.now()}.png`);
          const { url } = await uploadGlobalImage(file);
          setMessages((m) =>
            m.map((x) =>
              x.id === mid ? { id: mid, role: "bot", kind: "result", flowId: id, ans, summary, imageUrl: url } : x,
            ),
          );
          // 出图成功才记账:有 token 按 token,无则每张 0.3 元兜底
          void recordAiTask("ai_image", selectedModel, imgUsage, IMAGE_FALLBACK_CENTS);
        } catch (e) {
          failGen(mid, e);
        }
      })();
      return;
    }

    if (def.kind === "text") {
      setGenproc(mid, GEN_STATUS.text[0], 30);
      (async () => {
        try {
          const next = await generateAndFill(projectRef.current, prompt, {
            onUsage: (u) => recordAiTask("ai_text", selectedModel, u),
          });
          setProject(next);
          setMessages((m) =>
            m.map((x) =>
              x.id === mid
                ? { id: mid, role: "bot", kind: "result", flowId: id, ans, summary, storyText: next.global.story }
                : x,
            ),
          );
        } catch (e) {
          failGen(mid, e);
        }
      })();
      return;
    }
  }

  // 建角色 + 把生成图作为「主图」真正上传(注册成角色素材 role=primary),再加入本剧。
  async function addCharacterWithImage(name: string, descPrompt: string, imageUrl: string) {
    const c = await createCharacter({
      name,
      role: "配角",
      desc: descPrompt.slice(0, 200),
      tags: ["AI 生成"],
      ref_image_url: imageUrl,
      ref_images: [imageUrl],
      voice_sample_url: null,
      hue: Math.floor(Math.random() * 360),
    });
    // 生成图已在我们自己的公开 TOS 上,直接用 URL 注册成主图(role_in_bundle=primary),
    // 不再 fetch 文件(避免 TOS CORS 拦截)。失败不阻断建角色。
    try {
      await registerAssetUrl({
        url: imageUrl,
        character_id: c.id,
        kind: "image",
        role_in_bundle: "primary",
        filename: `char_${Date.now()}.png`,
      });
    } catch (e) {
      pushBotText(<span className="dim">{t("主图上传失败：") + (e instanceof Error ? e.message : String(e))}</span>);
    }
    onCharactersChanged();
    const cur = projectRef.current;
    setProject({ ...cur, global: { ...cur.global, characters: [...(cur.global.characters ?? []), c.id] } });
  }

  // 生图的场景图采用:
  //   - 母账号(Owner) → 入「场景库」(createScene,org 级共享,全公司可见),再选进本剧;
  //   - 子账号(Member) → 无建库权限,仅挂到本项目「字段 04 · 场景」(项目内,不进共享库)。
  async function addSceneToLibrary(name: string, imageUrl: string) {
    if (isOwner) {
      const s = await createScene({ name, image_url: imageUrl, hue: avatarHue(name) });
      qc.invalidateQueries({ queryKey: ["scenes"] });
      const cur = projectRef.current;
      const ids = [...(cur.global.scenes ?? [])];
      if (!ids.includes(s.id)) ids.push(s.id);
      const scene_image = ids[0] === s.id ? imageUrl : cur.global.scene_image;
      setProject({ ...cur, global: { ...cur.global, scenes: ids, scene_image } });
      pushBotText(<>{ADOPT_MSG.scene}</>);
    } else {
      const cur = projectRef.current;
      setProject({ ...cur, global: { ...cur.global, scene_image: imageUrl } });
      pushBotText(<>{MEMBER_SCENE_MSG}</>);
    }
  }

  // 生图的道具图采用:同上,母账号入「道具库」共享,子账号仅挂本项目字段。
  async function addPropToLibrary(name: string, imageUrl: string) {
    if (isOwner) {
      const pr = await createProp({ name, image_url: imageUrl, hue: avatarHue(name) });
      qc.invalidateQueries({ queryKey: ["props"] });
      const cur = projectRef.current;
      const ids = [...(cur.global.props ?? [])];
      if (!ids.includes(pr.id)) ids.push(pr.id);
      const prop_image_url = ids[0] === pr.id ? imageUrl : cur.global.prop_image_url;
      setProject({ ...cur, global: { ...cur.global, props: ids, prop_image_url } });
      pushBotText(<>{ADOPT_MSG.prop}</>);
    } else {
      const cur = projectRef.current;
      setProject({ ...cur, global: { ...cur.global, prop_image_url: imageUrl } });
      pushBotText(<>{MEMBER_PROP_MSG}</>);
    }
  }

  // 把生成结果真正挂到项目 / 角色库
  async function adoptResult(
    flowId: FlowId,
    ans: Ans,
    imageUrl: string | undefined,
    storyText: string | undefined,
    name?: string,
  ) {
    const p = projectRef.current;
    if (flowId === "character" && imageUrl) {
      try {
        const fallbackN = characters.length + ++charSeq.current;
        const finalName = (name && name.trim()) || (ans.identity ? `${t(ans.identity)} · AI` : `AI 角色 ${fallbackN}`);
        await addCharacterWithImage(finalName, buildPrompt("character", ans), imageUrl);
      } catch (e) {
        pushBotText(<span className="dim">{t("加入角色库失败：") + (e instanceof Error ? e.message : String(e))}</span>);
        return;
      }
    } else if (flowId === "scene" && imageUrl) {
      try {
        const sName = (name && name.trim()) || (ans.place ? `${t(ans.place)} · AI` : `AI 场景 ${++sceneSeq.current}`);
        await addSceneToLibrary(sName, imageUrl);
      } catch (e) {
        pushBotText(<span className="dim">{t("加入场景库失败：") + (e instanceof Error ? e.message : String(e))}</span>);
        return;
      }
    } else if (flowId === "prop" && imageUrl) {
      try {
        const pName = (name && name.trim()) || (ans.ptype ? `${t(ans.ptype)} · AI` : `AI 道具 ${++propSeq.current}`);
        await addPropToLibrary(pName, imageUrl);
      } catch (e) {
        pushBotText(<span className="dim">{t("加入道具库失败：") + (e instanceof Error ? e.message : String(e))}</span>);
        return;
      }
    } else if (flowId === "storyboard" && imageUrl) {
      // 分镜头脚本宫格图 → 导入「字段 07 · 分镜头脚本」(global.storyboard_image_url)
      onImportStoryboard?.(imageUrl);
    } else if (flowId === "story") {
      // generateAndFill 已写入 global.story;此处确保再应用一次
      if (storyText) setProject({ ...p, global: { ...p.global, story: storyText } });
    }
    // scene / prop 的提示已在 addSceneToLibrary / addPropToLibrary 内按权限分别 push,这里只补其它。
    if (flowId === "character" || flowId === "story" || flowId === "storyboard") {
      pushBotText(<>{ADOPT_MSG[flowId]}</>);
    }
  }

  // 自由出图结果的采用:挂到场景 / 道具 / 角色库
  async function adoptFreeImage(target: "scene" | "prop" | "character", url: string, prompt: string, name?: string) {
    if (target === "scene") {
      try {
        const sName = (name && name.trim()) || `AI 场景 ${++sceneSeq.current}`;
        await addSceneToLibrary(sName, url); // 成功提示已在 helper 内按权限 push
      } catch (e) {
        pushBotText(<span className="dim">{t("加入场景库失败：") + (e instanceof Error ? e.message : String(e))}</span>);
      }
    } else if (target === "prop") {
      try {
        const pName = (name && name.trim()) || `AI 道具 ${++propSeq.current}`;
        await addPropToLibrary(pName, url); // 成功提示已在 helper 内按权限 push
      } catch (e) {
        pushBotText(<span className="dim">{t("加入道具库失败：") + (e instanceof Error ? e.message : String(e))}</span>);
      }
    } else {
      try {
        const finalName = (name && name.trim()) || `AI 角色 ${characters.length + ++charSeq.current}`;
        await addCharacterWithImage(finalName, prompt, url);
        pushBotText(<>{ADOPT_MSG.character}</>);
      } catch (e) {
        pushBotText(<span className="dim">{t("加入角色库失败：") + (e instanceof Error ? e.message : String(e))}</span>);
      }
    }
  }

  // 分镜头脚本导入:
  //   - 仅整图:直接转发,写字段 07。
  //   - 整图 + 自动建分镜:先按 行×列 严格裁切宫格→每格上传,拿到 cells;再连同 story/count 转发,
  //     EditorPage 据此建 N 个分镜并把第 k 格图配给第 k 个分镜。裁切失败则退化为「只建分镜、不配格图」。
  async function importStoryboard(url: string, opts?: { story?: string; count?: number }) {
    if (!(opts?.story && opts?.count)) {
      onImportStoryboard?.(url);
      pushBotText(<>{ADOPT_MSG.storyboard}</>);
      return;
    }
    const count = opts.count;
    pushBotText(<span className="dim">{tf("正在按 {n} 格裁切分镜头脚本并建立分镜…", { n: count })}</span>);
    let cells: string[] = [];
    try {
      const src = sbB64Ref.current.get(url) ?? url; // 优先 b64(同源),退化到公网 URL
      cells = await cropGridToUrls(src, count);
    } catch (e) {
      console.warn("[storyboard] 裁切宫格失败,改为只建分镜不配格图:", e);
      cells = [];
    }
    onImportStoryboard?.(url, { story: opts.story, count, cells });
    pushBotText(
      <>{cells.length
        ? tf("✓ 已导入整图，并裁出 {n} 格分别配给 {n} 个分镜（左侧分镜层可逐格修改）。", { n: count })
        : tf("✓ 已导入整图，并按剧情自动建 {n} 个分镜（格图裁切失败，未逐格配图）。", { n: count })}</>,
    );
  }

  function startFlow(id: FlowId) {
    setFlowId(id);
    setFlowStep(0);
    setFlowAns({});
  }
  function generateStoryboard(sel: StoryboardSelection) {
    const ans: Ans = {
      grid: sel.gridLabel,
      gridN: String(sel.grid),
      chars: sel.chars || null,
      scenes: sel.scenes || null,
      props: sel.props || null,
      content: sel.content || null,
    };
    lastResult.current = { flowId: "storyboard", ans };
    setFlowId(null);
    startGeneration("storyboard", ans);
  }
  function selectOption(val: string | null, skipped: boolean) {
    if (!flowId) return;
    const def = FLOWS[flowId];
    const step = def.steps[flowStep];
    const nextAns = { ...flowAns, [step.key]: skipped ? null : val };
    setFlowAns(nextAns);
    if (flowStep < def.steps.length - 1) {
      setFlowStep((s) => s + 1);
    } else {
      const fid = flowId;
      lastResult.current = { flowId: fid, ans: nextAns };
      setFlowId(null);
      startGeneration(fid, nextAns);
    }
  }
  function gotoStep(i: number) {
    if (!flowId) return;
    setFlowStep(Math.max(0, Math.min(i, FLOWS[flowId].steps.length - 1)));
  }
  function regen() {
    if (lastResult.current) startGeneration(lastResult.current.flowId, lastResult.current.ans);
  }
  function pushBotText(node: ReactNode) {
    setMessages((m) => [...m, { id: uid(), role: "bot", kind: "text", node }]);
  }

  function replaceMsg(id: string, msg: Msg) {
    setMessages((m) => m.map((x) => (x.id === id ? msg : x)));
  }

  function sendPreset(i: number) {
    const p = TEXT_PRESETS[i];
    setMessages((m) => [...m, { id: uid(), role: "user", kind: "user", text: p.q }]);
    // 先给出题材预览卡
    pushBotText(
      <>
        <strong>{p.title}</strong> · {p.meta}
        <br />
        <span className="dim">{p.hook}</span>
        <Beats beats={p.beats} />
      </>,
    );
    if (!configured) {
      pushBotText(<span className="dim">{t("未配置 AI 密钥，无法生成。")}</span>);
      return;
    }
    // 调真实大模型,把题材写进工程(字段 09 故事内容 + 分镜)
    const mid = uid();
    setMessages((m) => [
      ...m,
      { id: mid, role: "bot", kind: "genproc", flowKind: "text", pct: 30, status: GEN_STATUS.text[0], summary: p.q },
    ]);
    const desc = `${p.q}。${p.title}，${p.meta}。${p.hook}`;
    (async () => {
      try {
        const next = await generateAndFill(projectRef.current, desc, {
          onUsage: (u) => recordAiTask("ai_text", selectedModel, u),
        });
        setProject(next);
        replaceMsg(mid, { id: mid, role: "bot", kind: "text", node: <span>{t("✓ 已写入「字段 09 · 故事内容」。")}</span> });
      } catch (e) {
        failGen(mid, e);
      }
    })();
  }

  // 导入已有剧本:把整段剧本喂给真实大模型,忠实整理成结构化分镜并填入工程。
  function importScript(script: string) {
    const v = script.trim();
    if (!v) return;
    setMessages((m) => [
      ...m,
      { id: uid(), role: "user", kind: "user", text: t("【导入剧本】") + v.slice(0, 60) + (v.length > 60 ? "…" : "") },
    ]);
    if (!configured) {
      pushBotText(<span className="dim">{t("未配置 AI 密钥，无法生成。")}</span>);
      return;
    }
    const mid = uid();
    setMessages((m) => [
      ...m,
      { id: mid, role: "bot", kind: "genproc", flowKind: "text", pct: 30, status: GEN_STATUS.text[0], summary: t("导入已有剧本") },
    ]);
    const prompt = t("以下是已有剧本，请忠实整理成结构化分镜，尽量保留原文，不要随意扩写：") + "\n\n" + v;
    (async () => {
      try {
        const next = await generateAndFill(projectRef.current, prompt, {
          onUsage: (u) => recordAiTask("ai_text", selectedModel, u),
        });
        setProject(next);
        replaceMsg(mid, { id: mid, role: "bot", kind: "text", node: <span>{t("✓ 已写入「字段 09 · 故事内容」。")}</span> });
      } catch (e) {
        failGen(mid, e);
      }
    })();
  }

  function freeSend(v: string) {
    setMessages((m) => [...m, { id: uid(), role: "user", kind: "user", text: v }]);
    if (!configured) {
      pushBotText(<span className="dim">{t("未配置 AI 密钥，无法生成。")}</span>);
      return;
    }
    const captured = model;

    const mid = uid();

    if (captured === "image") {
      // 秦总案例:自由文本里带「N 宫格 / 分镜头」→ 识别为分镜头脚本意图,
      // 把整段剧情按宫格数画成 storyboard,并在结果上提供「导入到分镜头脚本」。
      const sb = detectStoryboardIntent(v);
      const imgPrompt = sb.hit ? buildStoryboardPromptFromText(v, sb.grid) : v;
      setMessages((m) => [
        ...m,
        { id: mid, role: "bot", kind: "genproc", flowKind: "image", pct: 20, status: GEN_STATUS.image[0], summary: v },
      ]);
      (async () => {
        let imgUsage: AiUsage | null = null;
        try {
          const b64 = await generateImage(imgPrompt, {
            onStatus: (s) => {
              const pct = s === "success" ? 95 : s === "processing" ? 70 : 40;
              setGenproc(mid, s === "processing" ? GEN_STATUS.image[1] : GEN_STATUS.image[0], pct);
            },
            onUsage: (u) => { imgUsage = u; },
          });
          setGenproc(mid, GEN_STATUS.image[2], 95);
          const file = b64ToFile(b64, `free_${Date.now()}.png`);
          const { url } = await uploadGlobalImage(file);
          // 分镜头脚本:缓存整图 b64(按 url),后续裁切宫格走 b64(同源,不触发 canvas 污染)
          if (sb.hit) sbB64Ref.current.set(url, b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`);
          replaceMsg(mid, { id: mid, role: "bot", kind: "freeimg", imageUrl: url, prompt: imgPrompt, storyboard: sb.hit, sbStory: sb.hit ? v : undefined, sbGrid: sb.hit ? sb.grid : undefined });
          void recordAiTask("ai_image", selectedModel, imgUsage, IMAGE_FALLBACK_CENTS);
        } catch (e) {
          failGen(mid, e);
        }
      })();
      return;
    }

    // text:未选「已有剧本/没有剧本」时的自由输入 = 跟模型聊天(多轮上下文),不回填工程。
    setMessages((m) => [...m, { id: mid, role: "bot", kind: "loading" }]);
    chatLog.current.push({ role: "user", content: v });
    if (chatLog.current.length > CHAT_HISTORY_MAX) {
      chatLog.current = chatLog.current.slice(-CHAT_HISTORY_MAX);
    }
    (async () => {
      try {
        const reply = await chatComplete([{ role: "system", content: CHAT_SYSTEM }, ...chatLog.current], {
          onUsage: (u) => recordAiTask("ai_text", selectedModel, u),
        });
        chatLog.current.push({ role: "assistant", content: reply });
        replaceMsg(mid, { id: mid, role: "bot", kind: "chat", text: reply });
      } catch (e) {
        failGen(mid, e);
      }
    })();
  }

  function onSend() {
    if (!configured) return;
    const v = input.trim();
    if (!v) return;
    setInput("");
    if (flowId === "storyboard") return;
    if (flowId) selectOption(v, false);
    else freeSend(v);
  }

  return (
    <aside className="ai-panel">
      <div className="ai-head">
        <div className="ai-title">
          <span className="ai-spark">{I.spark}</span>
          {t("大模型")}
          <span className="ai-official" role="tooltip">
            {t("官方模型，价格比官方直采低")} <b>10%</b>{t("。")}
          </span>
          <span className="ai-conn mono">
            <span className="ai-dot" />
            {configured ? t("已连接") : t("未配置密钥")}
          </span>
        </div>
        <div className="segmented ai-model">
          {(["image", "text"] as ModelKind[]).map((k) => (
            <button
              key={k}
              type="button"
              className={model === k ? "active" : undefined}
              onClick={() => switchModel(k)}
            >
              {k === "image" ? t("生图模型") : t("文字模型")}
            </button>
          ))}
        </div>
        <label className="ai-modelpick">
          <span className="ai-pick-label mono">{t("选择模型")}</span>
          <select className="select" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
            {MODEL_OPTIONS[model].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <div className="ai-sub">{t(hint)}</div>
      </div>

      <div className="ai-body" ref={bodyRef}>
        {messages.map((m) => (
          <MessageRow key={m.id} msg={m} onAdopt={pushBotText} onAdoptResult={adoptResult} onAdoptImage={adoptFreeImage} onImportStoryboard={importStoryboard} onZoom={setZoomUrl} onRegen={regen} />
        ))}
      </div>

      <QuickArea
        model={model}
        textMode={textMode}
        flowId={flowId}
        flowStep={flowStep}
        flowAns={flowAns}
        characters={characters}
        scenes={scenes}
        props={props}
        onStoryboardGenerate={generateStoryboard}
        onStart={startFlow}
        onCancel={() => {
          setFlowId(null);
          if (model === "text") setTextMode("choose");
        }}
        onSelect={(v) => selectOption(v, false)}
        onSkip={() => selectOption(null, true)}
        onPrev={() => gotoStep(flowStep - 1)}
        onJump={(i) => gotoStep(i)}
        onRestartStory={() => startFlow("story")}
        onPreset={sendPreset}
        onChooseText={chooseText}
        onBackChoose={backToTextChoose}
        onImport={importScript}
      />

      <div className="ai-input">
        <input
          className="input"
          placeholder={t(placeholder)}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSend();
          }}
        />
        <button className="ai-send" title={t("发送")} onClick={onSend} disabled={!configured}>
          {I.send}
        </button>
      </div>
      {!configured && (
        <div className="ai-sub" style={{ padding: "0 12px 8px" }}>
          {t("未配置 AI 密钥：请在 web/.env.local 设置 VITE_METAMIND_API_KEY 后重试。")}
        </div>
      )}
      {zoomUrl && (
        <div
          onClick={() => setZoomUrl(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,.82)",
            display: "grid", placeItems: "center", padding: 24, cursor: "zoom-out",
          }}
        >
          <img
            src={zoomUrl}
            alt={t("放大查看")}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "92vw", maxHeight: "92vh", objectFit: "contain", borderRadius: 8, boxShadow: "0 12px 48px rgba(0,0,0,.5)" }}
          />
          <button
            onClick={() => setZoomUrl(null)}
            title={t("关闭")}
            style={{
              position: "fixed", top: 16, right: 16,
              width: 34, height: 34, borderRadius: "50%", border: "none",
              color: "#fff", background: "rgba(0,0,0,.45)", fontSize: 18, lineHeight: 1, cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      )}
    </aside>
  );
}

type AdoptResultFn = (
  flowId: FlowId,
  ans: Ans,
  imageUrl: string | undefined,
  storyText: string | undefined,
  name?: string,
) => void;

type AdoptImageFn = (target: "scene" | "prop" | "character", url: string, prompt: string, name?: string) => void;
type ImportStoryboardFn = (imageUrl: string, opts?: { story?: string; count?: number }) => void;
type ZoomFn = (url: string) => void;

function MessageRow({
  msg,
  onAdopt,
  onAdoptResult,
  onAdoptImage,
  onImportStoryboard,
  onZoom,
  onRegen,
}: {
  msg: Msg;
  onAdopt: (node: ReactNode) => void;
  onAdoptResult: AdoptResultFn;
  onAdoptImage: AdoptImageFn;
  onImportStoryboard: ImportStoryboardFn;
  onZoom: ZoomFn;
  onRegen: () => void;
}) {
  const t = useT();
  const ava =
    msg.role === "user" ? (
      <div className="ai-ava me">{t("你")}</div>
    ) : (
      <div className="ai-ava bot">{I.spark}</div>
    );
  return (
    <div className={"ai-msg " + (msg.role === "user" ? "user" : "bot")}>
      {ava}
      <div className="ai-bubble">
        <MessageBody msg={msg} onAdopt={onAdopt} onAdoptResult={onAdoptResult} onAdoptImage={onAdoptImage} onImportStoryboard={onImportStoryboard} onZoom={onZoom} onRegen={onRegen} />
      </div>
    </div>
  );
}

function MessageBody({
  msg,
  onAdopt,
  onAdoptResult,
  onAdoptImage,
  onImportStoryboard,
  onZoom,
  onRegen,
}: {
  msg: Msg;
  onAdopt: (node: ReactNode) => void;
  onAdoptResult: AdoptResultFn;
  onAdoptImage: AdoptImageFn;
  onImportStoryboard: ImportStoryboardFn;
  onZoom: ZoomFn;
  onRegen: () => void;
}) {
  const t = useT();
  if (msg.kind === "user") return <>{msg.text}</>;
  if (msg.kind === "text") return <>{msg.node}</>;
  if (msg.kind === "chat") return <span style={{ whiteSpace: "pre-wrap" }}>{msg.text}</span>;
  if (msg.kind === "loading")
    return (
      <span className="ai-dots">
        <i />
        <i />
        <i />
      </span>
    );
  if (msg.kind === "genproc") {
    return (
      <div className="ai-genproc">
        <div className="ai-genproc-canvas">
          <span className="pct mono">{Math.round(msg.pct)}%</span>
        </div>
        <div className="ai-genproc-status">{t(msg.status)}</div>
        <div className="ai-genproc-bar">
          <i style={{ width: msg.pct + "%" }} />
        </div>
        <div className="dim" style={{ fontSize: 11 }}>
          {msg.summary}
        </div>
      </div>
    );
  }
  if (msg.kind === "freeimg") {
    return <FreeImgCard imageUrl={msg.imageUrl} prompt={msg.prompt} storyboard={msg.storyboard} sbStory={msg.sbStory} sbGrid={msg.sbGrid} onAdoptImage={onAdoptImage} onImportStoryboard={onImportStoryboard} onZoom={onZoom} />;
  }
  if (msg.kind === "free") {
    const hue = hueOf(msg.text);
    return (
      <>
        {t("已根据描述生成参考图：")}
        <div className="ai-scene-img" style={{ ["--ph" as string]: hue }}>
          <span>{msg.text.slice(0, 16)}</span>
        </div>
        <div className="ai-gen-actions">
          <button className="btn btn-sm" onClick={() => onAdopt(<>{t("✓ 已采用，可在对应字段查看。")}</>)}>
            {t("采用")}
          </button>
        </div>
      </>
    );
  }
  // result
  return (
    <ResultCard
      flowId={msg.flowId}
      ans={msg.ans}
      summary={msg.summary}
      imageUrl={msg.imageUrl}
      storyText={msg.storyText}
      onAdoptResult={onAdoptResult}
      onZoom={onZoom}
      onRegen={onRegen}
    />
  );
}

function FreeImgCard({
  imageUrl,
  prompt,
  storyboard,
  sbStory,
  sbGrid,
  onAdoptImage,
  onImportStoryboard,
  onZoom,
}: {
  imageUrl: string;
  prompt: string;
  storyboard?: boolean;
  sbStory?: string;
  sbGrid?: number;
  onAdoptImage: AdoptImageFn;
  onImportStoryboard: ImportStoryboardFn;
  onZoom: ZoomFn;
}) {
  const t = useT();
  const tf = useTf();
  const [charName, setCharName] = useState("");
  // 秦总案例:识别为分镜头脚本时,结果给两个入口 ——
  //   ① 只导入整图到「字段 07」;② 整图 + 按故事自动建 N 个分镜(分镜层)。
  if (storyboard) {
    const n = sbGrid ?? 9;
    return (
      <>
        {t("已根据剧情生成分镜图：")}
        <div className="ai-scene-img">
          <img src={imageUrl} alt={t("分镜头脚本")} style={{ cursor: "zoom-in" }} onClick={() => onZoom(imageUrl)} />
        </div>
        <div className="ai-gen-actions">
          <button className="btn btn-sm" onClick={() => onImportStoryboard(imageUrl)}>
            {t("仅导入整图")}
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => onImportStoryboard(imageUrl, { story: sbStory, count: n })}
          >
            {tf("整图 + 自动建 {n} 个分镜", { n })}
          </button>
        </div>
      </>
    );
  }
  return (
    <>
      {t("已根据描述生成参考图：")}
      <div className="ai-scene-img">
        <img src={imageUrl} alt={t("参考图")} style={{ cursor: "zoom-in" }} onClick={() => onZoom(imageUrl)} />
      </div>
      <div className="ai-gen-actions">
        <button className="btn btn-sm" onClick={() => onAdoptImage("scene", imageUrl, prompt)}>
          {t("用作字段 04 场景图")}
        </button>
        <button className="btn btn-sm" onClick={() => onAdoptImage("prop", imageUrl, prompt)}>
          {t("用作字段 06 道具")}
        </button>
      </div>
      <input
        className="input"
        style={{ marginTop: 8, padding: "8px 10px", fontSize: 13 }}
        placeholder={t("给角色起个名字…")}
        value={charName}
        onChange={(e) => setCharName(e.target.value)}
      />
      <div className="ai-gen-actions">
        <button className="btn btn-sm btn-ghost" onClick={() => onAdoptImage("character", imageUrl, prompt, charName)}>
          {t("加入角色库")}
        </button>
      </div>
    </>
  );
}

function ResultCard({
  flowId,
  ans,
  summary,
  imageUrl,
  storyText,
  onAdoptResult,
  onZoom,
  onRegen,
}: {
  flowId: FlowId;
  ans: Ans;
  summary: string;
  imageUrl?: string;
  storyText?: string;
  onAdoptResult: AdoptResultFn;
  onZoom: ZoomFn;
  onRegen: () => void;
}) {
  const t = useT();
  const tf = useTf();
  const [charName, setCharName] = useState("");
  const zoomable = imageUrl
    ? { style: { cursor: "zoom-in" as const }, onClick: () => onZoom(imageUrl) }
    : {};
  const adopt = (label: string) => (
    <button className="btn btn-sm" onClick={() => onAdoptResult(flowId, ans, imageUrl, storyText)}>
      {label}
    </button>
  );
  const regen = (label: string) => (
    <button className="btn btn-sm btn-ghost" onClick={onRegen}>
      {label}
    </button>
  );

  if (flowId === "character") {
    const hue = hueOf((ans.identity || "") + (ans.style || "x"));
    const letter = (ans.identity || "角")[0];
    return (
      <>
        {t("已按你的回答生成角色参考图：")}
        <div className="ai-gen">
          {imageUrl ? (
            <img className="ai-gen-port" src={imageUrl} alt={t("角色参考图")} {...zoomable} />
          ) : (
            <div className="ai-gen-port" style={{ ["--ph" as string]: hue }}>
              {letter}
            </div>
          )}
          <div className="ai-gen-meta">
            <div className="t">{t("新角色 · 待命名")}</div>
            <div className="d">{summary}</div>
          </div>
        </div>
        <input
          className="input"
          style={{ marginTop: 8, padding: "8px 10px", fontSize: 13 }}
          placeholder={t("给角色起个名字…")}
          value={charName}
          onChange={(e) => setCharName(e.target.value)}
        />
        <div className="ai-gen-actions">
          <button
            className="btn btn-sm"
            disabled={!imageUrl}
            onClick={() => onAdoptResult(flowId, ans, imageUrl, storyText, charName)}
          >
            {t("加入角色库")}
          </button>
          {regen(t("重新生成"))}
        </div>
      </>
    );
  }
  if (flowId === "storyboard") {
    return (
      <>
        {tf("已生成「{grid}」分镜图：", { grid: t(ans.grid || "九宫格") })}
        {imageUrl ? (
          <div className="ai-scene-img">
            <img src={imageUrl} alt={t("分镜头脚本")} {...zoomable} />
          </div>
        ) : (
          <div className="ai-scene-img">
            <span>STORYBOARD · {t(ans.grid || "九宫格")}</span>
          </div>
        )}
        <div className="dim" style={{ fontSize: 11, marginTop: 6 }}>
          {summary}
        </div>
        <div className="ai-gen-actions">
          {adopt(t("导入到分镜头脚本"))}
          {regen(t("换一张"))}
        </div>
      </>
    );
  }
  if (flowId === "scene") {
    const hue = hueOf((ans.place || "场景") + (ans.time || ""));
    return (
      <>
        {tf("已生成「{place}」场景参考图：", { place: t(ans.place || "场景") })}
        {imageUrl ? (
          <div className="ai-scene-img">
            <img src={imageUrl} alt={t("场景参考图")} {...zoomable} />
          </div>
        ) : (
          <div className="ai-scene-img" style={{ ["--ph" as string]: hue }}>
            <span>SCENE · {t(ans.place || "AI 匹配")}</span>
          </div>
        )}
        <div className="dim" style={{ fontSize: 11, marginTop: 6 }}>
          {summary}
        </div>
        <div className="ai-gen-actions">
          {adopt(t("用作字段 04 场景图"))}
          {regen(t("换一张"))}
        </div>
      </>
    );
  }
  if (flowId === "prop") {
    const hue = hueOf((ans.ptype || "道具") + (ans.material || ""));
    const letter = (ans.ptype || "道")[0];
    return (
      <>
        {t("已生成道具参考图：")}
        <div className="ai-gen">
          {imageUrl ? (
            <img className="ai-gen-port" src={imageUrl} alt={t("道具参考图")} {...zoomable} />
          ) : (
            <div className="ai-gen-port" style={{ ["--ph" as string]: hue }}>
              {letter}
            </div>
          )}
          <div className="ai-gen-meta">
            <div className="t">{t("道具")} · {t(ans.ptype || "未指定")}</div>
            <div className="d">{summary}</div>
          </div>
        </div>
        <div className="ai-gen-actions">
          {adopt(t("用作字段 06 道具"))}
          {regen(t("重新生成"))}
        </div>
      </>
    );
  }
  if (flowId === "story") {
    const genre = ans.genre || "都市";
    return (
      <>
        <strong>{titleFor(genre)}</strong> · {t(genre)}
        {ans.tone ? " · " + t(ans.tone) : ""} · {t(ans.length || "约 8 秒")}
        <br />
        <span className="dim">{summary}</span>
        {storyText ? (
          <p style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{storyText}</p>
        ) : null}
        <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>
          {t("已为你生成剧情与分镜，并填入工作台。")}
        </div>
        <div className="ai-gen-actions">
          {adopt(t("写入字段 09 故事内容"))}
          {regen(t("重写"))}
        </div>
      </>
    );
  }
  return null;
}

function QuickArea({
  model,
  textMode,
  flowId,
  flowStep,
  flowAns,
  characters,
  scenes,
  props,
  onStoryboardGenerate,
  onStart,
  onCancel,
  onSelect,
  onSkip,
  onPrev,
  onJump,
  onRestartStory,
  onPreset,
  onChooseText,
  onBackChoose,
  onImport,
}: {
  model: ModelKind;
  textMode: TextMode;
  flowId: FlowId | null;
  flowStep: number;
  flowAns: Ans;
  characters: Character[];
  scenes: Scene[];
  props: Prop[];
  onStoryboardGenerate: (sel: StoryboardSelection) => void;
  onStart: (id: FlowId) => void;
  onCancel: () => void;
  onSelect: (v: string) => void;
  onSkip: () => void;
  onPrev: () => void;
  onJump: (i: number) => void;
  onRestartStory: () => void;
  onPreset: (i: number) => void;
  onChooseText: (mode: TextMode) => void;
  onBackChoose: () => void;
  onImport: (script: string) => void;
}) {
  const t = useT();
  const tf = useTf();
  if (flowId === "storyboard") {
    return (
      <StoryboardWizard
        characters={characters}
        scenes={scenes}
        props={props}
        onCancel={onCancel}
        onGenerate={onStoryboardGenerate}
      />
    );
  }
  if (flowId) {
    const def = FLOWS[flowId];
    const step = def.steps[flowStep];
    const cur = flowAns[step.key];
    const last = flowStep === def.steps.length - 1;
    const crumbs = def.steps
      .map((s, i) => {
        if (i === flowStep || !(s.key in flowAns)) return null;
        const v = flowAns[s.key];
        return (
          <button className="ai-ans-chip" key={i} onClick={() => onJump(i)}>
            {i + 1}. {v ? t(v) : t("AI 匹配")}
          </button>
        );
      })
      .filter(Boolean);
    return (
      <div className="ai-quick">
        <div className="ai-qlabel">
          {t(def.label)} · {tf("第 {n} / {total} 问", { n: flowStep + 1, total: def.steps.length })}
          <button className="back" onClick={onCancel}>
            {I.arrow} {t("返回入口")}
          </button>
        </div>
        {crumbs.length > 0 && <div className="ai-ans-row">{crumbs}</div>}
        <div className="ai-q">{t(step.q)}</div>
        <div className="chips ai-flow-chips">
          {step.opts.map((o) => (
            <div className={"chip" + (cur === o ? " selected global" : "")} key={o} onClick={() => onSelect(o)}>
              {t(o)}
            </div>
          ))}
        </div>
        <div className="ai-nav-row">
          <button className="btn btn-sm" disabled={flowStep === 0} onClick={onPrev}>
            ← {t("上一题")}
          </button>
          <button className="btn btn-sm" onClick={onSkip}>
            {t("跳过 · AI 匹配")}
          </button>
          <span className="ai-skiphint">{last ? t("选完即生成") : t("选一项自动下一题")}</span>
        </div>
        <div className="ai-skiphint" style={{ marginTop: 1 }}>
          {t("或在下方输入框自己填写答案")}
        </div>
      </div>
    );
  }

  if (model === "image") {
    return (
      <div className="ai-quick">
        <div className="ai-qlabel">{t("快捷生成 · 点开后逐步提问")}</div>
        <div className="ai-actions">
          <ActionBtn icon={I.person} bg="var(--layer-shot-soft)" fg="var(--layer-shot)" title={t("生成角色")} sub={t("风格 / 性别 / 身份…")} onClick={() => onStart("character")} />
          <ActionBtn icon={I.scene} bg="var(--layer-global-soft)" fg="var(--layer-global)" title={t("生成场景")} sub={t("地点 / 时间 / 氛围")} onClick={() => onStart("scene")} />
          <ActionBtn icon={I.prop} bg="var(--layer-output-soft)" fg="var(--layer-output)" title={t("生成道具")} sub={t("类型 / 材质 / 颜色")} onClick={() => onStart("prop")} />
          <ActionBtn icon={I.film} bg="var(--layer-global-soft)" fg="var(--layer-global)" title={t("生成分镜图")} sub={t("角色 / 场景 / 道具 / 内容")} onClick={() => onStart("storyboard")} />
        </div>
      </div>
    );
  }
  // model === "text"
  if (textMode === "choose") {
    return (
      <div className="ai-quick">
        <div className="ai-qlabel">{t("先选择一种方式开始：")}</div>
        <div className="ai-actions">
          <ActionBtn icon={I.film} bg="var(--layer-global-soft)" fg="var(--layer-global)" title={t("已有剧本")} sub={t("导入剧本，一键填入全局及分镜")} onClick={() => onChooseText("hasScript")} />
          <ActionBtn icon={I.spark} bg="var(--layer-shot-soft)" fg="var(--layer-shot)" title={t("没有剧本")} sub={t("问题引导，一步步写出剧本")} onClick={() => onChooseText("noScript")} />
        </div>
      </div>
    );
  }
  if (textMode === "hasScript") {
    return <ScriptUpload onImport={onImport} onBack={onBackChoose} />;
  }
  return (
    <div className="ai-quick">
      <div className="ai-qlabel">
        {t("想再来一个？")}
        <button className="back" onClick={onBackChoose}>
          {I.arrow} {t("重新选择")}
        </button>
      </div>
      <button className="btn btn-primary ai-gen-btn" onClick={onRestartStory}>
        ↻ {t("重新开始提问")}
      </button>
      <div className="ai-qlabel" style={{ marginTop: 4 }}>
        {t("或直接选现成题材")}
      </div>
      {TEXT_PRESETS.map((p, i) => (
        <button className="ai-preset" key={i} onClick={() => onPreset(i)}>
          <span className="pico">{I.film}</span>
          {p.q}
        </button>
      ))}
    </div>
  );
}

// 已有剧本上传:粘贴文本或上传 .txt(本地读取)/.doc/.docx(只取文件名,无解析器)。
// 「解析并填入」走真实大模型(generateAndFill),把整段剧本忠实整理成结构化分镜并填入工程。
function ScriptUpload({
  onImport,
  onBack,
}: {
  onImport: (script: string) => void;
  onBack: () => void;
}) {
  const t = useT();
  const tf = useTf();
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    // .txt 直接本地读取并填入文本框;.doc/.docx 无解析器,只记录文件名,依赖用户粘贴。
    if (/\.txt$/i.test(f.name)) {
      const reader = new FileReader();
      reader.onload = () => setText(String(reader.result || ""));
      reader.readAsText(f);
    }
    e.target.value = "";
  };

  const canImport = text.trim().length > 0;
  const doImport = () => {
    if (!canImport) return;
    onImport(text);
    setText("");
    setFileName("");
  };

  return (
    <div className="ai-quick">
      <div className="ai-qlabel">
        {t("粘贴剧本，或上传 Word / txt 文件")}
        <button className="back" onClick={onBack}>
          {I.arrow} {t("返回")}
        </button>
      </div>
      <textarea
        className="input"
        style={{ minHeight: 96, resize: "vertical", width: "100%" }}
        placeholder={t("在此粘贴剧本文字…")}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="ai-nav-row">
        <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>
          {t("上传文件")}
        </button>
        <span className="ai-skiphint">
          {fileName ? tf("已选择：{name}", { name: fileName }) : t("支持 .txt / .doc / .docx")}
        </span>
      </div>
      <input ref={fileRef} type="file" accept=".txt,.doc,.docx" hidden onChange={onFile} />
      <button className="btn btn-primary ai-gen-btn" disabled={!canImport} onClick={doImport}>
        {t("解析并填入")}
      </button>
    </div>
  );
}

function ActionBtn({
  icon,
  bg,
  fg,
  title,
  sub,
  onClick,
}: {
  icon: ReactNode;
  bg: string;
  fg: string;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button className="ai-action" onClick={onClick}>
      <span className="ico" style={{ background: bg, color: fg }}>
        {icon}
      </span>
      <span className="lab">
        <b>{title}</b>
        <small>{sub}</small>
      </span>
    </button>
  );
}
