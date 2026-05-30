// api/assets.ts —— 角色素材上传(真实接通 上游 provider + TOS)
//
// v0.9.4 §2.8 多上游素材库:provider 由 assetProvider.ts 工厂决定,
// 编译期 VITE_ASSET_LIB_PROVIDER=seegen|volcano_ark 切换。
//
// 流程(provider-agnostic):
//   1. 浏览器侧 validateAssetFile 校验文件格式/大小
//   2. tosUpload.uploadFileToTos 直传到 TOS,拿公网 URL
//   3. 角色第一次上传时调用 provider.createAssetGroup,把返回的 group id +
//      provider name 一起回写到 character (mockSetCharacterArkGroup)
//   4. provider.createAsset 把 TOS URL 注册成上游素材,返回 status=processing 的 asset
//   5. useAssetPolling 周期性调 getAsset → provider.getAsset,直到 active/failed
//
// 多上游切换的关键点:character.asset_provider !== currentProvider 时,
// 旧的 ark_group_id 不能跨上游复用,ensureRealAssetGroup 会重新建组。
// 已上传的素材也只能在原 provider 查到(不做迁移)。
//
// 我们仍然在 localStorage 维护一张本地 asset 缓存(metamind-mock-v1-assets),
// 角色 → 资产 列表由这个缓存提供 —— 因为我们没有自建后端来 join character 与
// provider 的 group。computeMockAssetBundle 也基于这个缓存算 character 卡片徽标。

import { uploadFileToTos } from "./tosUpload";
import {
  getCurrentProvider,
  getCurrentProviderName,
  type AssetGetResp,
} from "./assetProvider";
import { mockGetCharacter, mockSetCharacterArkGroup } from "./_mock";
import { loadJSON, saveJSON } from "./_mockStorage";
import type { Asset, AssetKind, AssetRole, Character } from "@/types";

// ─────────── 入参 ───────────

export interface UploadAssetInput {
  file: File;
  character_id: string;
  kind: AssetKind;
  role_in_bundle?: AssetRole;
}

// ─────────── 本地缓存(替代旧 mockStore) ───────────
//
// 缓存只是为了「列出某角色的素材」这种纯前端查询能立即响应,
// 真正的状态机是从 SeeGen GetAsset 拉回来的(processing → active/failed)。

const _initialAssets = loadJSON<Record<string, Asset>>("assets", {});
const assetCache = new Map<string, Asset>(Object.entries(_initialAssets));

function persistAssets() {
  saveJSON("assets", Object.fromEntries(assetCache));
}

// 启动时把上次会话还卡在 processing 的素材保留 —— 这次会话的 useAssetPolling
// 会再次为它调 getAsset 拉新状态。这个行为和旧 mock 的「自动 90% active」不同,
// 真实状态机不能编造。

// ─────────── 辅助: provider Asset → 本地 Asset ───────────

function applyServerAsset(local: Asset, server: AssetGetResp): Asset {
  const url = server.url ?? local.url ?? null;
  const thumb = server.thumbnail_url ?? local.thumbnail_url ?? null;
  const err = server.status === "failed" ? server.error ?? null : null;
  return {
    ...local,
    url,
    thumbnail_url: thumb,
    status: server.status,
    processing_error: err,
    updated_at: new Date().toISOString(),
  };
}

/**
 * 保证目标 character 有一个真实(非 mock 占位)且 provider 匹配的 ark_group_id。
 *
 * 触发重新建组的三种情况:
 *   1. 从未上传过(ark_group_id 为空或 group-mock-* 占位)
 *   2. 切换了上游 (character.asset_provider !== currentProvider)
 *   3. 数据迁移期 asset_provider 为 null 但 ark_group_id 看起来是真的 ——
 *      老数据无法判定归属,保守起见以当前 provider 重建。
 *
 * 仅当 character_id 存在于 MOCK_CHARACTERS 时生效(USE_MOCK=true 路径)。
 */
async function ensureRealAssetGroup(character_id: string): Promise<string> {
  const char = mockGetCharacter(character_id);
  if (!char) {
    throw new Error(`角色不存在: ${character_id}`);
  }
  const provider = getCurrentProvider();
  const currentName = getCurrentProviderName();

  const existing = char.ark_group_id;
  const isPlaceholder =
    !existing || existing.length === 0 || existing.startsWith("group-mock-");
  const providerMatches = char.asset_provider === currentName;

  if (!isPlaceholder && providerMatches) {
    return existing!;
  }

  const groupName = `${char.name}-${char.id}`.slice(0, 60);
  const resp = await provider.createAssetGroup({
    name: groupName,
    description: char.desc?.slice(0, 200) || groupName,
    character_id,
  });
  if (!resp.id) {
    throw new Error(
      `${currentName} CreateAssetGroup 返回中找不到 id: ${JSON.stringify(resp)}`,
    );
  }
  mockSetCharacterArkGroup(character_id, resp.id, currentName);
  return resp.id;
}

// ─────────── 对外 API ───────────

/**
 * 上传一份素材:校验 → TOS → 懒建 group → provider.createAsset。
 * 返回的 Asset 通常处于 status=processing,前端用 useAssetPolling 监听。
 */
