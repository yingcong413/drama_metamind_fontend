// types/asset.ts —— 火山方舟 Seedance 私域素材库（PRD-v0.5 §2.2）
//
// 一个角色（Character）= 一个 AssetGroup（火山侧）= N 个 Asset。
// 前端使用 snake_case；后端在序列化层做与火山 PascalCase 字段的映射。

export type AssetKind = "image" | "video" | "audio";

/**
 * 五态状态机（PRD §2.1.4.3）
 *  uploading  - 前端正在 PUT 到后端；后端 PutObject 中
 *  processing - 已 CreateAsset，火山在做人脸/视频一致性校验
 *  active     - 校验通过，可用于视频生成
 *  failed     - 校验未通过（侧脸 / 多人 / 光线 / 一致性失败）
 *  rejected   - 真人授权场景下被使用方拒收（本期不接入）
 */
export type AssetStatus =
  | "uploading"
  | "processing"
  | "active"
  | "failed"
  | "rejected";

export type AssetImageRole =
  | "primary"
  | "front"
  | "side"
  | "back"
  | "full_body"
  | "expression"
  | "other";

export type AssetVideoRole = "primary" | "clip" | "other";

export type AssetAudioRole =
  | "primary"
  | "calm"
  | "intense"
  | "whisper"
  | "other";

export type AssetRole = AssetImageRole | AssetVideoRole | AssetAudioRole;

export interface Asset {
  /** 我方 ID（up_xxx），与火山 ark_asset_id 解耦，便于将来切供应商 */
  id: string;
  /** 所属组织（模块二），用于共享判定 */
  org_id: string;
  /** 1:N 反向关联：角色 → 素材 */
  character_id: string;
  kind: AssetKind;
  /** TOS 公网 URL；processing/failed 期间可能为 null */
  url: string | null;
  /** 视频/图像缩略图；音频为 null */
  thumbnail_url: string | null;
  role_in_bundle: AssetRole;
  original_filename: string;
  size_bytes: number;

  // —— 火山方舟侧元信息 ——
  /** 火山 OpenAPI CreateAsset 返回值，用于 `asset://` URI 引用 */
  ark_asset_id: string | null;
  status: AssetStatus;
  /** status=failed 时的原因，用于前端展示「失败：xxx」 */
  processing_error: string | null;

  // —— 媒体元信息（按 kind 选填） ——
  width: number | null;
  height: number | null;
  /** video / audio 时长（秒） */
  duration_seconds: number | null;
  /** video only */
  fps: number | null;
  mime: string;

  /** user_id，便于审计「谁传的」 */
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * 构造 prompt 引用素材时使用的 URI。
 * 火山方舟视频生成 API 要求：`asset://{ark_asset_id}`
 * 参考 docs/seedance_sucai/lurusucai.md 末尾示例。
 */
export function assetUri(asset: Pick<Asset, "ark_asset_id">): string | null {
  return asset.ark_asset_id ? `asset://${asset.ark_asset_id}` : null;
}

/** Asset 是否处于可用于生成的「就绪」状态 */
export function isAssetReady(asset: Pick<Asset, "status">): boolean {
  return asset.status === "active";
}
