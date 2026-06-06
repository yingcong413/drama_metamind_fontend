// lib/aiFill.ts —— Part 1：把一段描述用 gpt-5.4 转成结构化项目并填进工作台
//
// 让模型输出严格 JSON(对齐编辑器的 GlobalLayer + Shot 字段 + 合法枚举),
// 再映射成 Project 覆盖当前编辑器内容。对应 docs/生成视频的提示词格式.md 的「镜头 N·…」结构。

import { CAMERA_MOVES, SHOT_SIZES } from "@/lib/fieldDefs";
import type { CameraMove, CameraMoveId, Project, Shot } from "@/types";
import { chatComplete, type AiUsage } from "@/api/metamind";

const STYLES = ["2D 动画", "3D 动画", "真人实拍", "黑白", "线条风格"];
const SHOT_SIZE_IDS = SHOT_SIZES.map((s) => s.id);
const CAMERA_IDS = [
  ...CAMERA_MOVES.basic,
  ...CAMERA_MOVES.advanced,
  ...CAMERA_MOVES.special,
].map((c) => c.id);

// ─────────────── 模型输出 schema(给 prompt 用) ───────────────

interface AiShot {
  name?: string;
  description?: string;
  shot_size?: string | null;
  camera?: string | null;
  action?: { start?: string; mid?: string; end?: string };
  action_strength?: number;
  micro?: { eyes?: string; look?: string; emotion?: string };
  gesture?: string;
  gesture_strength?: number;
  lines?: string;
}

interface AiResult {
  style?: string;
  story?: string;
  image_quality?: string;
  generate_audio?: boolean;
  music?: boolean;
  subtitle?: boolean;
  shots?: AiShot[];
}

function buildSystemPrompt(): string {
  const sizeList = SHOT_SIZES.map((s) => `${s.id}(${s.cn})`).join("、");
  const camList = [...CAMERA_MOVES.basic, ...CAMERA_MOVES.advanced, ...CAMERA_MOVES.special]
    .map((c) => `${c.id}(${c.cn})`)
    .join("、");
  return [
    "你是短视频分镜脚本助手。把用户的描述拆解成结构化的分镜方案，只输出 JSON，不要任何额外文字、不要 markdown 代码块。",
    "JSON 顶层字段：",
    `- style: 整体风格，必须从这些里选一个: ${STYLES.join(" / ")}`,
    "- story: 整支视频的故事内容/叙事骨架，50-200 字中文",
    "- image_quality: 画质/光影/色调要求，一句话",
    "- generate_audio: 是否生成音频(布尔)；music: 是否要背景音乐(布尔)；subtitle: 是否要字幕(布尔)。若描述里说『不要背景音乐/字幕』则相应为 false",
    "- shots: 分镜数组，每个分镜对象字段：",
    "  - name: 分镜短标题",
    "  - description: 这一镜的画面描述(一句话)",
    `  - shot_size: 景别 id，从这些里选: ${sizeList}`,
    `  - camera: 运镜 id，从这些里选或 null: ${camList}`,
    "  - action: { start, mid, end } 角色动作的 起点/过程/结束(可部分为空字符串)",
    "  - action_strength: 0-100 整数，默认 65",
    "  - micro: { eyes, look, emotion } 微表情(可空字符串)",
    "  - gesture: 小动作描述(可空)；gesture_strength: 0-100 整数",
    "  - lines: 台词文本(可空)",
    "所有文本用中文。分镜数量按描述合理拆分(一般 3-6 个)。严格输出可被 JSON.parse 的对象。",
  ].join("\n");
}

// ─────────────── 解析 + 映射 ───────────────

function extractJson(text: string): AiResult {
  let t = text.trim();
  // 去掉 ```json ... ``` 围栏
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  // 容错:截取第一个 { 到最后一个 }
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) t = t.slice(first, last + 1);
  return JSON.parse(t) as AiResult;
}

