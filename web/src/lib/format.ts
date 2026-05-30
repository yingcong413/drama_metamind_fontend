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
  const t = new Date(iso).getTime();
  const diff = (now.getTime() - t) / 1000;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400 / 7)} 周前`;
  if (diff < 86400 * 365) return `${Math.floor(diff / 86400 / 30)} 个月前`;
  return `${Math.floor(diff / 86400 / 365)} 年前`;
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
export function filenameFromUrl(s: string | null | undefined, dataUrlLabel = "本地上传"): string {
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
