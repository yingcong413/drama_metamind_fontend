import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { ZoomableImage } from "@/components/primitives/ZoomableImage";
import { useT, useTf } from "@/lib/i18n";
import type { Character, Prop, Scene } from "@/types";

type FlowKind = "image" | "text";
type ModelKind = FlowKind;
type FlowId = "character" | "scene" | "prop" | "story";
type Ans = Record<string, string | null>;

interface AiPanelProps {
  characters: Character[];
  scenes: Scene[];
  props: Prop[];
  onImportStoryboard: (script: string) => void;
}

// 宫格数量 → 分镜格数
const GRID_OPTIONS: { label: string; count: number }[] = [
  { label: "六宫格", count: 6 },
  { label: "九宫格", count: 9 },
  { label: "十二宫格", count: 12 },
  { label: "十五宫格", count: 15 },
];

interface StoryboardInputs {
  charNames: string[];
  sceneNames: string[];
  propNames: string[];
  grid: number;
  story: string;
}

const SB_SHOTS = ["大远景", "中景", "近景", "特写", "过肩", "全景", "中近景", "特写", "远景"];
const SB_CAMS = ["缓慢推镜", "固定机位", "轻微跟摇", "对拉", "右摇", "环绕", "手持", "拉镜", "升镜"];
const xmlEsc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// 生成一张分镜头脚本(宫格图)的本地 mock 图片(SVG data URL)。
// 不发请求、不参与最终 prompt;真实后端会返回真实图片 URL。
function buildStoryboardImage(inp: StoryboardInputs): { url: string; meta: string } {
  const cols = 3;
  const rows = Math.max(1, Math.ceil(inp.grid / cols));
  const cw = 300, ch = 196, pad = 18, headH = 70;
  const W = cols * cw + pad * 2;
  const H = headH + rows * ch + pad * 2;

  const cells: string[] = [];
  for (let i = 0; i < inp.grid; i++) {
    const r = Math.floor(i / cols), c = i % cols;
    const x = pad + c * cw, y = headH + pad + r * ch;
    const who = inp.charNames[i % Math.max(1, inp.charNames.length)] || "主角";
    const where = inp.sceneNames[i % Math.max(1, inp.sceneNames.length)] || "主场景";
    const n = String(i + 1).padStart(2, "0");
    cells.push(
      `<g>
        <rect x="${x + 6}" y="${y + 6}" width="${cw - 12}" height="${ch - 12}" rx="8" fill="#1f2430" stroke="#3a4252" stroke-width="1.5"/>
        <text x="${x + 20}" y="${y + 34}" fill="#7dd3fc" font-size="15" font-family="monospace" font-weight="700">镜 ${n}</text>
        <text x="${x + 20}" y="${y + 60}" fill="#e5e7eb" font-size="14">${xmlEsc(SB_SHOTS[i % SB_SHOTS.length])} · ${xmlEsc(SB_CAMS[i % SB_CAMS.length])}</text>
        <text x="${x + 20}" y="${y + ch - 44}" fill="#9ca3af" font-size="13">场景：${xmlEsc(where)}</text>
        <text x="${x + 20}" y="${y + ch - 24}" fill="#9ca3af" font-size="13">出场：${xmlEsc(who)}</text>
      </g>`,
    );
  }

  const title = `分镜头脚本 · ${inp.grid} 宫格`;
  const sub = [
    inp.sceneNames[0] ? `场景：${inp.sceneNames[0]}` : "",
    inp.story.trim() ? `梗概：${inp.story.trim().slice(0, 26)}` : "",
  ].filter(Boolean).join("　");

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" fill="#11151c"/>` +
    `<text x="${pad + 6}" y="34" fill="#ffffff" font-size="21" font-weight="700">${xmlEsc(title)}</text>` +
    `<text x="${pad + 6}" y="57" fill="#9ca3af" font-size="13">${xmlEsc(sub)}</text>` +
    cells.join("") +
    `</svg>`;

  const url = "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  const meta = `${inp.grid} 宫格 · ${inp.charNames.length} 角色 · ${inp.sceneNames.length} 场景`;
  return { url, meta };
}

interface Step {
  key: string;
  q: string;
  opts: string[];
}
interface FlowDef {
  kind: FlowKind;
  label: string;
  steps: Step[];
}

