// assetValidator.ts —— 前端预校验，对齐 PRD-v0.5 §2.1.1 硬约束
// 镜像 docs/seedance_sucai/upload_virtual_avatar.py 的 validate_image / validate_video / validate_audio
//
// 同步校验：扩展名 + 文件大小（立即返回，不阻塞 UI）
// 异步校验：宽高 / 时长 / 帧率（用 <img> / <video> 探测，约 100-500ms）
//
// 用法（CharacterDrawer 内）：
//   const issues = await validateAssetFile(file, kindFromExt(file.name));
//   if (issues.length) { showErrors(issues); return; }
//   await uploadAsset({ file, character_id, kind });

import type { AssetKind } from "@/types";

export type ValidationIssue = string;

// ============ 硬约束常量（与 upload_virtual_avatar.py 完全一致） ============

const IMAGE_FORMATS = new Set(["jpeg", "jpg", "png", "webp", "gif", "heic"]);
const IMAGE_MAX_SIZE_MB = 30;
const IMAGE_ASPECT_RATIO_RANGE: [number, number] = [0.4, 2.5];
const IMAGE_DIMENSION_RANGE: [number, number] = [300, 6000];

const VIDEO_FORMATS = new Set(["mp4", "mov"]);
const VIDEO_MAX_SIZE_MB = 50;
const VIDEO_DURATION_RANGE: [number, number] = [2, 15];
// 注：fps 范围 [24, 60] 浏览器侧无法可靠探测，后端用 ffprobe 兜底校验
const VIDEO_ASPECT_RATIO_RANGE: [number, number] = [0.4, 2.5];
const VIDEO_DIMENSION_RANGE: [number, number] = [300, 6000];
const VIDEO_PIXEL_RANGE: [number, number] = [409_600, 927_408];

const AUDIO_FORMATS = new Set(["mp3", "wav"]);
const AUDIO_MAX_SIZE_MB = 15;
const AUDIO_DURATION_RANGE: [number, number] = [2, 15];

// ============ 工具 ============

function ext(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function inRange(v: number, [lo, hi]: [number, number]): boolean {
  return v >= lo && v <= hi;
}

/** 根据文件扩展名推断 AssetKind；未知返回 null */
export function kindFromFilename(name: string): AssetKind | null {
  const e = ext(name);
  if (IMAGE_FORMATS.has(e)) return "image";
  if (VIDEO_FORMATS.has(e)) return "video";
  if (AUDIO_FORMATS.has(e)) return "audio";
  return null;
}

// ============ 同步校验：扩展名 + 大小 ============

export function validateExtAndSize(file: File, kind: AssetKind): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const e = ext(file.name);
  const sizeMB = file.size / 1024 / 1024;

  if (kind === "image") {
    if (!IMAGE_FORMATS.has(e)) {
      issues.push(`图片格式不支持：.${e}（仅支持 ${[...IMAGE_FORMATS].join("/")}）`);
    }
    if (sizeMB > IMAGE_MAX_SIZE_MB) {
      issues.push(`图片过大：${sizeMB.toFixed(1)}MB > ${IMAGE_MAX_SIZE_MB}MB`);
    }
  } else if (kind === "video") {
    if (!VIDEO_FORMATS.has(e)) {
      issues.push(`视频格式不支持：.${e}（仅支持 ${[...VIDEO_FORMATS].join("/")}）`);
    }
    if (sizeMB > VIDEO_MAX_SIZE_MB) {
      issues.push(`视频过大：${sizeMB.toFixed(1)}MB > ${VIDEO_MAX_SIZE_MB}MB`);
    }
  } else if (kind === "audio") {
    if (!AUDIO_FORMATS.has(e)) {
      issues.push(`音频格式不支持：.${e}（仅支持 ${[...AUDIO_FORMATS].join("/")}）`);
    }
    if (sizeMB > AUDIO_MAX_SIZE_MB) {
      issues.push(`音频过大：${sizeMB.toFixed(1)}MB > ${AUDIO_MAX_SIZE_MB}MB`);
    }
  }

  return issues;
}

// ============ 异步校验：尺寸 / 时长 / 帧率 ============

async function probeImageDimensions(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("无法解码图片"));
    };
    img.src = url;
  });
}

async function probeVideoMeta(
  file: File
): Promise<{ w: number; h: number; duration: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({
        w: v.videoWidth,
        h: v.videoHeight,
        duration: v.duration,
      });
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("无法解码视频元数据"));
    };
    v.src = url;
  });
}

