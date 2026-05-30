// promptDoc.ts —— Project + Character[] → 方括号字段格式提示词文本
//
// 用途：
//   - 编辑器「生成视频」前调用，把提示词打到 console / 调试面板 / 后端 / task.prompt（PRD §4）
//   - 也作为「导出给导演审稿」的源数据，外层再用 docx 包装
//
// 与 .doc 模板的关系：
//   原模板共 17 个方括号字段。导演审稿后决议不扩 Shot 模型（PRD-v0.4 删除原 §4.4），
//   仅输出现有 Shot 字段实际支持的部分，剔除模板中没有数据来源的字段：
//     ❌ 机位 / 视角 / 构图 / 镜头焦距 / 焦点 / 表演主体 / FACS / 光线 / 环境动作
//     ✅ 场景 / 角色 / 背景 / 景别 / 摄象机运动 / 关键动作 / 眼神 / 台词 / 强度 / 音效 / 环境声
//
// 设计原则：
//   - 不抛错：字段缺失只产出占位，让 prompt 总能完整打印（PRD §4.3.4）
//   - 不依赖运行时：与 serialize.ts 一样为纯函数，便于单测 & 服务端共用一份逻辑
//   - 时间码由 shot.duration_seconds 累加得到；缺失时由 global.total_duration_seconds 均摊

import type { AssetKind, Character, Project } from "@/types";
import type { CameraMove, Shot, SpeechBlock } from "@/types/project";
import { CAMERA_MOVES, SHOT_SIZES } from "@/lib/fieldDefs";

const MISSING = "（缺）";

/** prompt 中引用素材的来源：character_id + 媒体类型 → 火山 asset:// URI */
export interface AssetRef {
  character_id: string;
  character_name: string;
  kind: AssetKind;
  /** 引用位置，便于 debug：如 "global.char_ref.c_qy" */
  used_in: string;
  /** asset://{ark_asset_id}；缺失时为 null（character 未在火山注册 / primary 缺失） */
  uri: string | null;
}

export interface PromptDocResult {
  /** 完整方括号格式提示词 */
  text: string;
  /** 渲染时填了「（缺）」的字段路径，用于编辑器红点提示 */
  missing_fields: string[];
  /** 本次 prompt 引用到的素材清单（PRD §4.3.3 PromptSnapshot.asset_refs） */
  asset_refs: AssetRef[];
}

