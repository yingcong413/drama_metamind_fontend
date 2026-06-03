import { USE_MOCK, del, get, patch as httpPatch, post } from "./client";
import {
  mockCreateProp,
  mockDeleteProp,
  mockListProps,
  mockUpdateProp,
  type PropUpsert,
} from "./_mock";
import type { Prop } from "@/types";

export type { PropUpsert };

export function listProps(): Promise<Prop[]> {
  if (USE_MOCK) return mockListProps();
  return get<Prop[]>("/props");
}

export function createProp(input: PropUpsert): Promise<Prop> {
  if (USE_MOCK) return mockCreateProp(input);
  return post<Prop>("/props", input);
}

export function updateProp(id: string, patch: Partial<PropUpsert>): Promise<Prop> {
  if (USE_MOCK) return mockUpdateProp(id, patch);
  return httpPatch<Prop>(`/props/${id}`, patch);
}

export function deleteProp(id: string): Promise<void> {
  if (USE_MOCK) return mockDeleteProp(id);
  return del<void>(`/props/${id}`);
}
