// lib/cropGrid.ts —— 把「N 宫格分镜头脚本」整图严格裁成 N 格,逐格上传 TOS。
//
// 用于「整图 + 自动建分镜」时,让第 k 个分镜配上第 k 格的裁切图(逐格对齐)。
// 优先从 data URL(b64)裁切——同源、不会污染 canvas;退化到公网 URL 时需 TOS 允许 CORS。

import { uploadGlobalImage } from "./uploadGlobalImage";

/** 宫格数 → 列数 × 行数。常见档位显式给,其余按近似正方形推导。 */
export function gridLayout(n: number): { cols: number; rows: number } {
  const MAP: Record<number, [number, number]> = {
    4: [2, 2], 6: [3, 2], 8: [4, 2], 9: [3, 3], 10: [5, 2],
    12: [4, 3], 15: [5, 3], 16: [4, 4],
  };
  if (MAP[n]) return { cols: MAP[n][0], rows: MAP[n][1] };
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  return { cols, rows };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // data URL 同源,无需(也不应)设 crossOrigin;公网 URL 设了才可能不污染 canvas。
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("分镜头脚本整图加载失败,无法裁切"));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("裁切导出失败"))), "image/png");
  });
}

/**
 * 把宫格整图裁成 count 格,逐格上传,返回每格 TOS URL(数组顺序 = 镜号 1..count)。
 * 任意一步失败都会抛出;调用方应 try/catch 并在失败时退化为「不配格图」。
 */
export async function cropGridToUrls(src: string, count: number): Promise<string[]> {
  const { cols, rows } = gridLayout(count);
  const img = await loadImage(src);
  const cellW = Math.floor(img.naturalWidth / cols);
  const cellH = Math.floor(img.naturalHeight / rows);
  if (cellW <= 0 || cellH <= 0) throw new Error("整图尺寸异常,无法裁切");

  const urls: string[] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const canvas = document.createElement("canvas");
    canvas.width = cellW;
    canvas.height = cellH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 不可用");
    ctx.drawImage(img, c * cellW, r * cellH, cellW, cellH, 0, 0, cellW, cellH);
    const blob = await canvasToBlob(canvas);
    const file = new File([blob], `sb_cell_${i + 1}_${Date.now()}.png`, { type: "image/png" });
    const { url } = await uploadGlobalImage(file, { prefix: "global_storyboard_cells" });
    urls.push(url);
  }
  return urls;
}
