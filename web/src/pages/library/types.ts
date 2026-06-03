// 场景库 / 道具库共用的轻量数据形状（Scene 与 Prop 结构一致）。
export interface MediaItem {
  id: string;
  name: string;
  image_url: string | null;
  hue: number;
  created_at: string;
  updated_at: string;
}

export type MediaUpsert = { name: string; image_url: string | null; hue: number };
