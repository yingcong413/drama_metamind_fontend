import type {
  Account,
  Character,
  GenerationTask,
  LoginResponse,
  Pagination,
  Project,
  ProjectListItem,
  ProjectStatus,
  Prop,
  RechargePackage,
  RechargeRecord,
  Scene,
  TaskStatus,
  TaskTypeInfo,
} from "@/types";
import { loadJSON, saveJSON } from "./_mockStorage";

// v0.9.5: 新用户(无 localStorage 记录)看到空状态;demo 项目从默认数据中移除。
// 老用户的真实项目数据在 localStorage 里继续读到,不影响。
const DEFAULT_PROJECTS: ProjectListItem[] = [];

// v0.7：项目列表与详情都持久化到 localStorage
const PROJECTS: ProjectListItem[] = loadJSON<ProjectListItem[]>("projects", DEFAULT_PROJECTS);

function persistProjects() {
  saveJSON("projects", PROJECTS);
}

// v0.5 mock 默认值：org_id / ark_project_name / 空 asset_bundle
const MOCK_ORG = "org_mock";
// v0.7: ark_project_name per-org，命名 `metamind-{org_id前 8}`
const MOCK_ARK_PROJECT = `metamind-${MOCK_ORG.slice(0, 8)}`;
const EMPTY_BUNDLE: Character["asset_bundle"] = {
  counts: { image: 0, video: 0, audio: 0 },
  primary_image_url: null,
  primary_video_url: null,
  primary_audio_url: null,
  primary_image_ark_asset_id: null,
  primary_video_ark_asset_id: null,
  primary_audio_ark_asset_id: null,
  processing_count: 0,
  failed_count: 0,
};

// v0.9.5: 新用户角色库默认为空。老用户已存在的角色保留在 localStorage 不动。
// 原 6 个 demo 角色(林夏/陈砚/苏老师/小宁/老李/外卖员阿强)已挪到 __fixtures__ 仅供测试使用。
const DEFAULT_CHARACTERS: Character[] = [];
// MOCK_ARK_PROJECT 与 EMPTY_BUNDLE 在 mockCreateCharacter 创建新角色时仍要用
void MOCK_ARK_PROJECT;
void EMPTY_BUNDLE;

// 持久化到 localStorage：刷新页面后状态不丢
export const MOCK_CHARACTERS: Character[] = loadJSON<Character[]>("characters", DEFAULT_CHARACTERS);

function persistCharacters() {
  saveJSON("characters", MOCK_CHARACTERS);
}

/**
 * 真实素材上传(assets.ts → provider.createAssetGroup)首次为某角色创建素材组后,
 * 回写 ark_group_id + asset_provider 到角色记录,后续上传跳过 group 创建。
 * 找不到角色或 group_id 已存在且为真实 ID 时不动。
 *
 * v0.9.4 §2.8: 同时记录 asset_provider,切换上游后 ensureRealAssetGroup 会比对此字段。
 */
export function mockSetCharacterArkGroup(
  character_id: string,
  ark_group_id: string,
  asset_provider: Character["asset_provider"],
): void {
  const idx = MOCK_CHARACTERS.findIndex((c) => c.id === character_id);
  if (idx === -1) return;
  MOCK_CHARACTERS[idx] = {
    ...MOCK_CHARACTERS[idx],
    ark_group_id,
    asset_provider,
    updated_at: new Date().toISOString(),
  };
  persistCharacters();
}

/** assets.ts 上传前需要拿角色当前的 ark_group_id 来决定是否懒建素材组 */
export function mockGetCharacter(character_id: string): Character | null {
  return MOCK_CHARACTERS.find((c) => c.id === character_id) ?? null;
}

