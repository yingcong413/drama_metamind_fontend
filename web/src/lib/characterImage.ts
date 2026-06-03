import type { Character } from "@/types";

// 角色的真实参考图：优先 active 主图，其次兼容期的 ref_image_url。无图返回 null（由调用方回退到 SVG 头像）。
export function characterImage(c: Character): string | null {
  return c.asset_bundle?.primary_image_url || c.ref_image_url || null;
}
