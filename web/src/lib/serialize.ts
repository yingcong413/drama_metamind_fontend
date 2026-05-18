import type { Project } from "@/types";

export interface SerializedShot {
  id: string;
  name: string;
  shot_size: string | null;
  action: Project["shots"][number]["action"];
  action_strength: number;
  micro: Project["shots"][number]["micro"];
  micro_strength: number;
  gesture: string;
  gesture_strength: number;
  duration_seconds: number | null;
  camera: Project["shots"][number]["camera"];
  lines: Project["shots"][number]["lines"];
  mono: Project["shots"][number]["mono"];
  narration: Project["shots"][number]["narration"];
  sfx: string;
}

export interface SerializedProject {
  global: {
    total_duration_seconds: number | null;
    scene: { uploaded: number; active_index: number | null };
    position: string | null;
    style: string[];
    characters: string[];
    story: string;
    narration_audio: string | null;
  };
  shots: SerializedShot[];
  output: { ambient_sfx: string; subtitle: boolean; music: boolean };
}

export function serializeProject(p: Project): SerializedProject {
  return {
    global: {
      total_duration_seconds: p.global.total_duration_seconds ?? null,
      scene: {
        uploaded: p.global.scene_images?.length ?? 0,
        active_index: p.global.scene_selected ?? null,
      },
      position: p.global.position_image_url ?? null,
      style: p.global.style ?? [],
      characters: p.global.characters ?? [],
      story: p.global.story ?? "",
      narration_audio: p.global.narration_audio_url ?? null,
    },
    shots: p.shots.map((s) => ({
      id: s.id,
      name: s.name,
      shot_size: s.shot_size ?? null,
      action: s.action,
      action_strength: s.action_strength ?? 65,
      micro: s.micro,
      micro_strength: s.micro_strength ?? 65,
      gesture: s.gesture ?? "",
      gesture_strength: s.gesture_strength ?? 65,
      duration_seconds: s.duration_seconds ?? null,
      camera: s.camera ?? [],
      lines: s.lines?.text ? s.lines : null,
      mono: s.mono?.text ? s.mono : null,
      narration: s.narration?.text ? s.narration : null,
      sfx: s.sfx ?? "",
    })),
    output: {
      ambient_sfx: p.output.ambient_sfx ?? "",
      subtitle: !!p.output.subtitle,
      music: !!p.output.music,
    },
  };
}