// v0.9.5: 新用户项目详情也清空。原 p1「果茶广告 · Demo」demo 数据下方完整保留为
// 内联注释,日后做「demo 项目一键导入」按钮时可以直接复用此模板。
const DEFAULT_PROJECT_DETAILS: Record<string, Project> = {};
const _DEMO_PROJECT_TEMPLATE_UNUSED: Record<string, Project> = {
  p1: {
    id: "p1", name: "果茶广告 · Demo", cover_url: null, hue: 28, status: "draft",
    shot_count: 3, duration_seconds: 11,
    created_at: "2026-05-15T08:00:00Z", updated_at: "2026-05-24T08:00:00Z",
    global: {
      total_duration_seconds: 11,
      ratio: "16:9",
      resolution: "720p",
      scenes: [],
      props: [],
      // Volcano 官方公开 demo 资源(来自 seedance2_final.py),URL 真实可访问,
      // 测试者无需自己上传素材即可端到端跑通生成
      scene_image:
        "https://ark-project.tos-cn-beijing.volces.com/doc_image/r2v_tea_pic2.jpg",
      position_image_url:
        "https://ark-project.tos-cn-beijing.volces.com/doc_image/r2v_tea_pic1.jpg",
      prop_image_url: null,
      style: ["真人实拍"],
      characters: ["c1"],
      story:
        "第一视角果茶产品广告:从果园摘下新鲜苹果,投入雪克杯加冰摇匀,倒入透明杯展示分层奶盖纹理,最后将成品举到镜头前。整体节奏轻快,突出「鲜切现摇」的产品卖点。",
      image_quality: "4K 锐利、自然光、暖色调,产品微距分层清晰,轻微胶片颗粒",
      narration_audio_url:
        "https://ark-project.tos-cn-beijing.volces.com/doc_audio/r2v_tea_audio1.mp3",
    },
    shots: [
      {
        id: "s1", name: "取材 · 摘苹果", description: "", order: 0,
        shot_size: "mcu",
        duration_seconds: null,
        cast_ids: ["c1"],
        action: {
          start: "第一人称视角看向果园里挂满露珠的红苹果",
          mid: "手伸出画面轻握住一颗带晨露的阿克苏苹果",
          end: "缓缓摘下,苹果离开枝头时的轻微晃动",
        },
        action_strength: 60,
        micro: { eyes: "", look: "", emotion: "" },
        micro_strength: 60,
        gesture: "拇指与食指顺势托住苹果底部",
        gesture_strength: 55,
        camera: [{ id: "push_in", speed: "慢", magnitude: "小", direction: null }],
        lines: null,
        mono: null,
        narration: { char_id: null, text: "", audio_url: null },
        sfx: "苹果离枝的清脆声、远处鸟鸣",
      },
      {
        id: "s2", name: "调制 · 雪克杯", description: "", order: 1,
        shot_size: "cu",
        duration_seconds: null,
        cast_ids: ["c1"],
        action: {
          start: "第一人称视角看向工作台,雪克杯放在台面中央",
          mid: "手将苹果块投入杯中,加冰块、倒入茶底",
          end: "双手握住雪克杯上下用力摇晃几下",
        },
        action_strength: 70,
        micro: { eyes: "", look: "", emotion: "" },
        micro_strength: 60,
        gesture: "摇晃节奏稳定、与背景鼓点同步",
        gesture_strength: 65,
        camera: [{ id: "handheld", speed: "中", magnitude: "小", direction: null }],
        lines: null,
        mono: null,
        narration: { char_id: null, text: "", audio_url: null },
        sfx: "冰块碰撞声、雪克杯金属轻响",
      },
      {
        id: "s3", name: "呈现 · 举杯", description: "", order: 2,
        shot_size: "mcu",
        duration_seconds: null,
        cast_ids: ["c1"],
        action: {
          start: "果茶倒入透明杯,呈现分层质感、奶盖在顶层铺展",
          mid: "手将成品杯从台面拿起",
          end: "第一人称将杯子举到镜头正前方,杯身标签朝向观众",
        },
        action_strength: 65,
        micro: { eyes: "", look: "", emotion: "" },
        micro_strength: 60,
        gesture: "手指稳定握住杯身中段,避免遮挡标签",
        gesture_strength: 60,
        camera: [{ id: "pull_out", speed: "慢", magnitude: "中", direction: null }],
        lines: null,
        mono: null,
        narration: { char_id: null, text: "", audio_url: null },
        sfx: "玻璃杯轻碰桌面、轻快收尾鼓点",
      },
    ],
    output: {
      ambient_sfx: "果园清晨鸟鸣、轻快电子鼓点、店内环境底噪",
      subtitle: false,
      music: true,
      generate_audio: true,
    },
  },
};

