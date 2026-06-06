import { USE_REAL_AUTH, del, get, patch as httpPatch, post } from "./client";
import {
  mockCreateCharacter,
  mockDeleteCharacter,
  mockGetCharacter,
  mockListCharacters,
  mockUpdateCharacter,
  type CharacterUpsert,
} from "./_mock";
import type { Character } from "@/types";

export type { CharacterUpsert };

// 角色库改 org 级后端持久化(跨设备 + 管理员复现);跟 tasks/projects 一样,鉴权走真后端就走真实库。
// 纯 demo(USE_REAL_AUTH=false)仍用 localStorage mock。
const USE_MOCK_CHARACTERS = !USE_REAL_AUTH;

export function listCharacters(): Promise<Character[]> {
  if (USE_MOCK_CHARACTERS) return mockListCharacters();
  return get<Character[]>("/characters");
}

/** 取单个角色(资产注册回写时读当前 asset_bundle 用)。mock 直接查本地。 */
export function getCharacter(id: string): Promise<Character> {
  if (USE_MOCK_CHARACTERS) {
    const c = mockGetCharacter(id);
    return c ? Promise.resolve(c) : Promise.reject(new Error("角色不存在"));
  }
  return get<Character>(`/characters/${id}`);
}

export function createCharacter(input: CharacterUpsert): Promise<Character> {
  if (USE_MOCK_CHARACTERS) return mockCreateCharacter(input);
  return post<Character>("/characters", input);
}

export function updateCharacter(id: string, patch: Partial<Character>): Promise<Character> {
  if (USE_MOCK_CHARACTERS) return mockUpdateCharacter(id, patch as Partial<CharacterUpsert>);
  return httpPatch<Character>(`/characters/${id}`, patch);
}

export function deleteCharacter(id: string): Promise<void> {
  if (USE_MOCK_CHARACTERS) return mockDeleteCharacter(id);
  return del<void>(`/characters/${id}`);
}
