export type ProjectStatus = "draft" | "gen" | "done";

export type CameraMoveId =
  | "push_in" | "pull_out" | "pan_l" | "pan_r" | "tilt_u" | "tilt_d"
  | "boom_u" | "boom_d" | "follow" | "orbit" | "dolly_zoom" | "whip_pan"
  | "aerial" | "handheld" | "pov" | "ots";

export interface CameraMove {
  id: CameraMoveId;
  speed: "慢" | "中" | "快";
  magnitude: "小" | "中" | "大";
  direction: "左" | "右" | "上" | "下" | null;
}

export interface SpeechBlock {
  char_id: string | null;
  text: string;
  audio_url: string | null;
}

export interface ActionBlock {
  start: string;
  mid: string;
  end: string;
}

export interface MicroBlock {
  eyes: string;
  look: string;
  emotion: string;
}

export interface GlobalLayer {
  season: "春" | "夏" | "秋" | "冬" | null;
  time_of_day: "清晨" | "白天" | "黄昏" | "黑夜" | null;
  scene_images: string[];
  scene_selected: number | null;
  position_image_url: string | null;
  style: string[];
  characters: string[];
  story: string;
}

export interface Shot {
  id: string;
  name: string;
  order: number;
  cast_ids: string[];
  action: ActionBlock;
  micro: MicroBlock;
  gesture: string;
  camera: CameraMove[];
  lines: SpeechBlock | null;
  mono: SpeechBlock | null;
  narration: SpeechBlock | null;
  sfx: string;
}

export interface OutputLayer {
  ambient_sfx: string;
  subtitle: boolean;
  music: boolean;
}

export interface Project {
  id: string;
  name: string;
  cover_url: string | null;
  hue: number;
  status: ProjectStatus;
  shot_count: number;
  duration_seconds: number;
  global: GlobalLayer;
  shots: Shot[];
  output: OutputLayer;
  created_at: string;
  updated_at: string;
}

export interface ProjectListItem {
  id: string;
  name: string;
  cover_url: string | null;
  hue: number;
  status: ProjectStatus;
  shot_count: number;
  duration_seconds: number;
  updated_at: string;
}
