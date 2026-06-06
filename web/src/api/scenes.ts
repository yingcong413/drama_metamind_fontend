import { USE_REAL_AUTH, del, get, patch as httpPatch, post } from "./client";
import {
  mockCreateScene,
  mockDeleteScene,
  mockListScenes,
  mockUpdateScene,
  type SceneUpsert,
} from "./_mock";
import type { Scene } from "@/types";

export type { SceneUpsert };

// 场景库属于「org 级共享素材」(R9):跟 tasks 一样,只要鉴权走真后端就走真实库,
// 母账号建的库全公司可见。纯 demo(USE_REAL_AUTH=false)才用 localStorage mock。
const USE_MOCK_SCENES = !USE_REAL_AUTH;

export function listScenes(): Promise<Scene[]> {
  if (USE_MOCK_SCENES) return mockListScenes();
  return get<Scene[]>("/scenes");
}

export function createScene(input: SceneUpsert): Promise<Scene> {
  if (USE_MOCK_SCENES) return mockCreateScene(input);
  return post<Scene>("/scenes", input);
}

export function updateScene(id: string, patch: Partial<SceneUpsert>): Promise<Scene> {
  if (USE_MOCK_SCENES) return mockUpdateScene(id, patch);
  return httpPatch<Scene>(`/scenes/${id}`, patch);
}

export function deleteScene(id: string): Promise<void> {
  if (USE_MOCK_SCENES) return mockDeleteScene(id);
  return del<void>(`/scenes/${id}`);
}
