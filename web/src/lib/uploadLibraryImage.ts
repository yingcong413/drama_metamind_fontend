// lib/uploadLibraryImage.ts —— 场景库 / 道具库参考图上传
//
// 与 uploadGlobalImage 的差异:这里要在 mock / 无 TOS 凭据环境下也能用,
// 所以先尝试 TOS 直传,失败(如「TOS 凭据未配置」)则回退到本地 base64 data URL。
// 轻量库资源的图直接存进资源记录的 image_url 字段。

import { uploadMedia, type MediaKind } from "./uploadGlobalImage";

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}

/**
 * 轻量素材上传(图片 / 音频 / 视频):先尝试 TOS 直传,失败(如 mock / 无凭据)则
 * 回退到本地 base64 data URL,URL 直接存进资源记录字段。
 */
export async function uploadLibraryMedia(
  file: File,
  kind: MediaKind,
  prefix: string,
): Promise<string> {
  try {
    const { url } = await uploadMedia(file, kind, { prefix });
    return url;
  } catch (e) {
    console.warn("TOS 上传失败，回退到本地 base64", e);
    return readAsDataUrl(file);
  }
}

export function uploadLibraryImage(file: File, prefix: string): Promise<string> {
  return uploadLibraryMedia(file, "image", prefix);
}
