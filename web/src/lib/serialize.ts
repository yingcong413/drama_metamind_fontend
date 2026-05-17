import type { Project } from "@/types";

export interface SerializedShot {
  id: string;
  name: string;
  action: Project["shots"][number]["action"];
  micro: Project["shots"][number]["micro"];
  gesture: string;
  camera: Project["shots"][number]["camera"];
  lines: Project["shots"][number]["lines"];
  mono: Project["shots"][number]["mono"];
  narration: Project["shots"][number]["narration"];
  sfx: string;
}

export interface SerializedProject {
  global: {
    time: { season: string | null; of_day: string | null };
    scene: { uploaded: number; active_index: number | null };
    position: string | null;
    style: string[];
    characters: string[];
    story: string;
  };
  shots: SerializedShot[];
  output: { ambient_sfx: string; subtitle: boolean; music: boolean };
}

export function serializeProject(p: Project): SerializedProject {
  return {
    global: {
      time: { season: p.global.season ?? null, of_day: p.global.time_of_day ?? null },
      scene: {
        uploaded: p.global.scene_images?.length ?? 0,
        active_index: p.global.scene_selected ?? null,
      },
      position: p.global.position_image_url ?? null,
      style: p.global.style ?? [],
      characters: p.global.characters ?? [],
      story: p.global.story ?? "",
    },
    shots: p.shots.map((s) => ({
      id: s.id,
      name: s.name,
      action: s.action,
      micro: s.micro,
      gesture: s.gesture ?? "",
      camera: s.camera ?? [],
      lines: s.lines?.text || s.lines?.audio_url ? s.lines : null,
      mono: s.mono?.text || s.mono?.audio_url ? s.mono : null,
      narration: s.narration?.text || s.narration?.audio_url ? s.narration : null,
      sfx: s.sfx ?? "",
    })),
    output: {
      ambient_sfx: p.output.ambient_sfx ?? "",
      subtitle: !!p.output.subtitle,
      music: !!p.output.music,
    },
  };
}