export function projectToPromptDoc(
  p: Project,
  characters: Character[]
): PromptDocResult {
  const missing: string[] = [];
  const lines: string[] = [];
  const assetRefs: AssetRef[] = [];
  const charMap = new Map(characters.map((c) => [c.id, c]));

  // ============ 全局段 ============
  const scene = renderScene(p);
  lines.push(`【场景】${scene}`);
  if (scene === MISSING) missing.push("global.scene");

  const charNames = (p.global.characters ?? [])
    .map((id) => charMap.get(id)?.name)
    .filter((n): n is string => !!n);
  lines.push(`【角色】${charNames.length ? charNames.join("、") : MISSING}`);
  if (!charNames.length) missing.push("global.characters");

  lines.push(`【背景】`);
  if (charNames.length) {
    (p.global.characters ?? []).forEach((id) => {
      const c = charMap.get(id);
      if (!c) return;
      const desc = c.desc?.trim() || MISSING;
      // 角色背景行后追加 primary 素材的 asset:// 引用
      const imgUri = c.asset_bundle?.primary_image_ark_asset_id
        ? `asset://${c.asset_bundle.primary_image_ark_asset_id}`
        : null;
      const audUri = c.asset_bundle?.primary_audio_ark_asset_id
        ? `asset://${c.asset_bundle.primary_audio_ark_asset_id}`
        : null;
      const refTag = renderCharAssetTag(imgUri, audUri);
      lines.push(`${c.name} — ${desc}${refTag}`);
      if (!c.desc?.trim()) missing.push(`global.characters[${id}].desc`);

      // 收集到 asset_refs
      assetRefs.push({
        character_id: id,
        character_name: c.name,
        kind: "image",
        used_in: `global.char_ref.${id}`,
        uri: imgUri,
      });
      assetRefs.push({
        character_id: id,
        character_name: c.name,
        kind: "audio",
        used_in: `global.voice.${id}`,
        uri: audUri,
      });
      if (!imgUri) missing.push(`global.characters[${id}].primary_image`);
      if (!audUri) missing.push(`global.characters[${id}].primary_audio`);
    });
  } else {
    lines.push(MISSING);
  }
  lines.push("");

  // ============ 各镜头段 ============
  const durations = allocateDurations(p);
  let cursor = 0;
  p.shots.forEach((shot, idx) => {
    const dur = durations[idx];
    const start = cursor;
    const end = cursor + dur;
    cursor = end;

    lines.push(`【镜头${idx + 1}，${fmtTime(start)}--${fmtTime(end)}】`);
    pushField(lines, missing, `shots[${idx}].shot_size`, "景别", renderShotSize(shot.shot_size));
    pushField(
      lines, missing, `shots[${idx}].camera`,
      "摄象机运动", renderCameraMoves(shot.camera)
    );

    // 【关键动作】跨多行
    const action = renderAction(shot.action, start, end);
    if (action) {
      lines.push(`【关键动作】预备—过程—结束`);
      action.forEach((l) => lines.push(l));
    } else {
      lines.push(`【关键动作】${MISSING}`);
      missing.push(`shots[${idx}].action`);
    }

    pushField(
      lines, missing, `shots[${idx}].micro`,
      "眼神", renderEyes(shot.micro)
    );

    // 【台词】跨两行（含引号）
    const lineBlock = renderSpeech(shot.lines, charMap, start, inferTone(shot));
    if (lineBlock) {
      lines.push(`【台词】${lineBlock.intro}`);
      lines.push(lineBlock.text);
    } else if (shot.mono?.text || shot.narration?.text) {
      // 没台词但有独白/旁白，单出独白/旁白行（保留方括号字段名）
      if (shot.mono?.text) {
        const m = renderSpeech(shot.mono, charMap, start, inferTone(shot));
        if (m) {
          lines.push(`【内心独白】${m.intro}`);
          lines.push(m.text);
        }
      }
      if (shot.narration?.text) {
        lines.push(`【旁白】${fmtTime(start)} 起：`);
        lines.push(`"${shot.narration.text}"`);
      }
    } else {
      lines.push(`【台词】${MISSING}`);
      missing.push(`shots[${idx}].lines`);
    }

    pushField(
      lines, missing, `shots[${idx}].intensity`,
      "强度", renderIntensity(shot)
    );
    pushField(lines, missing, `shots[${idx}].sfx`, "音效", shot.sfx);
    pushField(
      lines, missing, "output.ambient_sfx",
      "环境声", p.output?.ambient_sfx
    );

    lines.push("");
  });

  return {
    text: lines.join("\n").trimEnd() + "\n",
    missing_fields: dedupe(missing),
    asset_refs: assetRefs,
  };
}

/** 把角色的 image / audio asset URI 拼成尾部标签 */
function renderCharAssetTag(imgUri: string | null, audUri: string | null): string {
  const parts: string[] = [];
  if (imgUri) parts.push(`图 ${imgUri}`);
  if (audUri) parts.push(`音 ${audUri}`);
  return parts.length ? `  [参考素材：${parts.join(" / ")}]` : "";
}

// ============ 私有工具 ============

function pushField(
  lines: string[],
  missing: string[],
  path: string,
  label: string,
  value: string | null | undefined
) {
  const v = (value ?? "").toString().trim();
  if (v) {
    lines.push(`【${label}】${v}`);
  } else {
    lines.push(`【${label}】${MISSING}`);
    missing.push(path);
  }
}

function renderScene(p: Project): string {
  // 优先取场景图描述（外链或占位标签）；上传的 base64 图只能给出"已上传"标记。
  // 都没有时回落到 story 首句作为场景概览。
  const img = p.global.scene_image;
  if (img) {
    return img.startsWith("data:") ? "已上传场景参考图" : img;
  }
  const story = p.global.story?.trim();
  if (story) {
    // 取第一句（。/.）作为场景概览
    const firstSentence = story.split(/[。.\n]/, 1)[0]?.trim();
    return firstSentence || MISSING;
  }
  return MISSING;
}

function renderShotSize(id: string | null | undefined): string | undefined {
  if (!id) return undefined;
  const meta = SHOT_SIZES.find((x) => x.id === id);
  return meta ? meta.cn : id;
}

function renderCameraMoves(moves: CameraMove[] | undefined): string | undefined {
  if (!moves?.length) return undefined;
  return moves.map((m) => {
    const meta = lookupCamera(m.id);
    const parts: string[] = [];
    parts.push(meta?.cn ?? m.id);
    if (m.speed) parts.push(`${m.speed}速`);
    if (m.magnitude) parts.push(`${m.magnitude}幅度`);
    if (m.direction) parts.push(`方向${m.direction}`);
    return parts.join("，");
  }).join(" + ");
}

