import { USE_MOCK, get } from "./client";
import { mockListTasks, type ListTasksParams } from "./_mock";
import type { GenerationTask, Pagination } from "@/types";

export type { ListTasksParams };

export function listTasks(params: ListTasksParams = {}): Promise<Pagination<GenerationTask>> {
  if (USE_MOCK) return mockListTasks(params);
  return get<Pagination<GenerationTask>>("/tasks", params);
}
