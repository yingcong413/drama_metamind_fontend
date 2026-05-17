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
    { num: "01", id: "time",       title: "时间",       tags: ["opt"],              dataLayer: "global" },
    { num: "02", id: "scene",      title: "场景",       tags: ["upload"],           dataLayer: "global" },
    { num: "03", id: "position",   title: "站位图",     tags: ["opt", "upload"],    dataLayer: "global" },
    { num: "04", id: "style",      title: "影像风格",   tags: ["opt"],              dataLayer: "global" },
    { num: "05", id: "characters", title: "角色调用",   tags: ["req"],              dataLayer: "global" },
    { num: "06", id: "story",      title: "故事内容",   tags: ["req"],              dataLayer: "global" },
    { num: "07", id: "ambientSfx", title: "环境音效",   tags: ["opt"],              dataLayer: "output" },
    { num: "08", id: "subtitle",   title: "字幕",       tags: ["opt"],              dataLayer: "output" },
    { num: "09", id: "music",      title: "背景音乐",   tags: ["opt"],              dataLayer: "output" },
  ],
  shot: [
    { num: "10", id: "action",    title: "角色动作",     tags: ["req"] },
    { num: "11", id: "micro",     title: "微表情控制",   tags: ["opt"] },
    { num: "12", id: "gesture",   title: "小动作控制",   tags: ["opt"] },
    { num: "13", id: "camera",    title: "摄像机运动",   tags: ["opt"] },
    { num: "14", id: "lines",     title: "台词",         tags: ["opt", "audio"] },
    { num: "15", id: "mono",      title: "内心独白",     tags: ["opt", "audio"] },
    { num: "16", id: "narration", title: "旁白",         tags: ["opt", "audio"] },
    { num: "17", id: "sfx",       title: "关键动作音效", tags: ["opt"] },
  ],
};

export const MODULE_HELPS: Record<string, string> = {
  "g.time":       "通过勾选确定季节与时段，模型据此调整光线与色温。",
  "g.scene":      "上传一张或多张场景参考图。单张时自动启用；多张可手动选定主场景。",
  "g.position":   "用一张简笔示意角色在画面中的相对位置，避免模型自由发挥。",
  "g.style":      "勾选整支视频的视觉表现形式，可多选叠加。",
  "g.characters": "从角色库选择本剧涉及的角色，未在此处出现的角色无法在分镜里被引用。",
  "g.story":      "整支视频的叙事骨架。建议 50–200 字，过短信息不足，过长易被截断。",
  "g.ambientSfx": "贯穿整支视频的背景声场，单条输入即可。",
  "g.subtitle":   "是否为整支视频生成字幕，默认关闭。",
  "g.music":      "是否生成贯穿全片的背景音乐，默认关闭。",
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

export const SPEED_OPTS = ["慢", "中", "快"] as const;
export const MAGNITUDE_OPTS = ["小", "中", "大"] as const;
export const DIR_OPTS = ["左", "右", "上", "下"] as const;
