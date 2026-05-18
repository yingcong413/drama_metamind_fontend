import type { GlobalLayer, OutputLayer, Project, Shot } from "@/types";

export function isFilled(g: GlobalLayer, fieldId: string): boolean {
  switch (fieldId) {
    case "duration":   return g.total_duration_seconds != null && g.total_duration_seconds > 0;
    case "scene":      return (g.scene_images ?? []).length > 0;
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
  missing: string[];
  canGenerate: boolean;
}

export function computeValidation(p: Project): ValidationResult {
  const missing: string[] = [];
  if (!isFilled(p.global, "duration")) missing.push("01 视频总时长");
  if (!isFilled(p.global, "characters")) missing.push("05 角色调用");
  if (!isFilled(p.global, "story")) missing.push("06 故事内容");
  p.shots.forEach((s, i) => {
    if (!isShotFilled(s, "action")) {
      missing.push(`分镜${String(i + 1).padStart(2, "0")} · 12 动作`);
    }
  });
  return { missing, canGenerate: missing.length === 0 };
}