// 持久化项目详情(含新建出来的)
const PROJECT_DETAILS: Record<string, Project> = loadJSON<Record<string, Project>>(
  "project_details",
  DEFAULT_PROJECT_DETAILS,
);
// 抑制 noUnusedLocals;日后导入 demo 时会用上这份模板
void _DEMO_PROJECT_TEMPLATE_UNUSED;

function persistProjectDetails() {
  saveJSON("project_details", PROJECT_DETAILS);
}

const blankProject = (id: string): Project => ({
  id,
  name: id === "new" ? "未命名项目" : `项目 ${id}`,
  cover_url: null,
  hue: 220,
  status: "draft",
  shot_count: 1,
  duration_seconds: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  global: {
    total_duration_seconds: null,
    ratio: "16:9",
    resolution: "720p",
    scenes: [],
    props: [],
    scene_image: null,
    position_image_url: null,
    prop_image_url: null,
    style: [], characters: [], story: "",
    image_quality: "",
    narration_audio_url: null,
  },
  shots: [
    {
      id: "s_init", name: "新分镜", description: "", order: 0,
      shot_size: null,
      duration_seconds: null,
      cast_ids: [],
      action: { start: "", mid: "", end: "" },
      action_strength: 65,
      micro: { eyes: "", look: "", emotion: "" },
      micro_strength: 65,
      gesture: "", gesture_strength: 65,
      camera: [],
      lines: null, mono: null, narration: null,
      sfx: "",
    },
  ],
  output: { ambient_sfx: "", subtitle: false, music: false, generate_audio: true },
});

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function mockListProjects(params: {
  status?: ProjectStatus | "all";
  q?: string;
  page?: number;
  page_size?: number;
}): Promise<Pagination<ProjectListItem>> {
  await delay(220);
  let list = PROJECTS.slice();
  if (params.status && params.status !== "all") {
    list = list.filter((p) => p.status === params.status);
  }
  if (params.q) {
    const q = params.q.toLowerCase();
    list = list.filter((p) => p.name.toLowerCase().includes(q));
  }
  const page = params.page ?? 1;
  const page_size = params.page_size ?? 20;
  const total = list.length;
  list = list.slice((page - 1) * page_size, page * page_size);
  return { list, page, page_size, total };
}

export async function mockGetProject(id: string): Promise<Project> {
  await delay(180);
  return PROJECT_DETAILS[id] ?? blankProject(id);
}

export interface CreateProjectInput {
  name?: string;
  template_id?: string | null;
}

export async function mockCreateProject(input: CreateProjectInput = {}): Promise<Project> {
  await delay(180);
  const id = "p_" + Date.now().toString(36);
  const name = (input.name?.trim() || "未命名项目");
  // 用名字 hash 出 hue，跟后端 §3.4 「按 name hash 生成 hue」对齐
  const hue = simpleHueFromName(name);
  const project: Project = {
    ...blankProject(id),
    name,
    hue,
  };
  PROJECT_DETAILS[id] = project;
  // 同步更新列表
  const item: ProjectListItem = {
    id, name, cover_url: null, hue,
    status: project.status,
    shot_count: project.shots.length,
    duration_seconds: project.duration_seconds,
    updated_at: project.updated_at,
  };
  PROJECTS.unshift(item); // 新建的放最前
  persistProjects();
  persistProjectDetails();
  return project;
}

