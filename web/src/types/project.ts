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

/** Seedance 2.0 接口支持的画面比例。 */
export type VideoRatio = "16:9" | "9:16" | "1:1" | "adaptive";

// 视频分辨率。Seedance 2.0 / new-api 接口 metadata.resolution 文档支持 480p / 720p(默认 720p);
// 1080p 由上游模型决定(部分模型名带 1080 后缀)。任务表(GenerationTask.resolution)仅记 720p / 1080p。
export type VideoResolution = "720p" | "1080p" | "4k";

export interface GlobalLayer {
  total_duration_seconds: number | null;
  // 画面比例,null = 走默认 16:9(buildSeedancePayload 兜底)
  ratio: VideoRatio | null;
  // 视频分辨率,null = 走默认 720p(buildSeedancePayload 兜底)
  resolution: VideoResolution | null;
  // 单场景设计:整支视频只支持一张场景参考图。
  // 字符串可以是外链 URL,也可以是 base64 data URL(本地上传)。
  scene_image: string | null;
  position_image_url: string | null;
  /**
   * 道具参考图(可选):单张展示本片关键道具的简笔/实拍图,模型据此约束道具外观一致性。
   * 字符串可以是 http(s):// URL、asset:// URI、也可以是 base64 data URL(本地上传)。
   * 在 prompt 里以 @图片N 引用,顺序紧跟「站位草图」之后、「旁白音频」之前。
   */
  prop_image_url: string | null;
  style: string[];
  characters: string[];
  story: string;
  /**
   * 画质内容(可选):用户对画质、光影、色调的额外要求。
   * 非空时会拼进 prompt 末尾的画质 tail,与默认的"高清、细节丰富..."并列。
   * 示例:"4K 锐利、电影感、暖色调"。
   */
  image_quality: string;
  narration_audio_url: string | null;
}

export interface Shot {
  id: string;
  name: string;
  /** 分镜描述:这一镜整体在讲什么(自由文本,拼进 prompt 的镜头段开头) */
  description: string;
  order: number;
  shot_size: string | null;
  duration_seconds: number | null;
  cast_ids: string[];
  action: ActionBlock;
  action_strength: number;
  micro: MicroBlock;
  micro_strength: number;
  gesture: string;
  gesture_strength: number;
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
  /**
   * 是否让模型生成音频(对应 Seedance API 顶层 generate_audio 字段)。
   * 与 music(是否在 prompt 里要求生成背景音乐)是两个独立开关:
   *   - generate_audio = false → 视频完全无声
   *   - generate_audio = true + music = false → 有台词/音效但无背景音乐
   *   - generate_audio = true + music = true → 全配置
   * 默认 true。
   */
  generate_audio: boolean;
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
