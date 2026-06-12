import { CopyIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { LayerChip } from "@/components/primitives/LayerChip";
import { ZoomButton } from "@/components/primitives/ZoomableImage";
import { isLoadableUrl } from "@/lib/format";
import { useT, useTf } from "@/lib/i18n";
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
import { FShotDuration } from "./fields/FShotDuration";
import { FShotSize } from "./fields/FShotSize";

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
  const t = useT();
  const tf = useTf();

  return (
    <div className="main-content">
      <div className="module-head">
        <span className="num-badge shot">{t("分镜")} {String(shotIndex + 1).padStart(2, "0")}</span>
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
          <div className="sub">{t("一个连续动作单元 · 编辑此分镜将不影响其他分镜")}</div>
          <div className="tags">
            <LayerChip layer="shot" />
            <span className="dim-2 mono" style={{ fontSize: 11 }}>
              {tf("{n} / 8 已填", { n: filledShotCount(shot) })}
            </span>
            <span className="dim-2 mono" style={{ fontSize: 11 }}>
              {tf("出场 {n} 人", { n: (shot.cast_ids ?? []).length })}
            </span>
          </div>
        </div>
        <div className="meta">
          <button className="btn btn-sm" onClick={duplicateShot}><CopyIcon /> {t("复制")}</button>
          <button className="btn btn-sm" onClick={addShot}><PlusIcon /> {t("添加")}</button>
          <button
            className="btn btn-sm"
            onClick={deleteShot}
            title={t("删除分镜")}
            style={{ color: "oklch(72% .15 25)" }}
          >
            <TrashIcon /> {t("删除")}
          </button>
        </div>
      </div>

      {!isFirst && prevShot && <PrevContext shotIndex={shotIndex} prev={prevShot} />}

      <div className="field-stack">
        {/* 第一行：分镜描述 + 分镜时长分配 */}
        <div className="lg-row2">
          <SubCard
            anchor={`s-${shot.id}-description`}
            num="17" title="分镜描述"
            tags={["opt"]}
            help="用一句话描述这一镜整体在讲什么 / 画面是什么，会拼进本镜 prompt 的开头。例如「雨夜街头，女主撑伞快步走过，回头望了一眼身后」。"
          >
            <textarea
              className="input"
              style={{ width: "100%", minHeight: 72, resize: "vertical", lineHeight: 1.6, padding: "10px 12px" }}
              placeholder="描述本分镜的画面与内容…"
              value={shot.description ?? ""}
              onChange={(e) => setShot({ ...shot, description: e.target.value })}
            />
            {shot.ref_image_url && isLoadableUrl(shot.ref_image_url) && (
              <div style={{ marginTop: 10 }}>
                <div className="dim-2 mono" style={{ fontSize: 11, marginBottom: 6 }}>
                  {tf("分镜参考图（分镜头脚本第 {n} 格）", { n: shotIndex + 1 })}
                </div>
                <div
                  style={{
                    position: "relative", width: 160, aspectRatio: "4 / 3",
                    border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden",
                    background: "var(--surface-2)",
                  }}
                >
                  <img
                    src={shot.ref_image_url}
                    alt={t("分镜参考图")}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                  <ZoomButton src={shot.ref_image_url} alt={t("分镜参考图")} />
                  <button
                    className="btn btn-sm btn-ghost"
                    title={t("移除参考图")}
                    onClick={() => setShot({ ...shot, ref_image_url: null })}
                    style={{ position: "absolute", top: 4, right: 4, padding: 2, minWidth: 22, background: "rgba(0,0,0,.5)", color: "#fff" }}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            )}
          </SubCard>

          <SubCard
            anchor={`s-${shot.id}-duration`}
            num="18" title="分镜时长分配"
            tags={["opt"]}
            help="为本分镜单独指定时长（秒）。可拖拽调整，上限 = 视频总时长 − 其他分镜已占用；留空则由系统在总时长内自动均摊。"
          >
            <FShotDuration value={shot} set={setShot} project={project} />
          </SubCard>
        </div>

        {/* 第二行：分镜出场角色 + 角色动作 */}
        <div className="lg-row2">
          <SubCard
            anchor={`s-${shot.id}-cast`}
            num="19" title="分镜出场角色"
            tags={["opt"]}
            help="（可选）从已加入本剧的角色中，选择会在这一分镜出场的角色。选了之后，下方台词、内心独白才能指派给这些角色；不选也能直接生成。"
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
            num="20" title="角色动作"
            tags={["opt"]}
            example="林夏从沙发上起身（起点）→ 走向窗边（过程）→ 推开窗户深呼吸（结束）"
            help="（可选）拆成「起点 → 过程 → 结束」三段，注意保持骨骼运动的连贯性。不填也能生成。"
          >
            <FAction value={shot} set={setShot} />
          </SubCard>
        </div>

        {/* 第三行：微表情控制 + 小动作控制 */}
        <div className="lg-row2">
          <SubCard
            anchor={`s-${shot.id}-micro`}
            num="21" title="微表情控制"
            tags={["opt"]}
            help="眼神、神态、情绪三个维度的细颗粒控制，可独立填写。"
          >
            <FMicro value={shot} set={setShot} />
          </SubCard>

          <SubCard
            anchor={`s-${shot.id}-gesture`}
            num="22" title="小动作控制"
            tags={["opt"]}
            help="不易在主动作中体现的细节，如手指动作、轻微呼吸、眨眼。"
          >
            <FGesture value={shot} set={setShot} />
          </SubCard>
        </div>

        {/* 第四行：景别 + 摄像机运动 */}
        <div className="lg-row2">
          <SubCard
            anchor={`s-${shot.id}-shotSize`}
            num="23" title="景别"
            tags={["opt"]}
            help="选择本分镜的取景范围（9 选 1，单选）。从大远景到大特写，决定画面与人物的距离感。"
          >
            <FShotSize value={shot} set={setShot} />
          </SubCard>

          <SubCard
            anchor={`s-${shot.id}-camera`}
            num="24" title="摄像机运动"
            tags={["opt"]}
            help="为本分镜选择一种运镜方式（16 选 1，单选）。选定后可调整速度、幅度、方向。"
          >
            <FCamera value={shot} set={setShot} />
          </SubCard>
        </div>

        {/* 第五行：台词 + 内心独白 */}
        <div className="lg-row2">
          <SubCard
            anchor={`s-${shot.id}-lines`}
            num="25" title="台词"
            tags={["opt"]}
            help="角色出口的对白，只填文字内容。配音自动使用该角色在角色库里的参考音色。角色限制在本分镜「出场角色」中。"
          >
            <FSpeech
              value={shot} set={setShot}
              kind="lines"
              characters={characters}
              withAudio={false}
              accentVar="--info"
              shotCharOptions={shot.cast_ids}
            />
          </SubCard>

          <SubCard
            anchor={`s-${shot.id}-mono`}
            num="26" title="内心独白"
            tags={["opt"]}
            help="角色的画外心声，只填文字内容。配音自动使用该角色在角色库里的参考音色。"
          >
            <FSpeech
              value={shot} set={setShot}
              kind="mono"
              characters={characters}
              withAudio={false}
              accentVar="--audio"
              shotCharOptions={shot.cast_ids}
            />
          </SubCard>
        </div>

        {/* 第六行：旁白 + 关键动作音效 */}
        <div className="lg-row2">
          <SubCard
            anchor={`s-${shot.id}-narration`}
            num="27" title="旁白"
            tags={["opt"]}
            help="不绑定特定角色的叙述声，只填文字内容。配音请在「全局场景层 · 旁白音频」统一上传。"
          >
            <FSpeech
              value={shot} set={setShot}
              kind="narration"
              characters={characters}
              bindCharacter={false}
              withAudio={false}
              accentVar="--success"
            />
          </SubCard>

          <SubCard
            anchor={`s-${shot.id}-sfx`}
            num="28" title="关键动作音效"
            tags={["opt"]}
            help="主要动作产生的瞬间音效，与全局层「环境音效」区别开。"
          >
            <FSfx value={shot} set={setShot} />
          </SubCard>
        </div>
      </div>
    </div>
  );
}
