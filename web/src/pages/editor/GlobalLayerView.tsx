import { useEffect, useState, type ReactNode } from "react";
import { Tag } from "@/components/primitives/Tag";
import { LayerChip } from "@/components/primitives/LayerChip";
import { ChevronIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { FIELD_DEFS, MODULE_HELPS, GLOBAL_GROUPS, type FieldDef } from "@/lib/fieldDefs";
import { useT } from "@/lib/i18n";
import type { Character, GlobalLayer, OutputLayer, Prop, Scene } from "@/types";
import { FScene } from "./fields/FScene";
import { FPosition } from "./fields/FPosition";
import { FProp } from "./fields/FProp";
import { FStoryboard } from "./fields/FStoryboard";
import { FStyle } from "./fields/FStyle";
import { FCharacters } from "./fields/FCharacters";
import { FStory } from "./fields/FStory";
import { FImageQuality } from "./fields/FImageQuality";
import { FConstraint } from "./fields/FConstraint";
import { FAmbientSfx } from "./fields/FAmbientSfx";
import { FSubtitle } from "./fields/FSubtitle";
import { FToggle } from "./fields/FToggle";
import { FNarrationAudio } from "./fields/FNarrationAudio";
import { FDuration } from "./fields/FDuration";
import { FRatio } from "./fields/FRatio";
import { FResolution } from "./fields/FResolution";

interface Props {
  global: GlobalLayer;
  setGlobal: (g: GlobalLayer) => void;
  output: OutputLayer;
  setOutput: (o: OutputLayer) => void;
  characters: Character[];
  scenes: Scene[];
  props: Prop[];
  onAutoGenShots: () => void;
  scrollAnchor?: string | null;
}

// 每组的布局/默认展开(分组与顺序来自共享的 GLOBAL_GROUPS)
const LAYOUT: Record<string, { layout: "grid" | "stack"; defaultOpen: boolean }> = {
  basic: { layout: "grid", defaultOpen: true },
  material: { layout: "stack", defaultOpen: true },
  other: { layout: "stack", defaultOpen: false },
};
// 成对并排显示的字段(每对占一行):站位图+分镜头脚本 / 环境音效+旁白音频 / 字幕+背景音乐
const PAIRS: [string, string][] = [
  ["position", "storyboard"],
  ["ambientSfx", "narrationAudio"],
  ["subtitle", "music"],
];

const DEF: Record<string, FieldDef> = Object.fromEntries(FIELD_DEFS.global.map((f) => [f.id, f]));

// 把一列字段整理成「行」:PAIRS 里相邻的两个字段并到同一行(数组),其余各自成行。
function toRows(fields: FieldDef[]): (FieldDef | FieldDef[])[] {
  const rows: (FieldDef | FieldDef[])[] = [];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    const next = fields[i + 1];
    if (next && PAIRS.some(([a, b]) => a === f.id && b === next.id)) {
      rows.push([f, next]);
      i++;
    } else {
      rows.push(f);
    }
  }
  return rows;
}

