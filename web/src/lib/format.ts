import { t } from "@/lib/i18n";

export function formatYuan(cents: number): string {
  return (cents / 100).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

export function formatYuanInt(cents: number): string {
  return Math.floor(cents / 100).toLocaleString("zh-CN");
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function formatRelative(iso: string, now: Date = new Date()): string {
  const ts = new Date(iso).getTime();
  const diff = (now.getTime() - ts) / 1000;
  const rel = (zh: string, n: number) => t(zh).replace("{n}", String(n));
  if (diff < 60) return t("刚刚");
  if (diff < 3600) return rel("{n} 分钟前", Math.floor(diff / 60));
  if (diff < 86400) return rel("{n} 小时前", Math.floor(diff / 3600));
  if (diff < 86400 * 7) return rel("{n} 天前", Math.floor(diff / 86400));
  if (diff < 86400 * 30) return rel("{n} 周前", Math.floor(diff / 86400 / 7));
  if (diff < 86400 * 365) return rel("{n} 个月前", Math.floor(diff / 86400 / 30));
  return rel("{n} 年前", Math.floor(diff / 86400 / 365));
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** 判断字符串是否为可被 <img>/<audio> 直接加载的 URL(data: / http(s)://) */
export function isLoadableUrl(s: string | null | undefined): boolean {
  if (!s) return false;
  return /^(data:|https?:\/\/)/i.test(s);
}

/**
 * 从 URL / 文件路径里提取最后一段作为友好显示名。
 *   https://x.com/a/b/scene_night.jpg     → "scene_night.jpg"
 *   asset://asset-xxx                     → "asset-xxx"
 *   data:image/png;base64,iVBOR...        → "本地上传"(data URL 太长,不展开)
 *   纯标签字符串(如 "街道 · 雨夜")            → 原样返回
 */
export function filenameFromUrl(s: string | null | undefined, dataUrlLabel = t("本地上传")): string {
  if (!s) return "";
  if (s.startsWith("data:")) return dataUrlLabel;
  // 优先解析 URL
  try {
    const u = new URL(s);
    const last = u.pathname.split("/").filter(Boolean).pop();
    if (last) return decodeURIComponent(last);
  } catch {
    /* not a URL — fall through */
  }
  // asset://asset-xxx 这种自定义 scheme
  const idx = s.lastIndexOf("/");
  if (idx >= 0 && idx < s.length - 1) return s.slice(idx + 1);
  return s;
}
