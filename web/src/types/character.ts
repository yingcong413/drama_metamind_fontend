/**
 * 角色变体(v0.9.x §角色变体):同一角色的不同造型/形态。
 * 每个变体自带名字、描述、主图、多角度图与声音参考,存在角色记录上。
 * 图片 / 音频字段是 http(s):// URL 或 base64 data: URL(mock 回退)。
 */
export interface CharacterVariant {
  id: string;
  name: string;
  desc: string;
  image_url: string | null;
  angle_images: string[];
  voice_url: string | null;
}

export interface Character {
  id: string;
  /** 所属组织（v0.5 新增，模块二 / §2.2） */
  org_id: string;
  name: string;
  role: string;
  desc: string;
  tags: string[];

  // —— 多上游素材库映射（v0.9.4 §2.8 多上游切换） ——
  /**
   * 该角色当前 ark_group_id 是用哪个上游建的。
   * 当编译期 VITE_ASSET_LIB_PROVIDER 切换后,assets.ts 的 ensureRealAssetGroup
   * 会检测 asset_provider !== currentProvider 并重新建组。
   * 未上传过素材的角色为 null。
   */
  asset_provider: "seegen" | "volcano_ark" | null;
  /** CreateAssetGroup 返回的 GroupId；建角色失败则 character 不入库 */
  ark_group_id: string | null;
  /** 火山项目命名空间（默认环境变量 ARK_PROJECT_NAME，如 "haoqing3.3"） */
  ark_project_name: string;
  /** 后端组装的素材聚合视图，前端用于渲染角色卡片徽标与抽屉头部 */
  asset_bundle: {
    counts: { image: number; video: number; audio: number };
    /** 仅取 status=active 的 primary 素材；processing/failed 不参与 */
    primary_image_url: string | null;
    primary_video_url: string | null;
    primary_audio_url: string | null;
    /** primary 素材的 ark_asset_id，构造 prompt asset:// URI 用 */
    primary_image_ark_asset_id: string | null;
    primary_video_ark_asset_id: string | null;
    primary_audio_ark_asset_id: string | null;
    processing_count: number;
    failed_count: number;
  };

  // —— 兼容字段（迁移期保留，下个版本下线） ——
  ref_image_url: string | null;
  ref_images: string[];
  voice_sample_url: string | null;

  hue: number;
  has_ref: boolean;
  /** 是否启用「角色变体」。开启后用 variants 管理多套造型,关闭则用上面的单套素材。 */
  has_variants?: boolean;
  /** 角色变体列表(has_variants 为 true 时生效)。 */
  variants?: CharacterVariant[];
  created_at: string;
  updated_at: string;
}