/**
 * 把整个 project 写回 mock store。
 *   - PROJECT_DETAILS[id] = project(完整数据,编辑器里所有字段)
 *   - PROJECTS 同步更新元信息(name / shot_count / duration_seconds / updated_at)以便 Dashboard 看到
 *   - localStorage 持久化,刷新还在
 */
export async function mockUpdateProject(id: string, project: Project): Promise<Project> {
  await delay(160);
  const now = new Date().toISOString();
  const next: Project = {
    ...project,
    id, // 防止 id 被覆盖
    shot_count: project.shots.length,
    duration_seconds: project.global.total_duration_seconds ?? project.duration_seconds ?? 0,
    updated_at: now,
  };
  PROJECT_DETAILS[id] = next;
  persistProjectDetails();

  // 列表里的元信息也要更
  const idx = PROJECTS.findIndex((p) => p.id === id);
  const item: ProjectListItem = {
    id,
    name: next.name,
    cover_url: next.cover_url,
    hue: next.hue,
    status: next.status,
    shot_count: next.shot_count,
    duration_seconds: next.duration_seconds,
    updated_at: now,
  };
  if (idx >= 0) PROJECTS[idx] = item;
  else PROJECTS.unshift(item);
  persistProjects();

  return next;
}

export async function mockDeleteProject(id: string): Promise<void> {
  await delay(140);
  const idx = PROJECTS.findIndex((p) => p.id === id);
  if (idx !== -1) {
    PROJECTS.splice(idx, 1);
    delete PROJECT_DETAILS[id];
    persistProjects();
    persistProjectDetails();
  }
}

function simpleHueFromName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  return Math.abs(hash) % 360;
}

export async function mockListCharacters(): Promise<Character[]> {
  await delay(120);
  // 动态注入 asset_bundle：从 api/assets 的 mockStore 实时算
  // （延迟 import 避免循环依赖）
  const { computeMockAssetBundle } = await import("./assets");
  return MOCK_CHARACTERS.map((c) => ({
    ...c,
    asset_bundle: computeMockAssetBundle(c.id),
  }));
}

// v0.5：org_id / ark_* / asset_bundle 由后端在 POST /characters 内部填充（CreateAssetGroup）
// 前端表单只提交基础字段，下列字段从 CharacterUpsert 中剔除
// v0.9.4: asset_provider 跟 ark_group_id 一样,由 ensureRealAssetGroup 在首次上传时回填,不让表单管
export type CharacterUpsert = Omit<
  Character,
  | "id"
  | "has_ref"
  | "created_at"
  | "updated_at"
  | "org_id"
  | "asset_provider"
  | "ark_group_id"
  | "ark_project_name"
  | "asset_bundle"
>;

export async function mockCreateCharacter(input: CharacterUpsert): Promise<Character> {
  await delay(180);
  const id = "c_" + Date.now().toString(36);
  const now = new Date().toISOString();
  const c: Character = {
    ...input,
    id,
    org_id: MOCK_ORG,
    asset_provider: null,
    ark_group_id: `group-mock-${id}`,
    ark_project_name: MOCK_ARK_PROJECT,
    asset_bundle: EMPTY_BUNDLE,
    has_ref: !!input.ref_image_url,
    created_at: now,
    updated_at: now,
  };
  MOCK_CHARACTERS.push(c);
  persistCharacters();
  return c;
}

export async function mockUpdateCharacter(id: string, patch: Partial<CharacterUpsert>): Promise<Character> {
  await delay(160);
  const idx = MOCK_CHARACTERS.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error("角色不存在");
  const merged: Character = {
    ...MOCK_CHARACTERS[idx],
    ...patch,
    has_ref: patch.ref_image_url !== undefined ? !!patch.ref_image_url : MOCK_CHARACTERS[idx].has_ref,
    updated_at: new Date().toISOString(),
  };
  MOCK_CHARACTERS[idx] = merged;
  persistCharacters();
  return merged;
}

