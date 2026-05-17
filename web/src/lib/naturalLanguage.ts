import type { Character, Project } from "@/types";

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
      `${[g.season, g.time_of_day].filter(Boolean).join("·")}的${sceneLabel ?? "未指定场景"}。` +
      `影像风格：${g.style?.join(" + ") || "未指定"}。出场角色：${charNames || "未指定"}。\n\n${g.story}`,
  });

  p.shots.forEach((s, i) => {
    blocks.push({ kind: "h", content: `分镜 ${String(i + 1).padStart(2, "0")} · ${s.name}` });
    const parts: string[] = [];
    const action = [s.action?.start, s.action?.mid, s.action?.end].filter(Boolean).join(" → ");
    parts.push(`动作：${action || "未指定"}。`);
    const micro = [s.micro?.eyes, s.micro?.look, s.micro?.emotion].filter(Boolean).join("、");
    if (micro) parts.push(`表情：${micro}。`);
    if (s.gesture) parts.push(`小动作：${s.gesture}。`);
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
