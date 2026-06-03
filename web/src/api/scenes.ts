import { USE_MOCK, del, get, patch as httpPatch, post } from "./client";
import {
  mockCreateScene,
  mockDeleteScene,
  mockListScenes,
  mockUpdateScene,
  type SceneUpsert,
} from "./_mock";
import type { Scene } from "@/types";

export type { SceneUpsert };

export function listScenes(): Promise<Scene[]> {
  if (USE_MOCK) return mockListScenes();
  return get<Scene[]>("/scenes");
}

export function createScene(input: SceneUpsert): Promise<Scene> {
  if (USE_MOCK) return mockCreateScene(input);
  return post<Scene>("/scenes", input);
}

export function updateScene(id: string, patch: Partial<SceneUpsert>): Promise<Scene> {
  if (USE_MOCK) return mockUpdateScene(id, patch);
  return httpPatch<Scene>(`/scenes/${id}`, patch);
}

export function deleteScene(id: string): Promise<void> {
  if (USE_MOCK) return mockDeleteScene(id);
  return del<void>(`/scenes/${id}`);
}
