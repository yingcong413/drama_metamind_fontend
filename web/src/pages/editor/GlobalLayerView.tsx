import { Tag } from "@/components/primitives/Tag";
import { LayerChip } from "@/components/primitives/LayerChip";
import { FIELD_DEFS, MODULE_HELPS } from "@/lib/fieldDefs";
import type { Character, GlobalLayer, OutputLayer } from "@/types";
import { FScene } from "./fields/FScene";
import { FPosition } from "./fields/FPosition";
import { FStyle } from "./fields/FStyle";
import { FCharacters } from "./fields/FCharacters";
import { FStory } from "./fields/FStory";
import { FAmbientSfx } from "./fields/FAmbientSfx";
import { FSubtitle } from "./fields/FSubtitle";
import { FToggle } from "./fields/FToggle";
import { FNarrationAudio } from "./fields/FNarrationAudio";
import { FDuration } from "./fields/FDuration";

interface Props {
  global: GlobalLayer;
  setGlobal: (g: GlobalLayer) => void;
  output: OutputLayer;
  setOutput: (o: OutputLayer) => void;
  characters: Character[];
}

export function GlobalLayerView({ global, setGlobal, output, setOutput, characters }: Props) {
  const renderField = (id: string) => {
    const g = { value: global, set: setGlobal };
    const o = { value: output, set: setOutput };
    switch (id) {
      case "duration":   return <FDuration {...g} />;
      case "scene":      return <FScene {...g} />;
      case "position":   return <FPosition {...g} />;
      case "style":      return <FStyle {...g} />;
      case "characters": return <FCharacters {...g} characters={characters} />;
      case "story":      return <FStory {...g} />;
      case "ambientSfx": return <FAmbientSfx {...o} />;
      case "subtitle":   return <FSubtitle {...o} />;
      case "music":      return <FToggle {...o} k="music" />;
      case "narrationAudio": return <FNarrationAudio {...g} />;
    }
    return null;
  };

  return (
    <div className="main-content">
      <div className="layer-header" data-anchor="g-top">
        <div className="layer-header-row">
          <LayerChip layer="global" />
        </div>
        <h1>填一次，贯穿整支视频</h1>
        <div className="dim" style={{ fontSize: 13, marginTop: 4 }}>
          这里的设置作用于整个片段。完成后再编辑下方的分镜，场景、角色、字幕、背景音乐等不需要在每个分镜重复填写。
        </div>
      </div>

      <div className="field-stack" style={{ marginTop: 24 }}>
        {FIELD_DEFS.global.map((f) => (
          <div
            key={f.id}
            className={`layer-section${f.tags.includes("req") ? " required" : ""}`}
            data-anchor={"g-" + f.id}
          >
            <div className="layer-section-head">
              <span className="num-badge global">{f.num}</span>
              <div style={{ flex: 1 }}>
                <h2>
                  {f.title}
                  {f.tags.includes("req") && <span className="dot-req" style={{ marginLeft: 8 }} />}
                </h2>
                <div className="sub">{MODULE_HELPS["g." + f.id]}</div>
              </div>
              <div className="layer-section-tags">
                {f.tags.map((t, i) => <Tag key={i} kind={t} />)}
              </div>
            </div>
            <div className="layer-section-body">{renderField(f.id)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
