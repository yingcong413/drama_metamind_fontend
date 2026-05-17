import { USE_MOCK, get } from "./client";
import { mockGetProject, mockListProjects } from "./_mock";
import type { Pagination, Project, ProjectListItem, ProjectStatus } from "@/types";

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