const MODEL_OPTIONS: Record<ModelKind, string[]> = {
  image: ["GPT-Image-2", "Gemini 1.5 Flash Image Preview", "Gemini 1.5 Pro Image Preview"],
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
  scene: "✓ 已挂到「字段 04 · 场景」，左侧该字段已标记完成。",
  prop: "✓ 已挂到「字段 06 · 道具」。",
  story: "✓ 已写入「字段 09 · 故事内容」。",
};

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
  const t = useT();
  return (
    <>
      {beats.map((b, i) => (
        <div className="beat" key={i}>
          <span className="bn">{b.n}</span>
          {typeof b.text === "string" ? t(b.text) : b.text}
        </div>
      ))}
    </>
  );
}

type TextReplyKind = "greeting" | "help" | "thanks" | "idea";

function classifyText(raw: string): TextReplyKind {
  const v = raw.trim().toLowerCase();
  if (
    v.length <= 1 ||
    /^(h(i|ello|ey)+|yo|你好|您好|哈喽|哈啰|嗨|嘿|在吗|在不在|在么|在不|早(上好)?|(上午|中午|下午|晚上)好|good\s*(morning|evening|afternoon|night))[!！.。~\s]*$/i.test(v)
  )
    return "greeting";
  if (/(谢谢|多谢|感谢|辛苦了|thanks|thank\s*you|thx)/i.test(v)) return "thanks";
  if (/(能做什么|会什么|怎么用|如何使用|使用说明|帮助|help|你是谁|有什么功能|功能介绍|怎么开始|不会用)/i.test(v))
    return "help";
  return "idea";
}

function IdeaBeats({ v }: { v: string }) {
  const t = useT();
  const tf = useTf();
  return (
    <Beats
      beats={[
        { n: "01", text: tf("开场：用一个抓人的画面带出「{v}」的核心情境。", { v }) },
        { n: "02", text: t("转折：冲突或反差骤然出现，节奏提速，信息量拉满。") },
        { n: "03", text: t("收束：情绪落点后留一个钩子，引向下一集。") },
      ]}
    />
  );
}

function StreamBubble({
  msg,
  onAdopt,
}: {
  msg: Extract<Msg, { kind: "stream" }>;
  onAdopt: (node: ReactNode) => void;
}) {
  const t = useT();
  return (
    <>
      <span style={{ whiteSpace: "pre-wrap" }}>{msg.full.slice(0, msg.shown)}</span>
      {!msg.done && <span className="ai-caret" />}
      {msg.done && msg.idea != null && (
        <>
          <IdeaBeats v={msg.idea} />
          <div className="ai-gen-actions">
            <button className="btn btn-sm" onClick={() => onAdopt(<>{t("✓ 已写入「字段 09 · 故事内容」。")}</>)}>
              {t("写入字段 09 故事内容")}
            </button>
          </div>
        </>
      )}
    </>
  );
}

function deriveScriptStats(text: string): { shots: number; chars: number } {
  const lines = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  const shots = Math.min(8, Math.max(3, lines.length || 4));
  const chars = Math.max(2, Math.min(5, Math.ceil(shots / 2)));
  return { shots, chars };
}

function ScriptImportResult({
  shots,
  chars,
  onAdopt,
}: {
  shots: number;
  chars: number;
  onAdopt: (node: ReactNode) => void;
}) {
  const t = useT();
  const tf = useTf();
  return (
    <>
      <strong>{t("已解析剧本，识别到以下内容：")}</strong>
      <br />
      <span className="dim">
        {tf("约 {shots} 个分镜、{chars} 位角色，已提取全局设定与故事梗概。", { shots, chars })}
      </span>
      <div className="ai-gen-actions">
        <button
          className="btn btn-sm"
          onClick={() =>
            onAdopt(<>{tf("✓ 已填入全局设定与 {shots} 个分镜，请在左侧逐项检查。", { shots })}</>)
          }
        >
          {t("一键填入全局及分镜")}
        </button>
      </div>
    </>
  );
}

type Msg =
  | { id: string; role: "user"; kind: "user"; text: string }
  | { id: string; role: "bot"; kind: "text"; node: ReactNode }
  | { id: string; role: "bot"; kind: "loading"; label?: string }
  | { id: string; role: "bot"; kind: "genproc"; flowKind: FlowKind; pct: number; status: string; summary: string }
  | { id: string; role: "bot"; kind: "result"; flowId: FlowId; ans: Ans; summary: string }
  | { id: string; role: "bot"; kind: "free"; freeKind: "image"; text: string }
  | { id: string; role: "bot"; kind: "stream"; full: string; shown: number; done: boolean; idea: string | null }
  | { id: string; role: "bot"; kind: "storyboard"; url: string; meta: string };