export async function mockDeleteCharacter(id: string): Promise<void> {
  await delay(140);
  const idx = MOCK_CHARACTERS.findIndex((c) => c.id === id);
  if (idx !== -1) {
    MOCK_CHARACTERS.splice(idx, 1);
    persistCharacters();
  }
}

// === Scenes（场景库）====================================================
const DEFAULT_SCENES: Scene[] = [];
export const MOCK_SCENES: Scene[] = loadJSON<Scene[]>("scenes", DEFAULT_SCENES);

function persistScenes() {
  saveJSON("scenes", MOCK_SCENES);
}

export type SceneUpsert = { name: string; image_url: string | null; hue: number };

export async function mockListScenes(): Promise<Scene[]> {
  await delay(120);
  return MOCK_SCENES.map((s) => ({ ...s }));
}

export async function mockCreateScene(input: SceneUpsert): Promise<Scene> {
  await delay(180);
  const id = "s_" + Date.now().toString(36);
  const now = new Date().toISOString();
  const s: Scene = { ...input, id, created_at: now, updated_at: now };
  MOCK_SCENES.push(s);
  persistScenes();
  return s;
}

export async function mockUpdateScene(id: string, patch: Partial<SceneUpsert>): Promise<Scene> {
  await delay(160);
  const idx = MOCK_SCENES.findIndex((s) => s.id === id);
  if (idx === -1) throw new Error("场景不存在");
  const merged: Scene = { ...MOCK_SCENES[idx], ...patch, updated_at: new Date().toISOString() };
  MOCK_SCENES[idx] = merged;
  persistScenes();
  return merged;
}

export async function mockDeleteScene(id: string): Promise<void> {
  await delay(140);
  const idx = MOCK_SCENES.findIndex((s) => s.id === id);
  if (idx !== -1) {
    MOCK_SCENES.splice(idx, 1);
    persistScenes();
  }
}

// === Props（道具库）=====================================================
const DEFAULT_PROPS: Prop[] = [];
export const MOCK_PROPS: Prop[] = loadJSON<Prop[]>("props", DEFAULT_PROPS);

function persistProps() {
  saveJSON("props", MOCK_PROPS);
}

export type PropUpsert = { name: string; image_url: string | null; hue: number };

export async function mockListProps(): Promise<Prop[]> {
  await delay(120);
  return MOCK_PROPS.map((p) => ({ ...p }));
}

export async function mockCreateProp(input: PropUpsert): Promise<Prop> {
  await delay(180);
  const id = "p_" + Date.now().toString(36);
  const now = new Date().toISOString();
  const p: Prop = { ...input, id, created_at: now, updated_at: now };
  MOCK_PROPS.push(p);
  persistProps();
  return p;
}

export async function mockUpdateProp(id: string, patch: Partial<PropUpsert>): Promise<Prop> {
  await delay(160);
  const idx = MOCK_PROPS.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error("道具不存在");
  const merged: Prop = { ...MOCK_PROPS[idx], ...patch, updated_at: new Date().toISOString() };
  MOCK_PROPS[idx] = merged;
  persistProps();
  return merged;
}

export async function mockDeleteProp(id: string): Promise<void> {
  await delay(140);
  const idx = MOCK_PROPS.findIndex((p) => p.id === id);
  if (idx !== -1) {
    MOCK_PROPS.splice(idx, 1);
    persistProps();
  }
}

// === Auth ===============================================================
export async function mockSendSms(): Promise<{ expires_in: number; next_send_in: number }> {
  await delay(160);
  return { expires_in: 60, next_send_in: 60 };
}

// demo 自动登录走的固定号码,给它个友好昵称
const DEMO_PHONE = "13800138000";

