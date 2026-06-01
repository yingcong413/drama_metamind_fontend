import { useEffect, useRef, useState, type ReactNode } from "react";
import { useT, useTf } from "@/lib/i18n";

type FlowKind = "image" | "text" | "voice";
type ModelKind = FlowKind;
type FlowId =
  | "character"
  | "scene"
  | "prop"
  | "story"
  | "voiceCast"
  | "voiceAmb"
  | "voiceBgm";
type Ans = Record<string, string | null>;

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
  voice: [
    "GPT-Voice-1（OpenAI）",
    "GPT-4o Audio TTS（OpenAI）",
    "Gemini 1.5 Flash TTS（Google）",
    "Google Cloud TTS · Neural2（Google）",
  ],
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
  voiceCast: {
    kind: "voice",
    label: "角色配音",
    steps: [
      { key: "tone", q: "想要什么音色？", opts: ["男声", "女声", "童声", "旁白音", "老年音"] },
      { key: "emotion", q: "配音的情绪是？", opts: ["平静", "紧张", "悲伤", "愤怒", "俏皮"] },
      { key: "speed", q: "语速快慢？", opts: ["慢", "适中", "快"] },
    ],
  },
  voiceAmb: {
    kind: "voice",
    label: "环境音效",
    steps: [
      { key: "sfx", q: "想要什么环境音效？", opts: ["风声", "雨声", "虫鸣", "脚步声", "打斗声", "市集喧闹"] },
      { key: "intensity", q: "音效强度？", opts: ["轻微", "适中", "强烈"] },
    ],
  },
  voiceBgm: {
    kind: "voice",
    label: "背景音乐",
    steps: [
      { key: "style", q: "想要什么风格的背景音乐？", opts: ["古风", "紧张", "温馨", "悬疑", "热血", "悲情"] },
      { key: "emotion", q: "情绪走向？", opts: ["渐强", "平稳", "起伏"] },
      { key: "tempo", q: "节奏快慢？", opts: ["慢", "中速", "快"] },
    ],
  },
};

const VOICE_META: Record<string, { target: string; dur: string }> = {
  voiceCast: { target: "旁白音频", dur: "0:06" },
  voiceAmb: { target: "环境音效", dur: "0:08" },
  voiceBgm: { target: "背景音乐", dur: "0:30" },
};

const ADOPT_MSG: Record<FlowId, string> = {
  character: "✓ 已加入角色库，可在「字段 08 · 角色调用」中选用。",
  scene: "✓ 已挂到「字段 04 · 场景」，左侧该字段已标记完成。",
  prop: "✓ 已挂到「字段 06 · 道具」。",
  story: "✓ 已写入「字段 09 · 故事内容」。",
  voiceCast: "✓ 已挂到「字段 15 · 旁白音频」。",
  voiceAmb: "✓ 已挂到「字段 11 · 环境音效」。",
  voiceBgm: "✓ 已挂到「字段 14 · 背景音乐」，已开启背景音乐开关。",
};