let seq = 0;
const uid = () => "m" + ++seq;

function Intro({ model }: { model: ModelKind }): ReactNode {
  const t = useT();
  if (model === "image")
    return (
      <>
        {t("你好，我是生图助手。选一个入口，我会")}
        <strong>{t("一步一步问你几个问题")}</strong>
        {t("，再为你生成参考图，可一键挂到对应字段。")}
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

type TextMode = "choose" | "hasScript" | "noScript";

export function AiPanel({ characters, scenes, props, onImportStoryboard }: AiPanelProps) {
  const t = useT();
  const tf = useTf();
  const [model, setModel] = useState<ModelKind>("image");
  const [selectedModel, setSelectedModel] = useState(MODEL_OPTIONS.image[0]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [textMode, setTextMode] = useState<TextMode>("choose");

  const [flowId, setFlowId] = useState<FlowId | null>(null);
  const [flowStep, setFlowStep] = useState(0);
  const [flowAns, setFlowAns] = useState<Ans>({});
  const [storyboardOpen, setStoryboardOpen] = useState(false);
  const lastResult = useRef<{ flowId: FlowId; ans: Ans } | null>(null);
  const lastStoryboard = useRef<StoryboardInputs | null>(null);
  // 最近一次「生成」是普通流程还是分镜头脚本,决定「重新生成」走哪条
  const lastGenKind = useRef<"flow" | "storyboard">("flow");

  const bodyRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    return () => {
      timers.current.forEach((t) => window.clearInterval(t));
    };
  }, []);

  const hint =
    model === "image"
      ? "为角色 / 场景 / 道具生成参考图，可直接挂到对应字段。"
      : "生成短剧剧情、分镜脚本与台词建议。";

  const placeholder =
    model === "image"
      ? "描述你想生成的角色 / 场景 / 道具…"
      : "回答上面的问题，或自己描述剧情…";

  function switchModel(next: ModelKind) {
    setModel(next);
    setSelectedModel(MODEL_OPTIONS[next][0]);
    setFlowId(null);
    setFlowStep(0);
    setFlowAns({});
    setStoryboardOpen(false);
    setTextMode("choose");
    const startMsgs: Msg[] = [{ id: uid(), role: "bot", kind: "text", node: <Intro model={next} /> }];
    setMessages(startMsgs);
  }

  function chooseText(mode: TextMode) {
    setTextMode(mode);
    if (mode === "noScript") startFlow("story");
  }

  function backToTextChoose() {
    setFlowId(null);
    setTextMode("choose");
  }

  function importScript(name: string, shots: number, chars: number) {
    const label = name || t("粘贴的剧本");
    setMessages((m) => [...m, { id: uid(), role: "user", kind: "user", text: tf("导入剧本：{name}", { name: label }) }]);
    const lid = uid();
    setMessages((m) => [...m, { id: lid, role: "bot", kind: "loading" }]);
    const timer = window.setTimeout(() => {
      setMessages((m) =>
        m.map((x) =>
          x.id === lid
            ? { id: lid, role: "bot", kind: "text", node: <ScriptImportResult shots={shots} chars={chars} onAdopt={pushBotText} /> }
            : x,
        ),
      );
    }, 1100);
    timers.current.push(timer);
  }

  function startGeneration(id: FlowId, ans: Ans) {
    lastGenKind.current = "flow";
    const def = FLOWS[id];
    const summary = summaryOf(def, ans);
    const mid = uid();
    setMessages((m) => [
      ...m,
      { id: mid, role: "bot", kind: "genproc", flowKind: def.kind, pct: 0, status: GEN_STATUS[def.kind][0], summary },
    ]);
    let p = 0;
    const steps = GEN_STATUS[def.kind];
    const timer = window.setInterval(() => {
      p = Math.min(100, p + 7 + Math.random() * 9);
      const status = steps[Math.min(steps.length - 1, Math.floor(p / 34))];
      const pct = p;
      setMessages((m) => m.map((x) => (x.id === mid && x.kind === "genproc" ? { ...x, pct, status } : x)));
      if (p >= 100) {
        window.clearInterval(timer);
        timers.current = timers.current.filter((t) => t !== timer);
        const done = window.setTimeout(() => {
          setMessages((m) => m.map((x) => (x.id === mid ? { id: mid, role: "bot", kind: "result", flowId: id, ans, summary } : x)));
        }, 340);
        timers.current.push(done);
      }
    }, 240);
    timers.current.push(timer);
  }

  // 分镜头脚本:跑一段「生成中」动画,完成后落一条 storyboard 结果消息
  function startStoryboardGen(inp: StoryboardInputs) {
    lastGenKind.current = "storyboard";
    lastStoryboard.current = inp;
    const { url, meta } = buildStoryboardImage(inp);
    const mid = uid();
    setMessages((m) => [
      ...m,
      { id: mid, role: "bot", kind: "genproc", flowKind: "image", pct: 0, status: GEN_STATUS.image[0], summary: meta },
    ]);
    let p = 0;
    const steps = GEN_STATUS.image;
    const timer = window.setInterval(() => {
      p = Math.min(100, p + 7 + Math.random() * 9);
      const status = steps[Math.min(steps.length - 1, Math.floor(p / 34))];
      const pct = p;
      setMessages((m) => m.map((x) => (x.id === mid && x.kind === "genproc" ? { ...x, pct, status } : x)));
      if (p >= 100) {
        window.clearInterval(timer);
        timers.current = timers.current.filter((tt) => tt !== timer);
        const done = window.setTimeout(() => {
          setMessages((m) => m.map((x) => (x.id === mid ? { id: mid, role: "bot", kind: "storyboard", url, meta } : x)));
        }, 340);
        timers.current.push(done);
      }
    }, 240);
    timers.current.push(timer);
  }

  function handleStoryboardGenerate(inp: StoryboardInputs) {
    setStoryboardOpen(false);
    const parts = [
      tf("{n} 宫格", { n: inp.grid }),
      inp.charNames.length ? tf("角色：{v}", { v: inp.charNames.join("、") }) : null,
      inp.sceneNames.length ? tf("场景：{v}", { v: inp.sceneNames.join("、") }) : null,
      inp.propNames.length ? tf("道具：{v}", { v: inp.propNames.join("、") }) : null,
    ].filter(Boolean);
    setMessages((m) => [
      ...m,
      { id: uid(), role: "user", kind: "user", text: tf("生成分镜头脚本 · {v}", { v: parts.join(" · ") }) },
    ]);
    startStoryboardGen(inp);
  }

  function startFlow(id: FlowId) {
    setStoryboardOpen(false);
    setFlowId(id);
    setFlowStep(0);
    setFlowAns({});
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
    if (lastGenKind.current === "storyboard" && lastStoryboard.current) {
      startStoryboardGen(lastStoryboard.current);
    } else if (lastResult.current) {
      startGeneration(lastResult.current.flowId, lastResult.current.ans);
    }
  }
  function pushBotText(node: ReactNode) {
    setMessages((m) => [...m, { id: uid(), role: "bot", kind: "text", node }]);
  }

  function sendPreset(i: number) {
    const p = TEXT_PRESETS[i];
    setMessages((m) => [...m, { id: uid(), role: "user", kind: "user", text: t(p.q) }]);
    const lid = uid();
    setMessages((m) => [...m, { id: lid, role: "bot", kind: "loading" }]);
    const timer = window.setTimeout(() => {
      setMessages((m) =>
        m.map((x) =>
          x.id === lid
            ? {
                id: lid,
                role: "bot",
                kind: "text",
                node: (
                  <>
                    <strong>{t(p.title)}</strong> · {t(p.meta)}
                    <br />
                    <span className="dim">{t(p.hook)}</span>
                    <Beats beats={p.beats} />
                  </>
                ),
              }
            : x,
        ),
      );
    }, 1000);
    timers.current.push(timer);
  }

  function streamReply(full: string, idea: string | null) {
    const mid = uid();
    setMessages((m) => [...m, { id: mid, role: "bot", kind: "loading", label: t("正在思考…") }]);
    const startTimer = window.setTimeout(() => {
      setMessages((m) => m.map((x) => (x.id === mid ? { id: mid, role: "bot", kind: "stream", full, shown: 0, done: false, idea } : x)));
      let shown = 0;
      const timer = window.setInterval(() => {
        shown = Math.min(full.length, shown + 2);
        const done = shown >= full.length;
        setMessages((m) => m.map((x) => (x.id === mid && x.kind === "stream" ? { ...x, shown, done } : x)));
        if (done) {
          window.clearInterval(timer);
          timers.current = timers.current.filter((tt) => tt !== timer);
        }
      }, 26);
      timers.current.push(timer);
    }, 650);
    timers.current.push(startTimer);
  }

  function freeSend(v: string) {
    setMessages((m) => [...m, { id: uid(), role: "user", kind: "user", text: v }]);

    if (model === "text") {
      const c = classifyText(v);
      if (c === "idea") {
        streamReply(tf("好的，我按「{v}」帮你拓展一段短剧的分镜：", { v }), v);
      } else if (c === "greeting") {
        streamReply(t("你好！我是剧情助手。直接描述你想要的短剧——题材、主角，或一句话梗概都行，我就帮你拓展成分镜；也可以点下面的选项让我一步步问你。"), null);
      } else if (c === "help") {
        streamReply(t("我可以根据你的想法生成短剧剧情与分镜：给我题材、主角或一句话梗概，我会拓展成「开场 / 转折 / 收束」的分镜。你也可以切到「已有剧本」导入并一键填入。"), null);
      } else {
        streamReply(t("不客气！想继续拓展剧情或调整分镜，随时告诉我。"), null);
      }
      return;
    }

    const lid = uid();
    setMessages((m) => [...m, { id: lid, role: "bot", kind: "loading" }]);
    const timer = window.setTimeout(() => {
      setMessages((m) =>
        m.map((x) => (x.id === lid ? { id: lid, role: "bot", kind: "free", freeKind: "image", text: v } : x)),
      );
    }, 1000);
    timers.current.push(timer);
  }

  function onSend() {
    const v = input.trim();
    if (!v) return;
    setInput("");
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
            {t("已连接")}
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
          <MessageRow
            key={m.id}
            msg={m}
            onAdopt={pushBotText}
            onRegen={regen}
            onImportStoryboard={onImportStoryboard}
          />
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
        storyboardOpen={storyboardOpen}
        onStartStoryboard={() => {
          setFlowId(null);
          setStoryboardOpen(true);
        }}
        onStoryboardGenerate={handleStoryboardGenerate}
        onStoryboardCancel={() => setStoryboardOpen(false)}
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
        <button className="ai-send" title={t("发送")} onClick={onSend}>
          {I.send}
        </button>
      </div>
    </aside>
  );
}

function MessageRow({
  msg,
  onAdopt,
  onRegen,
  onImportStoryboard,
}: {
  msg: Msg;
  onAdopt: (node: ReactNode) => void;
  onRegen: () => void;
  onImportStoryboard: (script: string) => void;
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
        <MessageBody msg={msg} onAdopt={onAdopt} onRegen={onRegen} onImportStoryboard={onImportStoryboard} />
      </div>
    </div>
  );
}

function MessageBody({
  msg,
  onAdopt,
  onRegen,
  onImportStoryboard,
}: {
  msg: Msg;
  onAdopt: (node: ReactNode) => void;
  onRegen: () => void;
  onImportStoryboard: (script: string) => void;
}) {
  const t = useT();
  if (msg.kind === "user") return <>{msg.text}</>;
  if (msg.kind === "text") return <>{msg.node}</>;
  if (msg.kind === "loading")
    return msg.label ? (
      <span className="ai-thinking">
        <span className="ai-thinking-label">{msg.label}</span>
        <span className="ai-dots">
          <i />
          <i />
          <i />
        </span>
      </span>
    ) : (
      <span className="ai-dots">
        <i />
        <i />
        <i />
      </span>
    );
  if (msg.kind === "stream") return <StreamBubble msg={msg} onAdopt={onAdopt} />;
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
  if (msg.kind === "storyboard") {
    return (
      <StoryboardCard
        url={msg.url}
        meta={msg.meta}
        onAdopt={onAdopt}
        onRegen={onRegen}
        onImportStoryboard={onImportStoryboard}
      />
    );
  }
  // result
  return <ResultCard flowId={msg.flowId} ans={msg.ans} summary={msg.summary} onAdopt={onAdopt} onRegen={onRegen} />;
}

function StoryboardCard({
  url,
  meta,
  onAdopt,
  onRegen,
  onImportStoryboard,
}: {
  url: string;
  meta: string;
  onAdopt: (node: ReactNode) => void;
  onRegen: () => void;
  onImportStoryboard: (url: string) => void;
}) {
  const t = useT();
  return (
    <>
      <strong>{t("已生成分镜头脚本图：")}</strong>
      <span className="dim" style={{ marginLeft: 6, fontSize: 11 }}>
        {meta}
      </span>
      <div
        style={{
          marginTop: 8,
          padding: 6,
          background: "#0b0d12",
          border: "1px solid var(--border)",
          borderRadius: 8,
          display: "grid",
          placeItems: "center",
        }}
      >
        <ZoomableImage
          src={url}
          alt={t("分镜头脚本图")}
          style={{ maxWidth: "100%", maxHeight: 260, objectFit: "contain", display: "block" }}
        />
      </div>
      <div className="ai-gen-actions">
        <button
          className="btn btn-sm"
          onClick={() => {
            onImportStoryboard(url);
            onAdopt(<>{t("✓ 已导入到「字段 07 · 分镜头脚本」，左侧可继续编辑或替换。")}</>);
          }}
        >
          {t("导入到分镜头脚本")}
        </button>
        <button className="btn btn-sm btn-ghost" onClick={onRegen}>
          {t("重新生成")}
        </button>
      </div>
    </>
  );
}

function ResultCard({
  flowId,
  ans,
  summary,
  onAdopt,
  onRegen,
}: {
  flowId: FlowId;
  ans: Ans;
  summary: string;
  onAdopt: (node: ReactNode) => void;
  onRegen: () => void;
}) {
  const t = useT();
  const tf = useTf();
  const adopt = (label: string) => (
    <button className="btn btn-sm" onClick={() => onAdopt(<>{ADOPT_MSG[flowId]}</>)}>
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
          <div className="ai-gen-port" style={{ ["--ph" as string]: hue }}>
            {letter}
          </div>
          <div className="ai-gen-meta">
            <div className="t">{t("新角色 · 待命名")}</div>
            <div className="d">{summary}</div>
          </div>
        </div>
        <div className="ai-gen-actions">
          {adopt(t("加入角色库"))}
          {regen(t("重新生成"))}
        </div>
      </>
    );
  }
  if (flowId === "scene") {
    const hue = hueOf((ans.place || "场景") + (ans.time || ""));
    return (
      <>
        {tf("已生成「{place}」场景参考图：", { place: t(ans.place || "场景") })}
        <div className="ai-scene-img" style={{ ["--ph" as string]: hue }}>
          <span>SCENE · {t(ans.place || "AI 匹配")}</span>
        </div>
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
          <div className="ai-gen-port" style={{ ["--ph" as string]: hue }}>
            {letter}
          </div>
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
  // story
  const genre = ans.genre || "都市";
  const lead = ans.lead || "主角";
  return (
    <>
      <strong>{titleFor(genre)}</strong> · {t(genre)}
      {ans.tone ? " · " + t(ans.tone) : ""} · {t(ans.length || "约 8 秒")}
      <br />
      <span className="dim">{summary}</span>
      <Beats
        beats={[
          { n: "01", text: `开场：建立${lead}的处境，${genre}氛围铺陈。` },
          { n: "02", text: `转折：${ans.conflict || "冲突"}爆发，进入「${ans.plot || "反转"}」的关键一刻。` },
          { n: "03", text: `收束：${ans.tone || "情绪"}落点，留一个钩子引向下一集。` },
        ]}
      />
      <div className="ai-gen-actions">
        {adopt(t("写入字段 09 故事内容"))}
        {regen(t("重写"))}
      </div>
    </>
  );
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
  storyboardOpen,
  onStartStoryboard,
  onStoryboardGenerate,
  onStoryboardCancel,
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
  storyboardOpen: boolean;
  onStartStoryboard: () => void;
  onStoryboardGenerate: (inp: StoryboardInputs) => void;
  onStoryboardCancel: () => void;
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
  onImport: (name: string, shots: number, chars: number) => void;
}) {
  const t = useT();
  const tf = useTf();
  if (storyboardOpen) {
    return (
      <StoryboardForm
        characters={characters}
        scenes={scenes}
        props={props}
        onGenerate={onStoryboardGenerate}
        onCancel={onStoryboardCancel}
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
          <ActionBtn icon={I.film} bg="var(--layer-global-soft)" fg="var(--layer-global)" title={t("生成分镜头脚本")} sub={t("角色 / 场景 / 道具 / 宫格")} onClick={onStartStoryboard} />
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
          {t(p.q)}
        </button>
      ))}
    </div>
  );
}

