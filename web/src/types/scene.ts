// 场景库资源：跨项目复用的全局资源，编辑器「字段 04 · 场景」通过 id 引用。
// 轻量模型：只含 名字 + 参考图（与角色库的重型 asset_bundle / ark_group 体系不同）。
export interface Scene {
  id: string;
  name: string;
  /** 场景参考图 URL（TOS 公网 URL 或本地上传的 base64 data URL）；未上传为 null */
  image_url: string | null;
  hue: number;
  created_at: string;
  updated_at: string;
}
