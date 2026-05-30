// lib/uploadGlobalImage.ts —— 全局媒体(图片 / 音频 / 视频)直传 TOS
//
// 文件名沿用 uploadGlobalImage 是历史遗留 — v0.9.2 引入时只覆盖图片,
// v0.9.3 起扩到音频(FNarrationAudio / FSpeech)和未来的视频。
//
// 设计原则:跟角色库素材一致,浏览器侧 SigV4 直传到 TOS,拿公网 URL。
// 跟角色库的差异:
//   - 不调 SeeGen CreateAsset(全局素材不属于角色,无审核必要)
//   - 不写 localStorage 缓存(URL 字符串直接存进 project 字段)
//
// 校验:扩展名 + 大小,按媒体类型分别约束。

import { uploadFileToTos, type TosUploadResult } from "@/api/tosUpload";

// ─────────── 媒体类型与硬约束 ───────────

export type MediaKind = "image" | "audio" | "video";

const KIND_CONFIG: Record<MediaKind, {
  exts: string[];
  maxMb: number;
  defaultPrefix: string;
  label: string;
}> = {
  image: {
    exts: ["jpg", "jpeg", "png", "webp", "gif", "heic"],
    maxMb: 30,
    defaultPrefix: "global_images",
    label: "图片",
  },
  audio: {
    exts: ["mp3", "wav", "m4a", "ogg"],
    maxMb: 15,
    defaultPrefix: "global_audios",
    label: "音频",
  },
  video: {
    exts: ["mp4", "mov", "webm"],
    maxMb: 50,
    defaultPrefix: "global_videos",
    label: "视频",
  },
};

// ─────────── 通用入口 ───────────

export interface UploadMediaOptions {
  /** TOS 内子目录;不传则按 kind 选默认值 */
  prefix?: string;
}

/**
 * 校验 → SigV4 直传 → 返回 TOS 公网 URL。
 * 失败时抛 Error,调用方自己 toast。
 */
export async function uploadMedia(
  file: File,
  kind: MediaKind,
  opts: UploadMediaOptions = {},
): Promise<TosUploadResult> {
  const cfg = KIND_CONFIG[kind];
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!cfg.exts.includes(ext)) {
    throw new Error(
      `${cfg.label}格式不支持: .${ext}(仅支持 ${cfg.exts.join(" / ")})`,
    );
  }
  const sizeMb = file.size / (1024 * 1024);
  if (sizeMb > cfg.maxMb) {
    throw new Error(`${cfg.label}过大: ${sizeMb.toFixed(1)} MB(上限 ${cfg.maxMb} MB)`);
  }
  return uploadFileToTos(file, { prefix: opts.prefix ?? cfg.defaultPrefix });
}

// ─────────── 三个便捷函数(向后兼容旧 import) ───────────

export function uploadGlobalImage(
  file: File,
  opts: UploadMediaOptions = {},
): Promise<TosUploadResult> {
  return uploadMedia(file, "image", opts);
}

export function uploadGlobalAudio(
  file: File,
  opts: UploadMediaOptions = {},
): Promise<TosUploadResult> {
  return uploadMedia(file, "audio", opts);
}

export function uploadGlobalVideo(
  file: File,
  opts: UploadMediaOptions = {},
): Promise<TosUploadResult> {
  return uploadMedia(file, "video", opts);
}
