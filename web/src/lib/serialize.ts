import type { AssetKind, Character, Project } from "@/types";

export interface SerializedShot {
  id: string;
  name: string;
  shot_size: string | null;
  action: Project["shots"][number]["action"];
  action_strength: number;
  micro: Project["shots"][number]["micro"];
  micro_strength: number;
  gesture: string;
  gesture_strength: number;
  duration_seconds: number | null;
  camera: Project["shots"][number]["camera"];
  lines: Project["shots"][number]["lines"];
  mono: Project["shots"][number]["mono"];
  narration: Project["shots"][number]["narration"];
  sfx: string;
}

/**
 * 单个角色的 asset:// 引用清单。
 * 视频生成 API 调用时按 PRD §2.2.3 的格式拼装：
 *   { type: "image_url", image_url: { url: image_uri }, role: "reference_image" }
 */
export interface SerializedCharAssetRef {
  character_id: string;
  character_name: string;
  image_uri: string | null;  // asset://{ark_asset_id}
  audio_uri: string | null;  // asset://{ark_asset_id}（声线参考）
  video_uri: string | null;  // asset://{ark_asset_id}（视频续写参考，若有）
}

export interface SerializedProject {
  global: {
    total_duration_seconds: number | null;
    /** 场景参考图(单图):外链 URL 或本地上传的 base64 data URL,未上传为 null */
    scene: string | null;
    position: string | null;
    prop: string | null;
    style: string[];
    characters: string[];
    story: string;
    narration_audio: string | null;
  };
  shots: SerializedShot[];
  output: { ambient_sfx: string; subtitle: boolean; music: boolean };
  /** 本次 prompt 用到的所有 asset:// 引用，按 global.characters 顺序（PRD-v0.5 §2.2.3） */
  asset_refs: SerializedCharAssetRef[];
}

export function serializeProject(p: Project, characters: Character[] = []): SerializedProject {
  const charMap = new Map(characters.map((c) => [c.id, c]));
  const assetRefs: SerializedCharAssetRef[] = (p.global.characters ?? []).map((id) => {
    const c = charMap.get(id);
    return {
      character_id: id,
      character_name: c?.name ?? id,
      image_uri: toAssetUri(c?.asset_bundle?.primary_image_ark_asset_id),
      audio_uri: toAssetUri(c?.asset_bundle?.primary_audio_ark_asset_id),
      video_uri: toAssetUri(c?.asset_bundle?.primary_video_ark_asset_id),
    };
  });

  return {
    global: {
      total_duration_seconds: p.global.total_duration_seconds ?? null,
      scene: p.global.scene_image ?? null,
      position: p.global.position_image_url ?? null,
      prop: p.global.prop_image_url ?? null,
      style: p.global.style ?? [],
      characters: p.global.characters ?? [],
      story: p.global.story ?? "",
      narration_audio: p.global.narration_audio_url ?? null,
    },
    shots: p.shots.map((s) => ({
      id: s.id,
      name: s.name,
      shot_size: s.shot_size ?? null,
      action: s.action,
      action_strength: s.action_strength ?? 65,
      micro: s.micro,
      micro_strength: s.micro_strength ?? 65,
      gesture: s.gesture ?? "",
      gesture_strength: s.gesture_strength ?? 65,
      duration_seconds: s.duration_seconds ?? null,
      camera: s.camera ?? [],
      lines: s.lines?.text ? s.lines : null,
      mono: s.mono?.text ? s.mono : null,
      narration: s.narration?.text ? s.narration : null,
      sfx: s.sfx ?? "",
    })),
    output: {
      ambient_sfx: p.output.ambient_sfx ?? "",
      subtitle: !!p.output.subtitle,
      music: !!p.output.music,
    },
    asset_refs: assetRefs,
  };
}

function toAssetUri(arkId: string | null | undefined): string | null {
  return arkId ? `asset://${arkId}` : null;
}

/** 标识 kind 是否对当前角色有 asset，便于调用方做空值过滤 */
export function hasCharAsset(ref: SerializedCharAssetRef, kind: AssetKind): boolean {
  if (kind === "image") return !!ref.image_uri;
  if (kind === "audio") return !!ref.audio_uri;
  if (kind === "video") return !!ref.video_uri;
  return false;
}