function ScriptUpload({
  onImport,
  onBack,
}: {
  onImport: (name: string, shots: number, chars: number) => void;
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
    if (/\.txt$/i.test(f.name)) {
      const reader = new FileReader();
      reader.onload = () => setText(String(reader.result || ""));
      reader.readAsText(f);
    }
    e.target.value = "";
  };

  const canImport = text.trim().length > 0 || fileName.length > 0;
  const doImport = () => {
    if (!canImport) return;
    const { shots, chars } = deriveScriptStats(text);
    onImport(fileName, shots, chars);
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

function PickRow({
  label,
  empty,
  items,
  selected,
  onToggle,
}: {
  label: string;
  empty: string;
  items: { id: string; name: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div style={{ marginTop: 8 }}>
      <div className="ai-q">{label}</div>
      {items.length === 0 ? (
        <div className="ai-skiphint">{empty}</div>
      ) : (
        <div className="chips ai-flow-chips">
          {items.map((it) => (
            <div
              className={"chip" + (selected.includes(it.id) ? " selected global" : "")}
              key={it.id}
              onClick={() => onToggle(it.id)}
            >
              {it.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StoryboardForm({
  characters,
  scenes,
  props,
  onGenerate,
  onCancel,
}: {
  characters: Character[];
  scenes: Scene[];
  props: Prop[];
  onGenerate: (inp: StoryboardInputs) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [charIds, setCharIds] = useState<string[]>([]);
  const [sceneIds, setSceneIds] = useState<string[]>([]);
  const [propIds, setPropIds] = useState<string[]>([]);
  const [grid, setGrid] = useState(9);
  const [story, setStory] = useState("");

  const toggle = (ids: string[], set: (v: string[]) => void, id: string) =>
    set(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  const namesFrom = (list: { id: string; name: string }[], ids: string[]) =>
    ids.map((id) => list.find((x) => x.id === id)?.name).filter((n): n is string => !!n);

  const generate = () =>
    onGenerate({
      charNames: namesFrom(characters, charIds),
      sceneNames: namesFrom(scenes, sceneIds),
      propNames: namesFrom(props, propIds),
      grid,
      story,
    });

  return (
    <div className="ai-quick">
      <div className="ai-qlabel">
        {t("生成分镜头脚本 · 选好素材后一键生成")}
        <button className="back" onClick={onCancel}>
          {I.arrow} {t("返回入口")}
        </button>
      </div>

      <PickRow
        label={t("角色 · 选角色库中的角色")}
        empty={t("角色库暂无角色")}
        items={characters}
        selected={charIds}
        onToggle={(id) => toggle(charIds, setCharIds, id)}
      />
      <PickRow
        label={t("场景 · 选场景库中的场景")}
        empty={t("场景库暂无场景")}
        items={scenes}
        selected={sceneIds}
        onToggle={(id) => toggle(sceneIds, setSceneIds, id)}
      />
      <PickRow
        label={t("道具 · 选道具库中的道具")}
        empty={t("道具库暂无道具")}
        items={props}
        selected={propIds}
        onToggle={(id) => toggle(propIds, setPropIds, id)}
      />

      <div className="ai-q" style={{ marginTop: 8 }}>{t("宫格数量")}</div>
      <div className="chips ai-flow-chips">
        {GRID_OPTIONS.map((g) => (
          <div
            className={"chip" + (grid === g.count ? " selected global" : "")}
            key={g.count}
            onClick={() => setGrid(g.count)}
          >
            {t(g.label)}
          </div>
        ))}
      </div>

      <div className="ai-q" style={{ marginTop: 8 }}>{t("故事内容")}</div>
      <textarea
        className="input"
        style={{ minHeight: 80, resize: "vertical", width: "100%" }}
        placeholder={t("简单描述这段短剧的故事内容…")}
        value={story}
        onChange={(e) => setStory(e.target.value)}
      />

      <button className="btn btn-primary ai-gen-btn" style={{ marginTop: 10 }} onClick={generate}>
        {t("生成分镜头脚本")}
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