// ────────── 多账户(PRD v0.9 §1.5)mock 存储 ──────────
//
// mock 模式下用 localStorage 维护一个「用户档案」+ 一个「组织档案」,持久化
// 在浏览器刷新 / 多次登录之间保持一致。
//
//   metamind-mock-v1-user_profile   存登录者档案:role/org_id/preferred_language/account_type/org_name
//   metamind-mock-v1-mock_org_members  组织成员列表(Owner 在 OrgPage 邀请的)

interface MockUserProfile {
  id?: string;
  name?: string;
  phone?: string;
  role?: "owner" | "member";
  account_type?: "personal" | "enterprise";
  org_id?: string;
  org_name?: string;
  preferred_language?: "zh-CN" | "en" | "fr";
  joined_at?: string;
}

function loadMockProfile(): MockUserProfile {
  return loadJSON<MockUserProfile>("user_profile", {});
}

function saveMockProfile(patch: MockUserProfile): MockUserProfile {
  const merged = { ...loadMockProfile(), ...patch };
  saveJSON("user_profile", merged);
  return merged;
}

function buildMockUser(input: { phone?: string; account?: string; isDemo?: boolean }): LoginResponse["user"] {
  const stored = loadMockProfile();
  const phone = stored.phone || input.phone || "13800138000";
  const id = stored.id || "u_mock";
  const orgId = stored.org_id || "org_mock";
  const accountType = stored.account_type || "personal";
  const role = stored.role || "owner";
  const orgName =
    stored.org_name || (accountType === "enterprise" ? "未命名公司" : (stored.name || "你") + " 的工作室");
  // mock 模式下:Demo 账号 + 13800138000 直接给 platform_admin,方便看 /admin/recharge UI
  const isPlatformAdmin = phone === "13800138000";
  return {
    id,
    name: stored.name || (input.isDemo ? "Demo 用户" : input.account || "你"),
    phone: phone.slice(0, 3) + "****" + phone.slice(7),
    avatar_url: null,
    email: null,
    org_id: orgId,
    role,
    status: "active",
    joined_at: stored.joined_at || new Date().toISOString(),
    preferred_language: stored.preferred_language || "zh-CN",
    is_platform_admin: isPlatformAdmin,
    org: {
      id: orgId,
      name: orgName,
      logo_url: null,
      owner_user_id: role === "owner" ? id : "u_owner_mock",
      seat_limit: accountType === "enterprise" ? 20 : 1,
      account_type: accountType,
      status: "active",
      member_count: 1,
      created_at: new Date().toISOString(),
    },
  };
}

export async function mockLoginPhone(phone: string): Promise<LoginResponse> {
  await delay(220);
  // 第一次登录时,持久化用户 phone(注册路径会带 phone 进来)
  if (phone && !loadMockProfile().phone) saveMockProfile({ phone });
  return {
    token: "mock-token-" + Date.now().toString(36),
    expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
    user: buildMockUser({ phone, isDemo: phone === DEMO_PHONE }),
  };
}

export async function mockLoginPassword(account: string): Promise<LoginResponse> {
  await delay(220);
  return {
    token: "mock-token-" + Date.now().toString(36),
    expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
    user: buildMockUser({ account }),
  };
}

/** 注册成功路径(mock):带 account_type + org_name 时,把它们落到 profile,再走 mockLoginPhone */
export async function mockRegister(input: {
  phone: string;
  account_type?: "personal" | "enterprise";
  org_name?: string;
}): Promise<LoginResponse> {
  saveMockProfile({
    phone: input.phone,
    account_type: input.account_type || "personal",
    org_name: input.account_type === "enterprise" ? input.org_name : undefined,
    role: "owner",
    joined_at: new Date().toISOString(),
  });
  return mockLoginPhone(input.phone);
}

/** mock 修改昵称 / preferred_language(persist 到 localStorage,下次登录还原) */
export async function mockUpdateUser(patch: { name?: string; preferred_language?: "zh-CN" | "en" | "fr" }): Promise<MockUserProfile> {
  await delay(160);
  return saveMockProfile(patch);
}

