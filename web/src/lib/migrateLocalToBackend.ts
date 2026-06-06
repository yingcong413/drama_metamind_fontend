// lib/migrateLocalToBackend.ts —— 一次性、非破坏性地把「本地 mock 数据」迁移到真后端。
//
// 背景:角色 / 项目 / 场景 / 道具从前端 localStorage(mock)切到 org 级后端后,
// 老客户在 localStorage 里已建的数据不会被读取,看起来像「丢了」。
// 本迁移在「真后端 + 已登录」的首次加载时,把这些本地数据 POST 到后端,客户无感保留。
//
// 关键原则:
//   - 非破坏:只「复制」到后端,绝不删除 localStorage(失败也留底,可重试)。
//   - 幂等:用 localStorage 标志位 metamind-migrated-v1 防重复;迁移成功才置位。
//   - 容错:单条失败不阻断其余;整体失败也不影响正常使用(catch 吞掉)。

import { USE_REAL_AUTH, post } from "@/api/client";
import { loadJSON } from "@/api/_mockStorage";
import type { Character, Project, Prop, Scene } from "@/types";

const MIGRATED_FLAG = "metamind-migrated-v1";

function alreadyMigrated(): boolean {
  try {
    return !!window.localStorage.getItem(MIGRATED_FLAG);
  } catch {
    return false;
  }
}

function markMigrated(summary: string): void {
  try {
    window.localStorage.setItem(MIGRATED_FLAG, summary);
  } catch {
    /* 隐私模式等:无所谓,下次再尝试 */
  }
}

async function postEach<T>(path: string, items: T[]): Promise<number> {
  let ok = 0;
  for (const it of items) {
    try {
      await post(path, it);
      ok++;
    } catch (e) {
      console.warn(`[migrate] ${path} 单条迁移失败(跳过):`, e);
    }
  }
  return ok;
}

/**
 * 在真后端模式 + 已登录时调用一次。把本地 mock 的 角色/场景/道具/项目 复制到后端。
 * 已迁移过(标志位存在)直接跳过。整个过程非破坏:localStorage 原样保留。
 */
export async function migrateLocalDataIfNeeded(): Promise<void> {
  if (!USE_REAL_AUTH) return;            // 纯 demo 模式仍用本地,不迁移
  if (typeof window === "undefined") return;
  if (alreadyMigrated()) return;

  try {
    const chars = loadJSON<Character[]>("characters", []);
    const scenes = loadJSON<Scene[]>("scenes", []);
    const props = loadJSON<Prop[]>("props", []);
    // 项目完整数据存在 project_details(id → Project);projects 只存列表项,不含 global/shots。
    const details = loadJSON<Record<string, Project>>("project_details", {});
    const projects = Object.values(details);

    // 没有任何本地数据 → 直接置位,避免每次加载都空跑。
    if (!chars.length && !scenes.length && !props.length && !projects.length) {
      markMigrated("empty");
      return;
    }

    const nChar = await postEach("/characters", chars);
    const nScene = await postEach("/scenes", scenes);
    const nProp = await postEach("/props", props);
    const nProj = await postEach("/projects", projects);

    markMigrated(
      `chars=${nChar}/${chars.length} scenes=${nScene}/${scenes.length} props=${nProp}/${props.length} projects=${nProj}/${projects.length} @${new Date().toISOString()}`,
    );
    console.info(
      `[migrate] 本地数据已迁移到后端:角色 ${nChar}/${chars.length}、场景 ${nScene}/${scenes.length}、道具 ${nProp}/${props.length}、项目 ${nProj}/${projects.length}`,
    );
  } catch (e) {
    // 不置位:下次加载会再试。绝不影响正常使用。
    console.warn("[migrate] 本地数据迁移失败(不影响使用,下次再试):", e);
  }
}
