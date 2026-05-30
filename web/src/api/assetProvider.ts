// api/assetProvider.ts —— PRD §2.8 多上游素材库抽象
//
// 当前支持两个上游:
//   - seegen        SeeGen AI(api.seegen.ai),REST + Bearer,前端 bundle 内置 key
//                   Asset 状态:Processing / Active / Failed
//   - volcano_ark   火山方舟 ARK OpenAPI,HMAC-SHA256 签名;后端 Express 代签
//                   Asset 状态:Processing / Active / Failed (大写 PascalCase 由后端归一化)
//
// 选哪个由编译期 env 决定:VITE_ASSET_LIB_PROVIDER=seegen | volcano_ark
// 不设默认 seegen,保持向后兼容。
//
// 切换 provider 后,**已有角色的 ark_group_id 与新 provider 不兼容**:
// 触发 character.asset_provider !== currentProvider 时,assets.ts 的
// ensureRealAssetGroup() 会调当前 provider 重新创建 group。

import { client, get, post, USE_REAL_AUTH } from "./client";

// ─────────────── 公共类型 ───────────────

export type AssetProviderName = "seegen" | "volcano_ark";

export interface AssetGroupCreatedResp {
  id: string;
  raw?: unknown;
}

export interface AssetCreatedResp {
  id: string;
  status: "processing" | "active" | "failed";
  url: string | null;
  raw?: unknown;
}

export interface AssetGetResp extends AssetCreatedResp {
  /** 失败原因 */
  error?: string | null;
  thumbnail_url?: string | null;
}

/** Provider 接口:所有上游必须实现这三个动作 */
export interface AssetLibProvider {
  name: AssetProviderName;
  createAssetGroup(input: {
    name: string;
    description?: string;
    /** 角色绑定 */
    character_id?: string;
  }): Promise<AssetGroupCreatedResp>;

  createAsset(input: {
    group_id: string;
    url: string;
    name: string;
    /** image / video / audio,大小写按上游规范由 provider 内部转换 */
    kind: "image" | "video" | "audio";
  }): Promise<AssetCreatedResp>;

  getAsset(id: string): Promise<AssetGetResp>;
}

// ─────────────── 火山方舟 provider(走后端 /v1/ark/* 代签) ───────────────

function normalizeStatus(s: string | undefined): "processing" | "active" | "failed" {
  const v = (s ?? "").toLowerCase();
  if (v === "active" || v === "ready" || v === "succeeded" || v === "success") return "active";
  if (v === "failed" || v === "failure" || v === "rejected" || v === "error") return "failed";
  return "processing";
}

const volcanoArkProvider: AssetLibProvider = {
  name: "volcano_ark",

  async createAssetGroup(input) {
    const resp = await post<{ id: string; raw?: unknown }>("/ark/asset-groups", {
      name: input.name,
      description: input.description,
    });
    return { id: resp.id, raw: resp.raw };
  },

  async createAsset(input) {
    const ASSET_TYPE_MAP = {
      image: "Image",
      video: "Video",
      audio: "Audio",
    } as const;
    const resp = await post<{ id: string; status: string; url: string | null; raw?: unknown }>(
      "/ark/assets",
      {
        group_id: input.group_id,
        url: input.url,
        name: input.name,
        asset_type: ASSET_TYPE_MAP[input.kind],
      },
    );
    return {
      id: resp.id,
      status: normalizeStatus(resp.status),
      url: resp.url,
      raw: resp.raw,
    };
  },

  async getAsset(id) {
    const resp = await get<{
      id: string;
      status: string;
      url: string | null;
      fail_reason?: string | null;
      raw?: unknown;
    }>(`/ark/assets/${id}`);
    return {
      id: resp.id,
      status: normalizeStatus(resp.status),
      url: resp.url,
      raw: resp.raw,
      error: resp.fail_reason ?? null,
      thumbnail_url: null,
    };
  },
};

// ─────────────── SeeGen provider(适配现有 seegen.ts) ───────────────

import {
  createAsset as seegenCreateAsset,
  createAssetGroup as seegenCreateAssetGroup,
  getAsset as seegenGetAsset,
  normalizeStatus as seegenNormalizeStatus,
  pickError,
  pickId,
  pickThumbnail,
} from "./seegen";

const seegenProvider: AssetLibProvider = {
  name: "seegen",

  async createAssetGroup(input) {
    const resp = await seegenCreateAssetGroup({
      name: input.name,
      description: input.description,
      region: "cn",
    });
    const id = pickId(resp);
    if (!id) throw new Error(`SeeGen CreateAssetGroup 无 id: ${JSON.stringify(resp)}`);
    return { id, raw: resp };
  },

  async createAsset(input) {
    const resp = await seegenCreateAsset({
      groupId: input.group_id,
      url: input.url,
      name: input.name,
      type: input.kind,
    });
    const id = pickId(resp);
    if (!id) throw new Error(`SeeGen CreateAsset 无 id: ${JSON.stringify(resp)}`);
    return {
      id,
      status: seegenNormalizeStatus(resp.status),
      url: resp.url ?? null,
      raw: resp,
    };
  },

  async getAsset(id) {
    const resp = await seegenGetAsset(id);
    return {
      id,
      status: seegenNormalizeStatus(resp.status),
      url: resp.url ?? null,
      error: pickError(resp),
      thumbnail_url: pickThumbnail(resp),
      raw: resp,
    };
  },
};

// ─────────────── 工厂 ───────────────

const PROVIDER_NAME: AssetProviderName =
  (import.meta.env.VITE_ASSET_LIB_PROVIDER as AssetProviderName | undefined) || "seegen";

/** 当前生效的 provider(编译期决定) */
export function getCurrentProvider(): AssetLibProvider {
  if (PROVIDER_NAME === "volcano_ark") return volcanoArkProvider;
  return seegenProvider;
}

/** 当前 provider 的名字,用于 character.asset_provider 字段对比 */
export function getCurrentProviderName(): AssetProviderName {
  return PROVIDER_NAME;
}

/** 用 axios 的 client 不在用,但确保引用避免 dead-import */
void client;
void USE_REAL_AUTH;
