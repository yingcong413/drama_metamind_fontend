import type { Character, Project } from "@/types";
import { SHOT_SIZES } from "@/lib/fieldDefs";

export interface NaturalLanguageBlock {
  kind: "h" | "text";
  content: string;
}

export function projectToNaturalLanguage(p: Project, characters: Character[]): NaturalLanguageBlock[] {
  const g = p.global;
  const blocks: NaturalLanguageBlock[] = [];
  const charNames = (g.characters ?? [])
    .map((id) => characters.find((c) => c.id === id)?.name)
    .filter(Boolean)
    .join("、");
  const sceneLabel = g.scene_selected != null ? g.scene_images?.[g.scene_selected] : "未指定场景";

  blocks.push({ kind: "h", content: "全局场景" });
  blocks.push({
    kind: "text",
    content:
      `视频总时长：${g.total_duration_seconds != null ? g.total_duration_seconds + " 秒" : "未指定"}。` +
      `场景：${sceneLabel ?? "未指定场景"}。` +
      `影像风格：${g.style?.join(" + ") || "未指定"}。出场角色：${charNames || "未指定"}。` +
      `旁白音频：${g.narration_audio_url ? "已上传" : "无"}。\n\n${g.story}`,
  });

  p.shots.forEach((s, i) => {
    blocks.push({ kind: "h", content: `分镜 ${String(i + 1).padStart(2, "0")} · ${s.name}` });
    const parts: string[] = [];
    if (s.shot_size) {
      const ss = SHOT_SIZES.find((x) => x.id === s.shot_size);
      if (ss) parts.push(`景别：${ss.cn}（${ss.en}）。`);
    }
    const action = [s.action?.start, s.action?.mid, s.action?.end].filter(Boolean).join(" → ");
    parts.push(`动作：${action || "未指定"}（强度 ${s.action_strength}%）。`);
    const micro = [s.micro?.eyes, s.micro?.look, s.micro?.emotion].filter(Boolean).join("、");
    if (micro) parts.push(`表情：${micro}（强度 ${s.micro_strength}%）。`);
    if (s.gesture) parts.push(`小动作：${s.gesture}（强度 ${s.gesture_strength}%）。`);
    if (s.camera?.length) {
      const moves = s.camera.map((c) => c.id).join(" + ");
      parts.push(`运镜：${moves}。`);
    }
    if (s.lines?.text) {
      const name = characters.find((c) => c.id === s.lines?.char_id)?.name ?? "?";
      parts.push(`台词（${name}）：「${s.lines.text}」`);
    }
    if (s.mono?.text) {
      const name = characters.find((c) => c.id === s.mono?.char_id)?.name ?? "?";
      parts.push(`独白（${name}）：「${s.mono.text}」`);
    }
    if (s.narration?.text) parts.push(`旁白：「${s.narration.text}」`);
    if (s.sfx) parts.push(`音效：${s.sfx}。`);
    if (s.duration_seconds != null) parts.push(`时长：${s.duration_seconds} 秒。`);
    blocks.push({ kind: "text", content: parts.join(" ") });
  });

  blocks.push({ kind: "h", content: "输出" });
  blocks.push({
    kind: "text",
    content:
      `环境音效：${p.output.ambient_sfx || "无"}。` +
      `字幕：${p.output.subtitle ? "开" : "关"}。背景音乐：${p.output.music ? "开" : "关"}。`,
  });
  return blocks;
}