/** mock 修改密码:只做表单层面校验,不真比对老密码 */
export async function mockChangePassword(params: {
  old_password: string;
  new_password: string;
}): Promise<{ ok: true }> {
  await delay(220);
  if (!params.old_password) throw new Error("请输入旧密码");
  if (!params.new_password || params.new_password.length < 6) {
    throw new Error("新密码至少 6 位");
  }
  return { ok: true };
}

// === Account ============================================================
const ACCOUNT: Account = {
  user_id: "u_mock",
  balance_cents: 884200,
  gift_balance_cents: 32000,
  this_month: { spent_cents: 218600, generated_count: 84, duration_seconds: 768 },
  last_recharge: {
    amount_cents: 99900,
    time: "2026-05-12T14:23:00Z",
    bonus_cents: 20000,
  },
  lifetime: { spent_cents: 1843000, recharged_cents: 2727200 },
};

const PACKAGES: RechargePackage[] = [
  { id: "pk1", label: "体验包", price_cents: 9900,   credits_cents: 60000,  bonus_cents: 0,      badge: null,     per_unit_cents: 606  },
  { id: "pk2", label: "创作者", price_cents: 29900,  credits_cents: 200000, bonus_cents: 10000,  badge: "热门",   per_unit_cents: 702  },
  { id: "pk3", label: "工作室", price_cents: 99900,  credits_cents: 720000, bonus_cents: 80000,  badge: "推荐",   per_unit_cents: 801  },
  { id: "pk4", label: "MCN",    price_cents: 499900, credits_cents: 4000000, bonus_cents: 600000, badge: "省 23%", per_unit_cents: 920 },
];

const RECHARGES: RechargeRecord[] = [
  { id: "r1", time: "2026-05-12T14:23:00Z", method: "微信支付", amount_cents: 99900,  credits_cents: 720000,  bonus_cents: 80000,  status: "success" },
  { id: "r2", time: "2026-04-28T10:08:00Z", method: "支付宝",   amount_cents: 29900,  credits_cents: 200000,  bonus_cents: 10000,  status: "success" },
  { id: "r3", time: "2026-04-15T22:55:00Z", method: "微信支付", amount_cents: 9900,   credits_cents: 60000,   bonus_cents: 0,      status: "success" },
  { id: "r4", time: "2026-03-30T16:41:00Z", method: "对公转账", amount_cents: 499900, credits_cents: 4000000, bonus_cents: 600000, status: "success" },
];

export async function mockGetAccount(): Promise<Account> {
  await delay(140);
  return ACCOUNT;
}

export async function mockListPackages(): Promise<RechargePackage[]> {
  await delay(80);
  return PACKAGES;
}

export async function mockListRecharges(): Promise<RechargeRecord[]> {
  await delay(140);
  return RECHARGES;
}

// === Tasks ==============================================================
const TASK_TYPES: TaskTypeInfo[] = [
  { id: "i2v",  label: "图生视频", hue: 250 },
  { id: "t2v",  label: "文生视频", hue: 200 },
  { id: "v2v",  label: "视频续写", hue: 290 },
  { id: "char", label: "角色生成", hue: 70  },
];
const PLATFORMS = ["豆包视频", "可灵 1.6", "Sora · Turbo", "Vidu · pro", "墨韵"];
const USER_NAMES = ["metamind", "lz_studio", "drama_lab", "echo_chen", "lin_xia_pd", "midnight_cut"];
const FAIL_REASONS = ["平台超时", "积分不足", "内容审核未通过"];
const VIDEO_LENGTHS = [8, 16, 24, 32];