export async function uploadAsset(input: UploadAssetInput): Promise<Asset> {
  const provider = getCurrentProvider();

  // 1) 先把文件传到 TOS,拿公网 URL(两个 provider 都接 TOS URL)
  const tosResult = await uploadFileToTos(input.file);

  // 2) 保证角色有匹配当前 provider 的 ark_group_id
  const groupId = await ensureRealAssetGroup(input.character_id);

  // 3) 调用 provider 注册
  // 与脚本 Path(local_path).stem 对齐:去掉扩展名;并清洗非 ASCII / 特殊字符,
  // 避免上游对 name 字段做严格 validation (常见 400 来源)。截断到 60 字以内。
  const stem = input.file.name.replace(/\.[^.]+$/, "");
  const safeName =
    stem.replace(/[^A-Za-z0-9_一-龥-]/g, "_").slice(0, 60) ||
    `asset_${Date.now()}`;

  const created = await provider.createAsset({
    group_id: groupId,
    url: tosResult.url,
    name: safeName,
    kind: input.kind,
  });
  if (!created.id) {
    throw new Error(
      `${provider.name} CreateAsset 返回中找不到 id: ${JSON.stringify(created)}`,
    );
  }

  // 4) 用 provider 返回拼装本地 Asset 记录
  const now = new Date().toISOString();
  // 本地 id 用上游 ark_asset_id —— 简化映射,后续 getAsset 直接用同一个 id
  const id = created.id;
  const baseAsset: Asset = {
    id,
    org_id: "org_mock",
    character_id: input.character_id,
    kind: input.kind,
    url: created.url ?? tosResult.url,
    thumbnail_url: null,
    role_in_bundle: input.role_in_bundle ?? "other",
    original_filename: input.file.name,
    size_bytes: input.file.size,
    ark_asset_id: id,
    status: created.status,
    processing_error: created.status === "failed" ? "上游返回失败" : null,
    width: null,
    height: null,
    duration_seconds: null,
    fps: null,
    mime: input.file.type || "application/octet-stream",
    uploaded_by: "u_mock",
    created_at: now,
    updated_at: now,
  };

  assetCache.set(id, baseAsset);
  persistAssets();
  return baseAsset;
}

/** 拉一次当前 provider 的 GetAsset,顺手刷新本地缓存 */
export async function getAsset(id: string): Promise<Asset> {
  const provider = getCurrentProvider();
  // 优先从缓存取静态字段(filename / character_id / role 等)
  const local = assetCache.get(id);
  const server = await provider.getAsset(id);
  if (!local) {
    // 之前没缓存(刷新页面后,后端有但前端缓存丢了),用最小可用骨架补
    const now = new Date().toISOString();
    const fallback: Asset = {
      id,
      org_id: "org_mock",
      character_id: "",
      kind: "image",
      url: server.url ?? null,
      thumbnail_url: server.thumbnail_url ?? null,
      role_in_bundle: "other",
      original_filename: id,
      size_bytes: 0,
      ark_asset_id: id,
      status: server.status,
      processing_error: server.status === "failed" ? server.error ?? null : null,
      width: null,
      height: null,
      duration_seconds: null,
      fps: null,
      mime: "application/octet-stream",
      uploaded_by: "u_mock",
      created_at: now,
      updated_at: now,
    };
    assetCache.set(id, fallback);
    persistAssets();
    return fallback;
  }
  const merged = applyServerAsset(local, server);
  assetCache.set(id, merged);
  persistAssets();
  return merged;
}

export async function listCharacterAssets(
  characterId: string,
): Promise<Asset[]> {
  // 本地缓存即权威,不每次都打 SeeGen list 接口(性能 + 缺过滤参数)
  return Array.from(assetCache.values()).filter(
    (a) => a.character_id === characterId,
  );
}

export async function patchAsset(
  id: string,
  patch: Partial<Pick<Asset, "role_in_bundle">>,
): Promise<Asset> {
  // role_in_bundle 是我们前端自己的概念,SeeGen 不存,纯本地改
  const a = assetCache.get(id);
  if (!a) throw new Error(`本地未缓存该素材: ${id}`);
  const next: Asset = { ...a, ...patch, updated_at: new Date().toISOString() };
  assetCache.set(id, next);
  persistAssets();
  return next;
}

export async function deleteAsset(id: string): Promise<void> {
  // 注:upload_seegen_assets.py 未提供 delete 端点,这里只清本地缓存。
  // 角色卡片立刻不再显示该素材;SeeGen 那边的记录保留(无副作用,group 还是同一个)。
  assetCache.delete(id);
  persistAssets();
}

// ─────────── 角色卡片用的素材聚合 ───────────
//
// 名字保留 computeMockAssetBundle —— _mock.ts 的 mockListCharacters 还在 import 它。
// 行为已切到本地缓存(就是真实素材的本地缓存)。

export function computeMockAssetBundle(
  characterId: string,
): Character["asset_bundle"] {
  const all = Array.from(assetCache.values()).filter(
    (a) => a.character_id === characterId,
  );
  const active = all.filter((a) => a.status === "active");
  const pickPrimary = (kind: AssetKind) =>
    active.find((a) => a.kind === kind && a.role_in_bundle === "primary") ??
    active.find((a) => a.kind === kind) ??
    null;
  const img = pickPrimary("image");
  const vid = pickPrimary("video");
  const aud = pickPrimary("audio");
  return {
    counts: {
      image: active.filter((a) => a.kind === "image").length,
      video: active.filter((a) => a.kind === "video").length,
      audio: active.filter((a) => a.kind === "audio").length,
    },
    primary_image_url: img?.url ?? null,
    primary_video_url: vid?.url ?? null,
    primary_audio_url: aud?.url ?? null,
    primary_image_ark_asset_id: img?.ark_asset_id ?? null,
    primary_video_ark_asset_id: vid?.ark_asset_id ?? null,
    primary_audio_ark_asset_id: aud?.ark_asset_id ?? null,
    processing_count: all.filter(
      (a) => a.status === "processing" || a.status === "uploading",
    ).length,
    failed_count: all.filter((a) => a.status === "failed").length,
  };
}
