import type { GlobalLayer, OutputLayer, Project, Shot } from "@/types";

export function isFilled(g: GlobalLayer, fieldId: string): boolean {
  switch (fieldId) {
    case "duration":   return g.total_duration_seconds != null && g.total_duration_seconds > 0;
    case "scene":      return !!g.scene_image;
    case "position":   return !!g.position_image_url;
    case "style":      return (g.style ?? []).length > 0;
    case "characters": return (g.characters ?? []).length > 0;
    case "story":      return (g.story ?? "").length > 0;
    case "narrationAudio": return !!g.narration_audio_url;
  }
  return false;
}

export function isShotFilled(s: Shot, fieldId: string): boolean {
  switch (fieldId) {
    case "cast":      return (s.cast_ids ?? []).length > 0;
    case "shotSize":  return !!s.shot_size;
    case "action":    return !!(s.action?.start || s.action?.mid || s.action?.end);
    case "micro":     return !!(s.micro?.eyes || s.micro?.look || s.micro?.emotion);
    case "gesture":   return !!s.gesture;
    case "camera":    return (s.camera ?? []).length > 0;
    case "lines":     return !!s.lines?.text;
    case "mono":      return !!s.mono?.text;
    case "narration": return !!s.narration?.text;
    case "sfx":       return !!s.sfx;
    case "duration":  return s.duration_seconds != null && s.duration_seconds > 0;
  }
  return false;
}

export function isOutputFilled(o: OutputLayer, fieldId: string): boolean {
  switch (fieldId) {
    case "ambientSfx": return !!o.ambient_sfx;
    case "subtitle":   return o.subtitle != null;
    case "music":      return o.music != null;
  }
  return false;
}

const SHOT_FIELD_IDS = ["action", "micro", "gesture", "camera", "lines", "mono", "narration", "sfx"];
export function filledShotCount(s: Shot): number {
  return SHOT_FIELD_IDS.filter((id) => isShotFilled(s, id)).length;
}

export interface ValidationResult {
  /** 硬性缺失：缺这些不能生成（仅全局必填项） */
  missing: string[];
  /** 软提示：建议补但不阻断生成（如分镜未填角色动作） */
  warnings: string[];
  canGenerate: boolean;
}

export function computeValidation(p: Project): ValidationResult {
  const missing: string[] = [];
  if (!isFilled(p.global, "duration")) missing.push("视频总时长");
  if (!isFilled(p.global, "characters")) missing.push("角色调用");
  if (!isFilled(p.global, "story")) missing.push("故事内容");

  // 分镜可选（v0.9.5）：分镜「角色动作」缺失降级为软提示，不再阻断生成。
  // 没有分镜也允许生成（按全局设定整体出片）。
  const warnings: string[] = [];
  p.shots.forEach((s, i) => {
    if (!isShotFilled(s, "action")) {
      const idx = String(i + 1).padStart(2, "0");
      const name = s.name ? `「${s.name}」` : "";
      warnings.push(`分镜${idx}${name} · 未填角色动作`);
    }
  });

  return { missing, warnings, canGenerate: missing.length === 0 };
}