function randTask(i: number): GenerationTask {
  const now = new Date("2026-05-17T22:00:00").getTime();
  const start = new Date(now - i * (15 + (i * 31) % 90) * 60_000);
  const dur = 120 + (i * 73) % 700;
  const end = new Date(start.getTime() + dur * 1000);
  const statusRoll = (i * 7) % 100;
  let status: TaskStatus;
  let progress: number;
  if (statusRoll < 80) { status = "success"; progress = 100; }
  else if (statusRoll < 90) { status = "running"; progress = 20 + (i * 13) % 70; }
  else if (statusRoll < 96) { status = "queued"; progress = 0; }
  else { status = "failed"; progress = (i * 7) % 100; }
  const type = TASK_TYPES[i % TASK_TYPES.length];
  const platform = PLATFORMS[i % PLATFORMS.length];
  const user = USER_NAMES[i % USER_NAMES.length];
  const id = "task_" + Array.from({ length: 22 }, (_, k) =>
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[(i * 17 + k * 31) % 62]
  ).join("");
  const videoLen = VIDEO_LENGTHS[i % VIDEO_LENGTHS.length];
  const resolution = (i % 3 === 0 ? "720p" : "1080p") as "720p" | "1080p";
  return {
    id,
    project_id: i % 5 === 0 ? null : "p1",
    user_id: "u_mock",
    type,
    platform,
    upstream_model: "mock-model",
    channel_id: 8 + (i % 4),
    user,
    status,
    progress,
    submit_time: start.toISOString(),
    end_time: status === "queued" ? null : end.toISOString(),
    duration_seconds: status === "queued" ? 0 : dur,
    video_len_seconds: videoLen,
    resolution,
    cost_cents:
      status === "success" ? Math.round(dur * 18) :
      status === "failed"  ? 0 :
      Math.round(dur * 12),
    fail_reason: status === "failed" ? FAIL_REASONS[(i * 3) % FAIL_REASONS.length] : null,
    output_video_url: status === "success" ? "mock-video.mp4" : null,
    output_master_url: status === "success" ? "mock-master.mov" : null,
    thumbnail_urls: [],
    prompt:
      status === "success"
        ? {
            version: "v1",
            structured_json: null,
            natural_text:
              `【全局设定】\n时间：黄昏。场景：老式咖啡馆，暖色灯光。影像风格：电影感，浅景深，35mm 胶片质感。\n\n` +
              `【出场角色】林夏（女主，25 岁，米色风衣）、陈默（男主，28 岁，深灰大衣）。\n\n` +
              `【分镜 ${1 + (i % 4)}】\n动作：林夏推门而入，环顾四周后走向靠窗座位。\n运镜：缓慢跟随推镜，由全景推至中近景。\n台词：「你来得比我想的早。」\n音效：门铃轻响、环境人声。\n\n` +
              `【输出】分辨率 ${resolution} · 时长 ${videoLen}s · 自动字幕 + 轻柔钢琴背景音乐。`,
            locked: false,
          }
        : null,
  };
}

const TASKS: GenerationTask[] = Array.from({ length: 28 }, (_, i) => randTask(i));

export interface ListTasksParams {
  date_from?: string;
  date_to?: string;
  task_id?: string;
  status?: TaskStatus | "all";
  resolution?: "720p" | "1080p" | "all";
  page?: number;
  page_size?: number;
}

export async function mockListTasks(params: ListTasksParams = {}): Promise<Pagination<GenerationTask>> {
  await delay(180);
  let list = TASKS.slice();
  if (params.status && params.status !== "all") {
    list = list.filter((t) => t.status === params.status);
  }
  if (params.resolution && params.resolution !== "all") {
    list = list.filter((t) => t.resolution === params.resolution);
  }
  if (params.task_id) {
    const q = params.task_id.toLowerCase();
    list = list.filter((t) => t.id.toLowerCase().includes(q));
  }
  const page = params.page ?? 1;
  const page_size = params.page_size ?? 12;
  const total = list.length;
  list = list.slice((page - 1) * page_size, page * page_size);
  return { list, page, page_size, total };
}
