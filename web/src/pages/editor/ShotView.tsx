import { CopyIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { LayerChip } from "@/components/primitives/LayerChip";
import { filledShotCount } from "@/lib/validators";
import type { Character, Project, Shot } from "@/types";
import { SubCard } from "./SubCard";
import { PrevContext } from "./PrevContext";
import { FShotCast } from "./fields/FShotCast";
import { FAction } from "./fields/FAction";
import { FMicro } from "./fields/FMicro";
import { FGesture } from "./fields/FGesture";
import { FCamera } from "./fields/FCamera";
import { FSpeech } from "./fields/FSpeech";
import { FSfx } from "./fields/FSfx";

interface Props {
  shot: Shot;
  shotIndex: number;
  project: Project;
  setShot: (s: Shot) => void;
  characters: Character[];
  addShot: () => void;
  duplicateShot: () => void;
  deleteShot: () => void;
  prevShot: Shot | null;
  isFirst: boolean;
  onJumpToField5: () => void;
}

export function ShotView({
  shot, shotIndex, project, setShot, characters,
  addShot, duplicateShot, deleteShot, prevShot, isFirst, onJumpToField5,
}: Props) {
  const projectChars = project.global.characters ?? [];

  return (
    <div className="main-content">
      <div className="module-head">
        <span className="num-badge shot">分镜 {String(shotIndex + 1).padStart(2, "0")}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              className="input"
              style={{
                fontSize: 22, fontWeight: 600, padding: "2px 6px",
                maxWidth: 320, background: "transparent", border: "none",
              }}
              value={shot.name}
              onChange={(e) => setShot({ ...shot, name: e.target.value })}
            />
          </h1>
          <div className="sub">一个连续动作单元 · 编辑此分镜将不影响其他分镜</div>
          <div className="tags">
            <LayerChip layer="shot" />
            <span className="dim-2 mono" style={{ fontSize: 11 }}>
              {filledShotCount(shot)} / 8 已填
            </span>
            <span className="dim-2 mono" style={{ fontSize: 11 }}>
              出场 {(shot.cast_ids ?? []).length} 人
            </span>
          </div>
        </div>
        <div className="meta">
          <button className="btn btn-sm" onClick={duplicateShot}><CopyIcon /> 复制</button>
          <button className="btn btn-sm" onClick={addShot}><PlusIcon /> 添加</button>
          <button
            className="btn btn-sm"
            onClick={deleteShot}
            title="删除分镜"
            style={{ color: "oklch(72% .15 25)" }}
          >
            <TrashIcon /> 删除
          </button>
        </div>
      </div>

      {!isFirst && prevShot && <PrevContext shotIndex={shotIndex} prev={prevShot} />}

      <div className="field-stack">
        <SubCard
          anchor={`s-${shot.id}-cast`}
          num="00" title="本分镜出场角色"
          tags={["req"]} required
          help="从已加入本剧的角色中，选择会在这一分镜出场的角色。这一步决定了下方台词、内心独白可以指派给哪些角色。"
        >
          <FShotCast
            value={shot} set={setShot}
            projectChars={projectChars}
            characters={characters}
            onJumpToField5={onJumpToField5}
          />
        </SubCard>

        <SubCard
          anchor={`s-${shot.id}-action`}
          num="10" title="角色动作"
          tags={["req"]} required
          example="林夏从沙发上起身（起点）→ 走向窗边（过程）→ 推开窗户深呼吸（结束）"
          help="拆成「起点 → 过程 → 结束」三段。注意保持骨骼运动的连贯性。"
        >
          <FAction value={shot} set={setShot} />
        </SubCard>

        <SubCard
          anchor={`s-${shot.id}-micro`}
          num="11" title="微表情控制"
          tags={["opt"]}
          help="眼神、神态、情绪三个维度的细颗粒控制，可独立填写。"
        >
          <FMicro value={shot} set={setShot} />
        </SubCard>

        <SubCard
          anchor={`s-${shot.id}-gesture`}
          num="12" title="小动作控制"
          tags={["opt"]}
          help="不易在主动作中体现的细节，如手指动作、轻微呼吸、眨眼。"
        >
          <FGesture value={shot} set={setShot} />
        </SubCard>

        <SubCard
          anchor={`s-${shot.id}-camera`}
          num="13" title="摄像机运动"
          tags={["opt"]}
          help="选择本分镜采用的运镜方式，可多选叠加。每个运镜可独立调整速度、幅度、方向。"
        >
          <FCamera value={shot} set={setShot} />
        </SubCard>

        <SubCard
          anchor={`s-${shot.id}-lines`}
          num="14" title="台词"
          tags={["opt", "audio"]}
          help="角色出口的对白。角色限制在本分镜「出场角色」中。"
        >
          <FSpeech
            value={shot} set={setShot}
            kind="lines"
            characters={characters}
            accentVar="--info"
            shotCharOptions={shot.cast_ids}
          />
        </SubCard>

        <SubCard
          anchor={`s-${shot.id}-mono`}
          num="15" title="内心独白"
          tags={["opt", "audio"]}
          help="角色的画外心声，与台词在视觉上区分。"
        >
          <FSpeech
            value={shot} set={setShot}
            kind="mono"
            characters={characters}
            accentVar="--audio"
            shotCharOptions={shot.cast_ids}
          />
        </SubCard>

        <SubCard
          anchor={`s-${shot.id}-narration`}
          num="16" title="旁白"
          tags={["opt", "audio"]}
          help="不绑定特定角色的叙述声。"
        >
          <FSpeech
            value={shot} set={setShot}
            kind="narration"
            characters={characters}
            bindCharacter={false}
            accentVar="--success"
          />
        </SubCard>

        <SubCard
          anchor={`s-${shot.id}-sfx`}
          num="17" title="关键动作音效"
          tags={["opt"]}
          help="主要动作产生的瞬间音效，与全局层「环境音效」区别开。"
        >
          <FSfx value={shot} set={setShot} />
        </SubCard>
      </div>
    </div>
  );
}