async function probeAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement("audio");
    a.preload = "metadata";
    a.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(a.duration);
    };
    a.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("无法解码音频元数据"));
    };
    a.src = url;
  });
}

export async function validateImage(file: File): Promise<ValidationIssue[]> {
  const issues = validateExtAndSize(file, "image");
  try {
    const { w, h } = await probeImageDimensions(file);
    if (!inRange(w, IMAGE_DIMENSION_RANGE)) {
      issues.push(`图片宽度 ${w}px 超出 [${IMAGE_DIMENSION_RANGE[0]}, ${IMAGE_DIMENSION_RANGE[1]}]`);
    }
    if (!inRange(h, IMAGE_DIMENSION_RANGE)) {
      issues.push(`图片高度 ${h}px 超出 [${IMAGE_DIMENSION_RANGE[0]}, ${IMAGE_DIMENSION_RANGE[1]}]`);
    }
    const aspect = h > 0 ? w / h : 0;
    if (!inRange(aspect, IMAGE_ASPECT_RATIO_RANGE)) {
      issues.push(
        `图片宽高比 ${aspect.toFixed(2)} 超出 [${IMAGE_ASPECT_RATIO_RANGE[0]}, ${IMAGE_ASPECT_RATIO_RANGE[1]}]`
      );
    }
  } catch (e) {
    issues.push(`图片元数据探测失败：${(e as Error).message}`);
  }
  return issues;
}

export async function validateVideo(file: File): Promise<ValidationIssue[]> {
  const issues = validateExtAndSize(file, "video");
  try {
    const { w, h, duration } = await probeVideoMeta(file);
    if (w && h) {
      if (!inRange(w, VIDEO_DIMENSION_RANGE)) {
        issues.push(`视频宽度 ${w}px 超出 [${VIDEO_DIMENSION_RANGE[0]}, ${VIDEO_DIMENSION_RANGE[1]}]`);
      }
      if (!inRange(h, VIDEO_DIMENSION_RANGE)) {
        issues.push(`视频高度 ${h}px 超出 [${VIDEO_DIMENSION_RANGE[0]}, ${VIDEO_DIMENSION_RANGE[1]}]`);
      }
      const aspect = w / h;
      if (!inRange(aspect, VIDEO_ASPECT_RATIO_RANGE)) {
        issues.push(`视频宽高比 ${aspect.toFixed(2)} 超出 [${VIDEO_ASPECT_RATIO_RANGE[0]}, ${VIDEO_ASPECT_RATIO_RANGE[1]}]`);
      }
      const pixels = w * h;
      if (!inRange(pixels, VIDEO_PIXEL_RANGE)) {
        issues.push(`视频像素数 ${pixels} 超出 [${VIDEO_PIXEL_RANGE[0]}, ${VIDEO_PIXEL_RANGE[1]}]`);
      }
    }
    if (duration && !inRange(duration, VIDEO_DURATION_RANGE)) {
      issues.push(`视频时长 ${duration.toFixed(1)}s 超出 [${VIDEO_DURATION_RANGE[0]}, ${VIDEO_DURATION_RANGE[1]}]s`);
    }
    // 浏览器无法直接读 fps；后端 ffprobe 兜底校验 VIDEO_FPS_RANGE
  } catch (e) {
    issues.push(`视频元数据探测失败：${(e as Error).message}`);
  }
  return issues;
}

export async function validateAudio(file: File): Promise<ValidationIssue[]> {
  const issues = validateExtAndSize(file, "audio");
  try {
    const duration = await probeAudioDuration(file);
    if (duration && !inRange(duration, AUDIO_DURATION_RANGE)) {
      issues.push(`音频时长 ${duration.toFixed(1)}s 超出 [${AUDIO_DURATION_RANGE[0]}, ${AUDIO_DURATION_RANGE[1]}]s`);
    }
  } catch (e) {
    issues.push(`音频元数据探测失败：${(e as Error).message}`);
  }
  return issues;
}

/** 统一入口：按 kind 分发；未知 kind 直接报错 */
export async function validateAssetFile(file: File, kind: AssetKind): Promise<ValidationIssue[]> {
  if (kind === "image") return validateImage(file);
  if (kind === "video") return validateVideo(file);
  if (kind === "audio") return validateAudio(file);
  return [`未知的素材类型：${kind}`];
}
