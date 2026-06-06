import { USE_REAL_AUTH, del, get, patch as httpPatch, post } from "./client";
import {
  mockCreateProp,
  mockDeleteProp,
  mockListProps,
  mockUpdateProp,
  type PropUpsert,
} from "./_mock";
import type { Prop } from "@/types";

export type { PropUpsert };

// 道具库属于「org 级共享素材」(R9):跟 tasks 一样,只要鉴权走真后端就走真实库,
// 母账号建的库全公司可见。纯 demo(USE_REAL_AUTH=false)才用 localStorage mock。
const USE_MOCK_PROPS = !USE_REAL_AUTH;

export function listProps(): Promise<Prop[]> {
  if (USE_MOCK_PROPS) return mockListProps();
  return get<Prop[]>("/props");
}

export function createProp(input: PropUpsert): Promise<Prop> {
  if (USE_MOCK_PROPS) return mockCreateProp(input);
  return post<Prop>("/props", input);
}

export function updateProp(id: string, patch: Partial<PropUpsert>): Promise<Prop> {
  if (USE_MOCK_PROPS) return mockUpdateProp(id, patch);
  return httpPatch<Prop>(`/props/${id}`, patch);
}

export function deleteProp(id: string): Promise<void> {
  if (USE_MOCK_PROPS) return mockDeleteProp(id);
  return del<void>(`/props/${id}`);
}