export function GlobalLayerView({ global, setGlobal, output, setOutput, characters, scenes, props, onAutoGenShots, scrollAnchor }: Props) {
  const activeId = scrollAnchor && scrollAnchor.startsWith("g-") ? scrollAnchor.slice(2) : null;
  const t = useT();
  const renderField = (id: string) => {
    const g = { value: global, set: setGlobal };
    const o = { value: output, set: setOutput };
    switch (id) {
      case "duration":   return <FDuration {...g} />;
      case "ratio":      return <FRatio {...g} />;
      case "resolution": return <FResolution {...g} />;
      case "scene":      return <FScene {...g} scenes={scenes} />;
      case "position":   return <FPosition {...g} />;
      case "prop":       return <FProp {...g} props={props} />;
      case "storyboard": return <FStoryboard {...g} />;
      case "style":      return <FStyle {...g} />;
      case "characters": return <FCharacters {...g} characters={characters} />;
      case "story":      return <FStory {...g} onAutoGenShots={onAutoGenShots} />;
      case "imageQuality": return <FImageQuality {...g} />;
      case "constraint": return <FConstraint {...g} />;
      case "ambientSfx": return <FAmbientSfx {...o} />;
      case "subtitle":   return <FSubtitle {...o} />;
      case "generateAudio": return <FToggle {...o} k="generate_audio" on="开启" off="关闭" defaultLabel="on" />;
      case "music":      return <FToggle {...o} k="music" />;
      case "narrationAudio": return <FNarrationAudio {...g} />;
    }
    return null;
  };

  const compactCell = (f: FieldDef) => (
    <div key={f.id} className="lg-cell" data-anchor={"g-" + f.id}>
      <div className="lg-cell-head">
        <span className="num-badge global">{f.num}</span>
        <h3>{t(f.title)}</h3>
        <div className="layer-section-tags">{f.tags.map((tg, i) => <Tag key={i} kind={tg} />)}</div>
      </div>
      {renderField(f.id)}
    </div>
  );

  const fullSection = (f: FieldDef) => (
    <div
      key={f.id}
      className={`layer-section${f.tags.includes("req") ? " required" : ""}`}
      data-anchor={"g-" + f.id}
    >
      <div className="layer-section-head">
        <span className="num-badge global">{f.num}</span>
        <div style={{ flex: 1 }}>
          <h2>
            {t(f.title)}
            {f.tags.includes("req") && <span className="dot-req" style={{ marginLeft: 8 }} />}
          </h2>
          <div className="sub">{t(MODULE_HELPS["g." + f.id])}</div>
        </div>
        <div className="layer-section-tags">{f.tags.map((tg, i) => <Tag key={i} kind={tg} />)}</div>
      </div>
      <div className="layer-section-body">{renderField(f.id)}</div>
    </div>
  );

  return (
    <div className="main-content">
      <div className="layer-header" data-anchor="g-top">
        <div className="layer-header-row">
          <LayerChip layer="global" />
        </div>
        <h1>{t("填一次，贯穿整支视频")}</h1>
        <div className="dim" style={{ fontSize: 13, marginTop: 4 }}>
          {t("这里的设置作用于整个片段。完成后再编辑下方的分镜，场景、角色、字幕、背景音乐等不需要在每个分镜重复填写。")}
        </div>
      </div>

      <div className="lg-groups" style={{ marginTop: 24 }}>
        {GLOBAL_GROUPS.map((grp) => {
          const fields = grp.ids.map((id) => DEF[id]).filter(Boolean) as FieldDef[];
          const conf = LAYOUT[grp.key] ?? { layout: "stack", defaultOpen: true };
          const forceOpen = activeId != null && grp.ids.includes(activeId);
          return (
            <Group key={grp.key} title={t(grp.title)} count={fields.length} defaultOpen={conf.defaultOpen} forceOpen={forceOpen}>
              {conf.layout === "grid" ? (
                <div className="lg-grid">{fields.map(compactCell)}</div>
              ) : (
                <div className="field-stack">
                  {toRows(fields).map((row, i) =>
                    Array.isArray(row)
                      ? <div className="lg-row2" key={i}>{row.map(fullSection)}</div>
                      : fullSection(row),
                  )}
                </div>
              )}
            </Group>
          );
        })}
      </div>
    </div>
  );
}

function Group({ title, count, defaultOpen, forceOpen, children }: { title: string; count: number; defaultOpen: boolean; forceOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { if (forceOpen) setOpen(true); }, [forceOpen]);
  return (
    <div className="lg-group">
      <button type="button" className="lg-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className={cn("lg-chev", open && "open")}><ChevronIcon /></span>
        <span className="lg-title">{title}</span>
        <span className="lg-count">{count}</span>
      </button>
      {open && <div className="lg-body">{children}</div>}
    </div>
  );
}