const GEN_STATUS: Record<FlowKind, string[]> = {
  image: ["正在理解设定…", "构图与打光…", "渲染画面细节…"],
  voice: ["正在解析音色…", "合成语音波形…", "渲染并降噪…"],
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

function waveHeights(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const h = 30 + Math.round(Math.abs(Math.sin(i * 0.8)) * 55 + ((i * 13) % 20));
    out.push(Math.max(14, Math.min(96, h)));
  }
  return out;
}

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
  mic: (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
      <rect x="6" y="2" width="4" height="7" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4 7v1a4 4 0 008 0V7M8 12v2M5.5 14h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  sfx: (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
      <path d="M8 4 5 6H3v4h2l3 2V4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M11 6.3a2.6 2.6 0 010 3.4M13 5a5 5 0 010 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  music: (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
      <path d="M6 12V4l7-1.5V10" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="4.3" cy="12" r="1.8" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="11.3" cy="10" r="1.8" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ),
  play: (
    <svg viewBox="0 0 16 16" fill="none" width="13" height="13">
      <path d="M5 3.5v9l7-4.5-7-4.5z" fill="currentColor" />
    </svg>
  ),
  send: (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
      <path d="M8 13V3M4 7l4-4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

function AudioCard({ dur }: { dur: string }) {
  return (
    <div className="ai-audio">
      <button className="ai-audio-play">{I.play}</button>
      <div className="ai-wave">
        {waveHeights(30).map((h, i) => (
          <i key={i} style={{ height: h + "%" }} />
        ))}
      </div>
      <span className="ai-audio-time mono">{dur}</span>
    </div>
  );
}

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

function FreeTextResult({ v }: { v: string }) {
  const t = useT();
  return (
    <>
      <strong>{t("已为你拓展该构思")}</strong>
      <br />
      <span className="dim">「{v}」</span>
      <Beats
        beats={[
          { n: "01", text: "开场：建立人物与处境，一个抓人的动作。" },
          { n: "02", text: "转折：冲突或反差出现，节奏提速。" },
          { n: "03", text: "收束：留一个钩子，引向下一集。" },
        ]}
      />
    </>
  );
}

type Msg =
  | { id: string; role: "user"; kind: "user"; text: string }
  | { id: string; role: "bot"; kind: "text"; node: ReactNode }
  | { id: string; role: "bot"; kind: "loading" }
  | { id: string; role: "bot"; kind: "genproc"; flowKind: FlowKind; pct: number; status: string; summary: string }
  | { id: string; role: "bot"; kind: "result"; flowId: FlowId; ans: Ans; summary: string }
  | { id: string; role: "bot"; kind: "free"; freeKind: "image" | "voice"; text: string };

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
  if (model === "text")
    return (
      <>
        {t("你好，我是剧情助手。我来")}
        <strong>{t("一个一个问题")}</strong>
        {t("问你，逐步定制短剧剧情。每题都可以点「跳过」让我自由发挥，也可以直接在下方自己输入。")}
      </>
    );
  return (
    <>
      {t("你好，我是配音助手。选一个入口，我会")}
      <strong>{t("逐步提问")}</strong>
      {t("，再为你合成配音 / 音效 / 背景音乐。")}
    </>
  );
}

export function AiPanel() {
  const t = useT();
  const [model, setModel] = useState<ModelKind>("image");
  const [selectedModel, setSelectedModel] = useState(MODEL_OPTIONS.image[0]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");

  const [flowId, setFlowId] = useState<FlowId | null>(null);
  const [flowStep, setFlowStep] = useState(0);
  const [flowAns, setFlowAns] = useState<Ans>({});
  const lastResult = useRef<{ flowId: FlowId; ans: Ans } | null>(null);

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
      : model === "text"
      ? "生成短剧剧情、分镜脚本与台词建议。"
      : "为角色台词 / 旁白生成配音，并合成环境音效与背景音乐。";

  const placeholder =
    model === "image"
      ? "描述你想生成的角色 / 场景 / 道具…"
      : model === "text"
      ? "回答上面的问题，或自己描述剧情…"
      : "描述你想要的配音音色 / 音效 / 音乐…";

  function switchModel(next: ModelKind) {
    setModel(next);
    setSelectedModel(MODEL_OPTIONS[next][0]);
    setFlowId(null);
    setFlowStep(0);
    setFlowAns({});
    const startMsgs: Msg[] = [{ id: uid(), role: "bot", kind: "text", node: <Intro model={next} /> }];
    setMessages(startMsgs);
    if (next === "text") {
      setFlowId("story");
      setFlowStep(0);
      setFlowAns({});
    }
  }

  function startGeneration(id: FlowId, ans: Ans) {
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

  function startFlow(id: FlowId) {
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
    if (lastResult.current) startGeneration(lastResult.current.flowId, lastResult.current.ans);
  }
  function pushBotText(node: ReactNode) {
    setMessages((m) => [...m, { id: uid(), role: "bot", kind: "text", node }]);
  }

  function sendPreset(i: number) {
    const p = TEXT_PRESETS[i];
    setMessages((m) => [...m, { id: uid(), role: "user", kind: "user", text: p.q }]);
    const lid = uid();
    setMessages((m) => [...m, { id: lid, role: "bot", kind: "loading" }]);
    const t = window.setTimeout(() => {
      setMessages((m) =>
        m.map((x) =>
          x.id === lid
            ? {
                id: lid,
                role: "bot",
                kind: "text",
                node: (
                  <>
                    <strong>{p.title}</strong> · {p.meta}
                    <br />
                    <span className="dim">{p.hook}</span>
                    <Beats beats={p.beats} />
                  </>
                ),
              }
            : x,
        ),
      );
    }, 1000);
    timers.current.push(t);
  }

  function freeSend(v: string) {
    setMessages((m) => [...m, { id: uid(), role: "user", kind: "user", text: v }]);
    const lid = uid();
    setMessages((m) => [...m, { id: lid, role: "bot", kind: "loading" }]);
    const captured = model;
    const t = window.setTimeout(() => {
      setMessages((m) =>
        m.map((x) => {
          if (x.id !== lid) return x;
          if (captured === "image") return { id: lid, role: "bot", kind: "free", freeKind: "image", text: v };
          if (captured === "voice") return { id: lid, role: "bot", kind: "free", freeKind: "voice", text: v };
          return {
            id: lid,
            role: "bot",
            kind: "text",
            node: <FreeTextResult v={v} />,
          };
        }),
      );
    }, 1000);
    timers.current.push(t);
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
          {(["image", "text", "voice"] as ModelKind[]).map((k) => (
            <button
              key={k}
              type="button"
              className={model === k ? "active" : undefined}
              onClick={() => switchModel(k)}
            >
              {k === "image" ? t("生图模型") : k === "text" ? t("文字模型") : t("语音模型")}
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
          <MessageRow key={m.id} msg={m} onAdopt={pushBotText} onRegen={regen} />
        ))}
      </div>

      <QuickArea
        model={model}
        flowId={flowId}
        flowStep={flowStep}
        flowAns={flowAns}
        onStart={startFlow}
        onCancel={() => setFlowId(null)}
        onSelect={(v) => selectOption(v, false)}
        onSkip={() => selectOption(null, true)}
        onPrev={() => gotoStep(flowStep - 1)}
        onJump={(i) => gotoStep(i)}
        onRestartStory={() => startFlow("story")}
        onPreset={sendPreset}
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
}: {
  msg: Msg;
  onAdopt: (node: ReactNode) => void;
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
        <MessageBody msg={msg} onAdopt={onAdopt} onRegen={onRegen} />
      </div>
    </div>
  );
}

function MessageBody({
  msg,
  onAdopt,
  onRegen,
}: {
  msg: Msg;
  onAdopt: (node: ReactNode) => void;
  onRegen: () => void;
}) {
  const t = useT();
  if (msg.kind === "user") return <>{msg.text}</>;
  if (msg.kind === "text") return <>{msg.node}</>;
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
        {msg.flowKind === "voice" ? (
          <div className="ai-genproc-wave">
            {waveHeights(28).map((h, i) => (
              <i key={i} style={{ height: h + "%" }} />
            ))}
          </div>
        ) : (
          <div className="ai-genproc-canvas">
            <span className="pct mono">{Math.round(msg.pct)}%</span>
          </div>
        )}
        <div className="ai-genproc-status">{msg.flowKind === "voice" ? t("合成中…") : t(msg.status)}</div>
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
        {msg.freeKind === "image" ? (
          <>
            {t("已根据描述生成参考图：")}
            <div className="ai-scene-img" style={{ ["--ph" as string]: hue }}>
              <span>{msg.text.slice(0, 16)}</span>
            </div>
          </>
        ) : (
          <>
            {t("已根据描述合成音频：")}
            <AudioCard dur="0:06" />
          </>
        )}
        <div className="ai-gen-actions">
          <button className="btn btn-sm" onClick={() => onAdopt(<>{t("✓ 已采用，可在对应字段查看。")}</>)}>
            {t("采用")}
          </button>
        </div>
      </>
    );
  }
  // result
  return <ResultCard flowId={msg.flowId} ans={msg.ans} summary={msg.summary} onAdopt={onAdopt} onRegen={onRegen} />;
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
  if (flowId === "story") {
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
  // voice*
  const meta = VOICE_META[flowId];
  return (
    <>
      {tf("已合成音频（{summary}）：", { summary })}
      <AudioCard dur={meta.dur} />
      <div className="ai-gen-actions">
        {adopt(tf("用作 {target}", { target: t(meta.target) }))}
        {regen(t("重新生成"))}
      </div>
    </>
  );
}

function QuickArea({
  model,
  flowId,
  flowStep,
  flowAns,
  onStart,
  onCancel,
  onSelect,
  onSkip,
  onPrev,
  onJump,
  onRestartStory,
  onPreset,
}: {
  model: ModelKind;
  flowId: FlowId | null;
  flowStep: number;
  flowAns: Ans;
  onStart: (id: FlowId) => void;
  onCancel: () => void;
  onSelect: (v: string) => void;
  onSkip: () => void;
  onPrev: () => void;
  onJump: (i: number) => void;
  onRestartStory: () => void;
  onPreset: (i: number) => void;
}) {
  const t = useT();
  const tf = useTf();
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
        </div>
      </div>
    );
  }
  if (model === "voice") {
    return (
      <div className="ai-quick">
        <div className="ai-qlabel">{t("配音 / 音效 · 点开后逐步提问")}</div>
        <div className="ai-actions">
          <ActionBtn icon={I.mic} bg="var(--layer-shot-soft)" fg="var(--layer-shot)" title={t("角色配音")} sub={t("音色 / 情绪 / 语速")} onClick={() => onStart("voiceCast")} />
          <ActionBtn icon={I.sfx} bg="var(--layer-global-soft)" fg="var(--layer-global)" title={t("环境音效")} sub={t("类型 / 强度")} onClick={() => onStart("voiceAmb")} />
          <ActionBtn icon={I.music} bg="var(--layer-output-soft)" fg="var(--layer-output)" title={t("背景音乐")} sub={t("风格 / 情绪 / 节奏")} onClick={() => onStart("voiceBgm")} />
        </div>
      </div>
    );
  }
  return (
    <div className="ai-quick">
      <div className="ai-qlabel">{t("想再来一个？")}</div>
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