function clampStrength(n: unknown, def = 65): number {
  const v = typeof n === "number" ? n : def;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function toCameraMove(id: string | null | undefined): CameraMove[] {
  if (!id || !CAMERA_IDS.includes(id as CameraMoveId)) return [];
  return [{ id: id as CameraMoveId, speed: "中", magnitude: "中", direction: null }];
}

function aiShotToShot(a: AiShot, i: number): Shot {
  const sizeId = a.shot_size && SHOT_SIZE_IDS.includes(a.shot_size) ? a.shot_size : null;
  return {
    id: "s_" + Date.now().toString(36) + "_" + i,
    name: (a.name || `镜头 ${i + 1}`).slice(0, 40),
    description: a.description || "",
    order: i,
    shot_size: sizeId,
    duration_seconds: null,
    cast_ids: [],
    action: {
      start: a.action?.start || "",
      mid: a.action?.mid || "",
      end: a.action?.end || "",
    },
    action_strength: clampStrength(a.action_strength),
    micro: {
      eyes: a.micro?.eyes || "",
      look: a.micro?.look || "",
      emotion: a.micro?.emotion || "",
    },
    micro_strength: 65,
    gesture: a.gesture || "",
    gesture_strength: clampStrength(a.gesture_strength),
    camera: toCameraMove(a.camera),
    lines: a.lines ? { char_id: null, text: a.lines, audio_url: null } : null,
    mono: null,
    narration: null,
    sfx: "",
  };
}

/** 把 AI 结果映射进 project(覆盖全局相关字段 + 整组分镜),返回新 project */
export function applyAiResult(base: Project, ai: AiResult): Project {
  const style = ai.style && STYLES.includes(ai.style) ? [ai.style] : base.global.style;
  const shots = Array.isArray(ai.shots) && ai.shots.length > 0
    ? ai.shots.map(aiShotToShot)
    : base.shots;
  return {
    ...base,
    global: {
      ...base.global,
      style,
      story: typeof ai.story === "string" && ai.story.trim() ? ai.story.trim() : base.global.story,
      image_quality:
        typeof ai.image_quality === "string" && ai.image_quality.trim()
          ? ai.image_quality.trim()
          : base.global.image_quality,
    },
    output: {
      ...base.output,
      generate_audio:
        typeof ai.generate_audio === "boolean" ? ai.generate_audio : base.output.generate_audio,
      music: typeof ai.music === "boolean" ? ai.music : base.output.music,
      subtitle: typeof ai.subtitle === "boolean" ? ai.subtitle : base.output.subtitle,
    },
    shots,
    shot_count: shots.length,
  };
}

/** 一步到位:调 gpt-5.4 → 解析 → 应用,返回新 project。失败抛 Error。 */
export async function generateAndFill(
  base: Project,
  description: string,
  opts?: { onUsage?: (u: AiUsage) => void },
): Promise<Project> {
  const text = await chatComplete(
    [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: description },
    ],
    { onUsage: opts?.onUsage },
  );
  let ai: AiResult;
  try {
    ai = extractJson(text);
  } catch {
    throw new Error("AI 返回的不是有效 JSON，请重试或调整描述。");
  }
  return applyAiResult(base, ai);
}

// ─────────────── 分镜头脚本:按宫格数把故事拆成 N 个分镜(整图 + 自动建分镜) ───────────────

function extractShotsJson(text: string): AiShot[] {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const first = t.indexOf("[");
  const last = t.lastIndexOf("]");
  if (first >= 0 && last > first) t = t.slice(first, last + 1);
  const arr = JSON.parse(t);
  return Array.isArray(arr) ? (arr as AiShot[]) : [];
}

/**
 * 把一段故事拆成正好 count 个分镜(对齐分镜头脚本的宫格数),返回 Shot[]。
 * 后台给模型一个「分镜需要填写的字段模版」,让它按故事顺序逐格填充。失败抛 Error。
 */
export async function generateShots(
  story: string,
  count: number,
  opts?: { onUsage?: (u: AiUsage) => void },
): Promise<Shot[]> {
  const n = Math.max(1, Math.min(20, Math.round(count)));
  const sizeList = SHOT_SIZES.map((s) => `${s.id}(${s.cn})`).join("、");
  const sys = [
    `你是短视频分镜师。把用户的故事拆解成正好 ${n} 个连续分镜,只输出一个 JSON 数组,不要任何额外文字、不要 markdown 代码块。`,
    `数组长度必须是 ${n}。每个元素字段:`,
    "- name: 分镜短标题(如「镜头1·码头奔逃」)",
    "- description: 这一镜的画面描述(一句话)",
    `- shot_size: 景别 id,从这些里选或 null: ${sizeList}`,
    "- action: { start, mid, end } 角色动作的 起点/过程/结束(可部分为空字符串)",
    "- lines: 台词文本(可空)",
    "镜头之间动作连贯,按故事时间顺序推进。所有文本用中文。严格输出可被 JSON.parse 的数组。",
  ].join("\n");
  const text = await chatComplete(
    [
      { role: "system", content: sys },
      { role: "user", content: `故事:${story}\n\n请拆成正好 ${n} 个分镜。` },
    ],
    { onUsage: opts?.onUsage },
  );
  let shots: AiShot[];
  try {
    shots = extractShotsJson(text);
  } catch {
    throw new Error("AI 返回的分镜不是有效 JSON，请重试。");
  }
  // 对齐到 n 个:多则截断,少则补空分镜
  const out = shots.slice(0, n).map(aiShotToShot);
  for (let i = out.length; i < n; i++) {
    out.push(aiShotToShot({ name: `镜头 ${i + 1}` }, i));
  }
  return out;
}
