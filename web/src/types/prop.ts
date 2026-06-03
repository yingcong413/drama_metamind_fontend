// 道具库资源：跨项目复用的全局资源，编辑器「字段 06 · 道具」通过 id 引用。
// 轻量模型：只含 名字 + 参考图。
export interface Prop {
  id: string;
  name: string;
  /** 道具参考图 URL（TOS 公网 URL 或本地上传的 base64 data URL）；未上传为 null */
  image_url: string | null;
  hue: number;
  created_at: string;
  updated_at: string;
}