function lookupCamera(id: string) {
  return (
    CAMERA_MOVES.basic.find((x) => x.id === id) ||
    CAMERA_MOVES.advanced.find((x) => x.id === id) ||
    CAMERA_MOVES.special.find((x) => x.id === id)
  );
}

function renderAction(
  action: Shot["action"] | undefined,
  start: number,
  end: number
): string[] | null {
  if (!action) return null;
  const mid = (start + end) / 2;
  const out: string[] = [];
  const filled = [action.start, action.mid, action.end].filter((x) => x?.trim());
  if (!filled.length) return null;
  if (action.start?.trim()) out.push(`（预备：${action.start.trim()}）`);
  if (action.mid?.trim()) {
    out.push(
      `（动作过程：${fmtTime(start)}--${fmtTime(mid)}，${action.mid.trim()}）`
    );
  }
  if (action.end?.trim()) {
    out.push(
      `（动作结束：${fmtTime(mid)}--${fmtTime(end)}，${action.end.trim()}）`
    );
  }
  return out;
}

function renderEyes(micro: Shot["micro"] | undefined): string | undefined {
  if (!micro) return undefined;
  const parts: string[] = [];
  if (micro.eyes?.trim()) parts.push(micro.eyes.trim());
  if (micro.look?.trim()) parts.push(micro.look.trim());
  return parts.length ? parts.join("，") : undefined;
}

function renderSpeech(
  block: SpeechBlock | null | undefined,
  charMap: Map<string, Character>,
  startSec: number,
  tone: string
): { intro: string; text: string } | null {
  if (!block?.text?.trim()) return null;
  const speaker = block.char_id ? charMap.get(block.char_id)?.name : null;
  const speakerLabel = speaker ?? "旁白";
  return {
    intro: `${fmtTime(startSec)} 开始，${speakerLabel}${tone}：`,
    text: `"${block.text.trim()}"`,
  };
}

/** 从 shot.micro.emotion 简单推断说话语气。
 *  台词通常出现在情绪转变的早期，所以 "A → B" 取 A。
 *  后期可在 SpeechBlock 上加 `tone` 字段让用户手填，覆盖此推断。 */
function inferTone(shot: Shot): string {
  const emo = shot.micro?.emotion?.trim() ?? "";
  if (!emo) return "说";
  const main = emo.includes("→") ? emo.split("→")[0].trim() : emo;
  const mapping: Array<[string, string]> = [
    ["惊恐", "惊慌喊道"], ["惊", "惊呼"], ["怒", "怒喝"], ["疑", "疑惑地问"],
    ["讨好", "讨好地说"], ["冷", "冷声道"], ["喜", "笑着说"], ["悲", "哽咽道"],
  ];
  for (const [k, v] of mapping) {
    if (main.includes(k)) return v;
  }
  return `${main}地说`;
}

function renderIntensity(shot: Shot): string | undefined {
  // 由 action_strength / micro_strength 自动拼
  const parts: string[] = [];
  if (typeof shot.action_strength === "number") parts.push(`动作 ${shot.action_strength}%`);
  if (typeof shot.micro_strength === "number") parts.push(`表情 ${shot.micro_strength}%`);
  return parts.length ? parts.join("，") : undefined;
}

function allocateDurations(p: Project): number[] {
  // 已填的镜头时长直接用；未填的按 (总时长 - 已填合计) 均摊
  const n = p.shots.length;
  if (!n) return [];
  const fixed = p.shots.map((s) => s.duration_seconds);
  const total = p.global.total_duration_seconds ?? 0;
  const fixedSum = fixed.reduce<number>((acc, v) => acc + (v ?? 0), 0);
  const blankCount = fixed.filter((v) => v == null).length;
  const blankShare = blankCount > 0 ? Math.max(0, total - fixedSum) / blankCount : 0;
  return fixed.map((v) => (v ?? blankShare));
}

function fmtTime(sec: number): string {
  // 形如 00:00 / 00:03 / 00:01.5；保留一位小数仅当非整数
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  const mm = String(m).padStart(2, "0");
  const ss = Number.isInteger(s) ? String(s).padStart(2, "0") : s.toFixed(1).padStart(4, "0");
  return `${mm}:${ss}`;
}

function dedupe<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}
