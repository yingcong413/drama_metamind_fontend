import { USE_MOCK, del, get, patch, post } from "./client";
import {
  mockCreateProject,
  mockDeleteProject,
  mockGetProject,
  mockListProjects,
  mockUpdateProject,
  type CreateProjectInput,
} from "./_mock";
import type { Pagination, Project, ProjectListItem, ProjectStatus } from "@/types";

export type { CreateProjectInput };

export interface ListProjectsParams {
  status?: ProjectStatus | "all";
  q?: string;
  page?: number;
  page_size?: number;
}

export function listProjects(params: ListProjectsParams = {}): Promise<Pagination<ProjectListItem>> {
  if (USE_MOCK) return mockListProjects(params);
  return get<Pagination<ProjectListItem>>("/projects", params);
}

export function getProject(id: string): Promise<Project> {
  if (USE_MOCK) return mockGetProject(id);
  return get<Project>(`/projects/${id}`);
}

/** v0.7 工作台「新建项目」走真实 POST，拿到 id 再跳编辑器 */
export function createProject(input: CreateProjectInput = {}): Promise<Project> {
  if (USE_MOCK) return mockCreateProject(input);
  return post<Project>("/projects", input);
}

export function deleteProject(id: string): Promise<void> {
  if (USE_MOCK) return mockDeleteProject(id);
  return del<void>(`/projects/${id}`);
}

/** 持久化整个 project(name + global + shots + output)。mock 写 localStorage。 */
export function updateProject(id: string, project: Project): Promise<Project> {
  if (USE_MOCK) return mockUpdateProject(id, project);
  return patch<Project>(`/projects/${id}`, project);
}
