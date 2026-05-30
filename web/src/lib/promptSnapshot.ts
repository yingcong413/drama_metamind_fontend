// lib/promptSnapshot.ts —— PRD §10.4 / §4 工厂函数,把 Project + Characters
// 转成可入库的 PromptSnapshot(结构化 + 自然语言双形态)。
//
// 调用方:GenerateRequestModal 在「确认生成」时调一次,把结果跟 Seedance 一起
// 发到 POST /tasks,后端落库到 tasks.prompt(JSON 列)。
//
// ⚠ 关键:剥掉所有 base64 data URL 再入库 ——
//   用户用「本地上传」放进来的场景/站位/道具图、声音都是 data:...;base64,xxxxxxxx
//   的形式,一张 1080p 大概 1-2MB,三张就是 6MB+。直接塞进 prompt JSON 会:
//     ① POST /api/v1/tasks 体积爆炸(原默认 Express 限制 2mb,直接 PayloadTooLarge)
//     ② SQLite tasks.prompt 列每条几 MB,DB 体积爆炸
//     ③ 用户在使用记录里展开「提示词」tab 也没法看(全是 base64 一坨)
//   解决:用 stripBase64 把 data URL 替换成「data:...;base64,... <128KB omitted>」摘要
//   样式,既保留出处线索(类型+原始大小)又把字符数压回到合理范围。

import { serializeProject } from "./serialize";
import { buildPromptText } from "./naturalLanguage";
import type { Character, Project, PromptSnapshot } from "@/types";

export function buildPromptSnapshot(
  project: Project,
  characters: Character[],
): PromptSnapshot {
  const structured = serializeProject(project, characters);
  // 剥 base64,深拷贝避免污染 react state
  const sanitized = {
    ...structured,
    global: {
      ...structured.global,
      scene: stripBase64(structured.global.scene),
      position: stripBase64(structured.global.position),
      prop: stripBase64(structured.global.prop),
      narration_audio: stripBase64(structured.global.narration_audio),
    },
  };
  return {
    version: "v09",
    structured_json: sanitized,
    natural_text: buildPromptText(project, characters),
    locked: false,
  };
}

/**
 * data: URL → 摘要;其它 URL/asset:// 原样返回
 *
 * 例如:
 *   "data:image/png;base64,iVBORw0KG...(2MB)..."
 *   → "data:image/png;base64,... <2048 KB omitted>"
 *
 * 这样在使用记录的「提示词」Tab 用户能看到「这里曾经塞了 2MB 的图」,
 * 又不影响排查 / 复盘逻辑,DB 体积也回到几 KB。
 */
function stripBase64(s: string | null | undefined): string | null {
  if (!s) return null;
  if (!s.startsWith("data:")) return s;
  // 取「data:image/png;base64,」前缀作类型线索
  const commaAt = s.indexOf(",");
  const prefix = commaAt > 0 ? s.slice(0, commaAt + 1) : "data:?,";
  const sizeKb = Math.round(s.length / 1024);
  return `${prefix}... <${sizeKb} KB omitted>`;
}
