import type { TagKind } from "@/components/primitives/Tag";

export type DataLayer = "global" | "output";

export interface FieldDef {
  num: string;
  id: string;
  title: string;
  tags: TagKind[];
  /** 字段在数据模型中实际归属的层（影响读写哪个对象） */
  dataLayer?: DataLayer;
}

export const FIELD_DEFS: {
  global: FieldDef[];
  shot: FieldDef[];
} = {
  global: [
    { num: "01", id: "duration",   title: "视频总时长", tags: ["req"],              dataLayer: "global" },
    { num: "02", id: "scene",      title: "场景",       tags: ["upload"],           dataLayer: "global" },
    { num: "03", id: "position",   title: "站位图",     tags: ["opt", "upload"],    dataLayer: "global" },
    { num: "04", id: "style",      title: "影像风格",   tags: ["opt"],              dataLayer: "global" },
    { num: "05", id: "characters", title: "角色调用",   tags: ["req"],              dataLayer: "global" },
    { num: "06", id: "story",      title: "故事内容",   tags: ["req"],              dataLayer: "global" },
    { num: "07", id: "ambientSfx", title: "环境音效",   tags: ["opt"],              dataLayer: "output" },
    { num: "08", id: "subtitle",   title: "字幕",       tags: ["opt"],              dataLayer: "output" },
    { num: "09", id: "music",      title: "背景音乐",   tags: ["opt"],              dataLayer: "output" },
    { num: "10", id: "narrationAudio", title: "旁白音频", tags: ["opt", "audio"],   dataLayer: "global" },
  ],
  shot: [
    { num: "11", id: "shotSize",  title: "景别",         tags: ["opt"] },
    { num: "12", id: "duration",  title: "分镜时长分配", tags: ["opt"] },
    { num: "13", id: "action",    title: "角色动作",     tags: ["req"] },
    { num: "14", id: "micro",     title: "微表情控制",   tags: ["opt"] },
    { num: "15", id: "gesture",   title: "小动作控制",   tags: ["opt"] },
    { num: "16", id: "camera",    title: "摄像机运动",   tags: ["opt"] },
    { num: "17", id: "lines",     title: "台词",         tags: ["opt"] },
    { num: "18", id: "mono",      title: "内心独白",     tags: ["opt"] },
    { num: "19", id: "narration", title: "旁白",         tags: ["opt"] },
    { num: "20", id: "sfx",       title: "关键动作音效", tags: ["opt"] },
  ],
};

export const MODULE_HELPS: Record<string, string> = {
  "g.duration":   "整支视频的目标总时长，必填。常用 5 / 10 / 15 秒，也可自定义。各分镜可在「分镜时长分配」里单独指定，留空的分镜由系统在总时长内自动均摊。",
  "g.scene":      "上传场景参考图。如果是多视角场景，请把多个视角拼成一张图片再上传；上传多张时可手动选定主场景。",
  "g.position":   "用一张简笔示意角色在画面中的相对位置，避免模型自由发挥。",
  "g.style":      "选择整支视频的视觉表现形式（单选）。",
  "g.characters": "从角色库选择本剧涉及的角色，未在此处出现的角色无法在分镜里被引用。",
  "g.story":      "整支视频的叙事骨架。建议 50–200 字，过短信息不足，过长易被截断。",
  "g.ambientSfx": "贯穿整支视频的背景声场，单条输入即可。",
  "g.subtitle":   "是否为整支视频生成字幕，默认关闭。",
  "g.music":      "是否生成贯穿全片的背景音乐，默认关闭。",
  "g.narrationAudio": "上传整支视频的旁白配音音频，对应各分镜里填写的旁白文字。单条上传即可。",
};

export interface CameraMoveMeta {
  id: string;
  cn: string;
  en: string;
  needsDir: boolean;
}

export const CAMERA_MOVES: { basic: CameraMoveMeta[]; advanced: CameraMoveMeta[]; special: CameraMoveMeta[] } = {
  basic: [
    { id: "push_in",  cn: "推镜", en: "Push In",   needsDir: false },
    { id: "pull_out", cn: "拉镜", en: "Pull Out",  needsDir: false },
    { id: "pan_l",    cn: "左摇", en: "Pan Left",  needsDir: false },
    { id: "pan_r",    cn: "右摇", en: "Pan Right", needsDir: false },
    { id: "tilt_u",   cn: "上摇", en: "Tilt Up",   needsDir: false },
    { id: "tilt_d",   cn: "下摇", en: "Tilt Down", needsDir: false },
    { id: "boom_u",   cn: "升镜", en: "Boom Up",   needsDir: false },
    { id: "boom_d",   cn: "降镜", en: "Boom Down", needsDir: false },
  ],
  advanced: [
    { id: "follow",     cn: "跟拍", en: "Follow",      needsDir: true  },
    { id: "orbit",      cn: "环绕", en: "Orbit / Arc", needsDir: true  },
    { id: "dolly_zoom", cn: "对拉", en: "Dolly Zoom",  needsDir: false },
    { id: "whip_pan",   cn: "甩镜", en: "Whip Pan",    needsDir: true  },
  ],
  special: [
    { id: "aerial",   cn: "航拍 / 俯视", en: "Aerial / Top-down", needsDir: false },
    { id: "handheld", cn: "手持",        en: "Handheld",          needsDir: false },
    { id: "pov",      cn: "主观视角",    en: "POV",               needsDir: false },
    { id: "ots",      cn: "过肩镜头",    en: "Over-the-Shoulder", needsDir: false },
  ],
};

export const CAMERA_TIER_LABEL: Record<string, string> = {
  basic: "基础运动",
  advanced: "进阶运动",
  special: "特殊视角",
};

export interface ShotSizeMeta {
  id: string;
  cn: string;
  en: string;
}

export const SHOT_SIZES: ShotSizeMeta[] = [
  { id: "els", cn: "大远景", en: "Extreme Long Shot" },
  { id: "ls",  cn: "远景",   en: "Long Shot" },
  { id: "fs",  cn: "全景",   en: "Full Shot" },
  { id: "mls", cn: "中全景", en: "Medium Long Shot" },
  { id: "ms",  cn: "中景",   en: "Medium Shot" },
  { id: "mcu", cn: "中近景", en: "Medium Close-Up" },
  { id: "cu",  cn: "近景",   en: "Close-Up" },
  { id: "bcu", cn: "特写",   en: "Big Close-Up" },
  { id: "ecu", cn: "大特写", en: "Extreme Close-Up" },
];

export const SPEED_OPTS = ["慢", "中", "快"] as const;
export const MAGNITUDE_OPTS = ["小", "中", "大"] as const;
export const DIR_OPTS = ["左", "右", "上", "下"] as const;
