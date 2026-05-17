import { USE_MOCK, del, get, patch as httpPatch, post } from "./client";
import {
  mockCreateCharacter,
  mockDeleteCharacter,
  mockListCharacters,
  mockUpdateCharacter,
  type CharacterUpsert,
} from "./_mock";
import type { Character } from "@/types";

export type { CharacterUpsert };

export function listCharacters(): Promise<Character[]> {
  if (USE_MOCK) return mockListCharacters();
  return get<Character[]>("/characters");
}

export function createCharacter(input: CharacterUpsert): Promise<Character> {
  if (USE_MOCK) return mockCreateCharacter(input);
  return post<Character>("/characters", input);
}

export function updateCharacter(id: string, patch: Partial<CharacterUpsert>): Promise<Character> {
  if (USE_MOCK) return mockUpdateCharacter(id, patch);
  return httpPatch<Character>(`/characters/${id}`, patch);
}

export function deleteCharacter(id: string): Promise<void> {
  if (USE_MOCK) return mockDeleteCharacter(id);
  return del<void>(`/characters/${id}`);
}
