import { USE_REAL_AUTH, del, get, patch, post } from "./client";
import {
  blankProject,
  mockCreateProject,
  mockDeleteProject,
  mockGetProject,
  mockListProjects,
  mockUpdateProject,
  simpleHueFromName,
  type CreateProjectInput,
} from "./_mock";
import type { Pagination, Project, ProjectListItem, ProjectStatus } from "@/types";

export type { CreateProjectInput };

// 项目改为 org 级后端持久化(便于跨设备 + 管理员复现);跟 tasks 一样,鉴权走真后端就走真实库。
// 纯 demo(USE_REAL_AUTH=false)仍用 localStorage mock。
const USE_MOCK_PROJECTS = !USE_REAL_AUTH;

export interface ListProjectsParams {
  status?: ProjectStatus | "all";
  q?: string;
  page?: number;
  page_size?: number;
}

export function listProjects(params: ListProjectsParams = {}): Promise<Pagination<ProjectListItem>> {
  if (USE_MOCK_PROJECTS) return mockListProjects(params);
  return get<Pagination<ProjectListItem>>("/projects", params);
}

export function getProject(id: string): Promise<Project> {
  if (USE_MOCK_PROJECTS) return mockGetProject(id);
  return get<Project>(`/projects/${id}`);
}

/** v0.7 工作台「新建项目」走真实 POST，拿到 id 再跳编辑器 */
export function createProject(input: CreateProjectInput = {}): Promise<Project> {
  if (USE_MOCK_PROJECTS) return mockCreateProject(input);
  // 真后端:前端构造一份完整的空项目骨架（含 global/output 默认字段）再 POST，
  // 后端只覆盖 id/name/status/时间，避免后端缺省字段导致编辑器读到 undefined。
  const name = input.name?.trim() || "未命名项目";
  const draft = { ...blankProject("p_new"), name, hue: simpleHueFromName(name) };
  return post<Project>("/projects", draft);
}

export function deleteProject(id: string): Promise<void> {
  if (USE_MOCK_PROJECTS) return mockDeleteProject(id);
  return del<void>(`/projects/${id}`);
}

/** 持久化整个 project(name + global + shots + output)。mock 写 localStorage。 */
export function updateProject(id: string, project: Project): Promise<Project> {
  if (USE_MOCK_PROJECTS) return mockUpdateProject(id, project);
  return patch<Project>(`/projects/${id}`, project);
}
