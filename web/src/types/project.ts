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
export type VideoRatio = "21:9" | "16:9" | "4:3" | "1:1" | "3:4" | "9:16" | "adaptive";

// 视频分辨率。Seedance 2.0 / new-api 接口 metadata.resolution 文档支持 480p / 720p(默认 720p);
// 1080p 由上游模型决定(部分模型名带 1080 后缀)。任务表(GenerationTask.resolution)仅记 720p / 1080p。
export type VideoResolution = "480p" | "720p" | "1080p" | "4k";

export interface GlobalLayer {
  total_duration_seconds: number | null;
  // 画面比例,null = 走默认 16:9(buildSeedancePayload 兜底)
  ratio: VideoRatio | null;
  // 视频分辨率,null = 走默认 720p(buildSeedancePayload 兜底)
  resolution: VideoResolution | null;
  /**
   * 本剧引用的场景库 id 列表（多选，跨项目复用，类比 characters）。
   * 数组第一项为「主场景」，其参考图会被解析进 scene_image 供 prompt 使用。
   */
  scenes: string[];
  /**
   * 本剧引用的道具库 id 列表（多选）。
   * 数组第一项为「主道具」，其参考图会被解析进 prop_image_url 供 prompt 使用。
   */
  props: string[];
  /**
   * 选中场景的「名字 + 参考图」快照（FScene 选择时回写，顺序同 scenes）。
   * prompt 流水线据此把每个场景按名字 + 图分别体现（多场景，不再只用第一张当背景）。
   */
  scene_refs?: Array<{ name: string; image_url: string | null }>;
  /**
   * 选中道具的「名字 + 参考图」快照（FProp 选择时回写，顺序同 props）。
   * prompt 流水线据此把每个道具按「道具名 + 图」分别体现（多道具）。
   */
  prop_refs?: Array<{ name: string; image_url: string | null }>;
  // 单场景设计:整支视频只支持一张场景参考图。
  // 由 scenes[0] 对应场景的参考图派生而来（FScene 选择时回写），prompt 直接读它。
  // 字符串可以是外链 URL,也可以是 base64 data URL(本地上传)。
  scene_image: string | null;
  /**
   * 「想象力约束强度」0–100(秦总需求):越高,prompt 末尾对模型自由发挥的约束措辞越强,
   * 越严格地只呈现描述内容。未设按默认 70。
   */
  constraint_strength?: number;
  position_image_url: string | null;
  /**
   * 道具参考图(可选):单张展示本片关键道具的简笔/实拍图,模型据此约束道具外观一致性。
   * 由 props[0] 对应道具的参考图派生而来（FProp 选择时回写）。
   * 字符串可以是 http(s):// URL、asset:// URI、也可以是 base64 data URL(本地上传)。
   * 在 prompt 里以 @图片N 引用,顺序紧跟「站位草图」之后、「旁白音频」之前。
   */
  prop_image_url: string | null;
  style: string[];
  characters: string[];
  /**
   * 角色变体选择(可选):characters 里启用了变体的角色,记录本剧调用的是哪个变体。
   * key = 角色 id,value = 变体 id;不存在或为空字符串表示用「默认(基础形象)」。
   */
  character_variants?: Record<string, string>;
  story: string;
  /**
   * 分镜头脚本图(可选):一张分镜头脚本图(宫格图)。可手动上传,也可由右侧
   * 「大模型 · 生成分镜头脚本」按所选角色/场景/道具与宫格数量生成后一键导入。
   * 字符串可以是 http(s):// URL,也可以是 base64 / data: URL。仅作创作参考与留存,
   * 不参与最终生成 prompt 的拼接。
   */
  storyboard_image_url?: string | null;
  /**
   * 画质内容(可选):用户对画质、光影、色调的额外要求。
   * 非空时会拼进 prompt 末尾的画质 tail,与默认的"高清、细节丰富..."并列。
   * 示例:"4K 锐利、电影感、暖色调"。
   */
  image_quality: string;
  narration_audio_url: string | null;
  /**
   * 「首尾帧 / 智能多帧」模式的独立画面数据(可选,与常规模式分开)。
   * frame_prompt: 文字描述;first/last_frame_url: 首尾帧两张图;multi_frame_urls: 智能多帧多张图。
   * frame_ratio: 比例(支持 21:9/16:9/4:3/1:1/3:4/9:16,与常规 ratio 解耦);
   * frame_resolution: 清晰度(720P/1080P);total_duration_seconds 复用为时长(4–15s)。
   * multi_frame_segments: 智能多帧每个关键帧前后的「秒数」段(长度 = 帧数 + 1)。
   */
  frame_prompt?: string;
  first_frame_url?: string | null;
  last_frame_url?: string | null;
  multi_frame_urls?: string[];
  multi_frame_segments?: FrameSegment[];
  frame_ratio?: string;
  frame_resolution?: string;
}

/** 智能多帧:相邻关键帧之间(及首尾)的「段」——秒数 + 运镜/画面描述。 */
export interface FrameSegment {
  seconds: number;
  desc: string;
}

export interface Shot {
  id: string;
  name: string;
  /** 分镜描述:这一镜整体在讲什么(自由文本,拼进 prompt 的镜头段开头) */
  description: string;
  /** 分镜参考图:分镜头脚本宫格图裁切后第 k 格对应本分镜(TOS URL);未设为空 */
  ref_image_url?: string | null;
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
