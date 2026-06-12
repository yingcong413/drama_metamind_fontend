import { useState } from "react";
import type { Character, Scene, Prop } from "@/types";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n";
import { gridLayout } from "@/lib/cropGrid";

interface Item {
  id: string;
  name: string;
  image: string | null;
  hue: number;
}

export interface StoryboardSelection {
  grid: number;       // 宫格数(6 / 9 / 12 / 15)
  gridLabel: string;  // 「九宫格」等中文标签
  chars: string;
  scenes: string;
  props: string;
  content: string;
}

interface Props {
  characters: Character[];
  scenes: Scene[];
  props: Prop[];
  onCancel: () => void;
  onGenerate: (sel: StoryboardSelection) => void;
}

const STEP_TITLES = ["选择宫格数", "选择角色库", "选择场景库", "选择道具库", "填写分镜内容"];
const GRID_OPTS: { n: number; label: string }[] = [
  { n: 6, label: "六宫格" },
  { n: 9, label: "九宫格" },
  { n: 12, label: "十二宫格" },
  { n: 15, label: "十五宫格" },
];
const TOTAL = STEP_TITLES.length;

export function StoryboardWizard({ characters, scenes, props, onCancel, onGenerate }: Props) {
  const t = useT();
  const [step, setStep] = useState(0);
  const [grid, setGrid] = useState(9);
  const [selChars, setSelChars] = useState<string[]>([]);
  const [selScenes, setSelScenes] = useState<string[]>([]);
  const [selProps, setSelProps] = useState<string[]>([]);
  const [content, setContent] = useState("");

  const charItems: Item[] = characters.map((c) => ({ id: c.id, name: c.name, image: c.ref_image_url, hue: c.hue }));
  const sceneItems: Item[] = scenes.map((s) => ({ id: s.id, name: s.name, image: s.image_url, hue: s.hue }));
  const propItems: Item[] = props.map((p) => ({ id: p.id, name: p.name, image: p.image_url, hue: p.hue }));

  // step 1/2/3 → 角色 / 场景 / 道具
  const picks: Array<{ items: Item[]; sel: string[]; setSel: (v: string[]) => void; empty: string }> = [
    { items: charItems, sel: selChars, setSel: setSelChars, empty: "角色库暂无角色，可先去角色库创建" },
    { items: sceneItems, sel: selScenes, setSel: setSelScenes, empty: "场景库暂无场景，可先去场景库创建" },
    { items: propItems, sel: selProps, setSel: setSelProps, empty: "道具库暂无道具，可先去道具库创建" },
  ];

  const isGrid = step === 0;
  const isPick = step >= 1 && step <= 3;
  const last = step === TOTAL - 1;
  const pick = isPick ? picks[step - 1] : null;

  const finish = () => {
    const namesOf = (items: Item[], ids: string[]) =>
      items.filter((i) => ids.includes(i.id)).map((i) => i.name).join("、");
    onGenerate({
      grid,
      gridLabel: GRID_OPTS.find((g) => g.n === grid)?.label ?? "九宫格",
      chars: namesOf(charItems, selChars),
      scenes: namesOf(sceneItems, selScenes),
      props: namesOf(propItems, selProps),
      content: content.trim(),
    });
  };

  return (
    <div className="ai-quick">
      <div className="ai-qlabel">
        {t("生成分镜图")} · {t("第")} {step + 1} / {TOTAL} {t("步")}
        <button className="back" onClick={onCancel}>← {t("返回入口")}</button>
      </div>

      <div className="sbw-steps">
        {STEP_TITLES.map((s, i) => (
          <span key={i} className={cn("sbw-step", i === step && "active", i < step && "done")}>
            {i + 1}. {t(s)}
          </span>
        ))}
      </div>

      {isGrid ? (
        <>
          <div className="ai-q">
            {t("选择宫格数")}
            <span className="sbw-hint">{t("（一张分镜图分成几格）")}</span>
          </div>
          <div className="sbw-grids">
            {GRID_OPTS.map((g) => {
              const { cols, rows } = gridLayout(g.n);
              return (
                <button
                  key={g.n}
                  className={cn("sbw-gridopt", grid === g.n && "selected")}
                  onClick={() => setGrid(g.n)}
                >
                  <span
                    className="sbw-gridicon"
                    style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
                  >
                    {Array.from({ length: g.n }).map((_, k) => <i key={k} />)}
                  </span>
                  <span className="sbw-name">{t(g.label)}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : isPick && pick ? (
        <>
          <div className="ai-q">
            {t(STEP_TITLES[step])}
            <span className="sbw-hint">{t("（可多选，可跳过）")}</span>
          </div>
          {pick.items.length === 0 ? (
            <div className="sbw-empty">{t(pick.empty)}</div>
          ) : (
            <div className="sbw-grid">
              {pick.items.map((it) => {
                const on = pick.sel.includes(it.id);
                return (
                  <button
                    key={it.id}
                    className={cn("sbw-tile", on && "selected")}
                    onClick={() => pick.setSel(on ? pick.sel.filter((x) => x !== it.id) : [...pick.sel, it.id])}
                  >
                    <span className="sbw-thumb" style={it.image ? undefined : { background: `oklch(58% .13 ${it.hue})` }}>
                      {it.image ? <img src={it.image} alt={it.name} /> : it.name.slice(0, 1)}
                      {on && <span className="sbw-check">✓</span>}
                    </span>
                    <span className="sbw-name">{it.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="ai-q">{t("填写分镜内容")}</div>
          <textarea
            className="textarea"
            rows={5}
            placeholder={t("描述这组分镜要表现的剧情、动作、镜头与节奏…")}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </>
      )}

      <div className="ai-nav-row">
        <button className="btn btn-sm" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          ← {t("上一步")}
        </button>
        {last ? (
          <button className="btn btn-primary btn-sm" onClick={finish}>✨ {t("生成分镜图")}</button>
        ) : (
          <button className="btn btn-sm" onClick={() => setStep((s) => s + 1)}>{t("下一步")} →</button>
        )}
      </div>
    </div>
  );
}
