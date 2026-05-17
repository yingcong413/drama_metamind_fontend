import type {
  Account,
  Character,
  GenerationTask,
  LoginResponse,
  Pagination,
  Project,
  ProjectListItem,
  ProjectStatus,
  RechargePackage,
  RechargeRecord,
  TaskStatus,
  TaskTypeInfo,
} from "@/types";

const PROJECTS: ProjectListItem[] = [
  { id: "p1", name: "雨夜的告别",   cover_url: null, hue: 220, status: "draft", shot_count: 12, duration_seconds: 204, updated_at: "2026-05-17T08:00:00Z" },
  { id: "p2", name: "便利店的清晨", cover_url: null, hue: 60,  status: "done",  shot_count: 8,  duration_seconds: 130, updated_at: "2026-05-16T10:00:00Z" },
  { id: "p3", name: "她不再回头",   cover_url: null, hue: 320, status: "done",  shot_count: 18, duration_seconds: 342, updated_at: "2026-05-14T09:00:00Z" },
  { id: "p4", name: "考研最后一夜", cover_url: null, hue: 280, status: "gen",   shot_count: 6,  duration_seconds: 108, updated_at: "2026-05-10T22:00:00Z" },
  { id: "p5", name: "夏天结束之前", cover_url: null, hue: 150, status: "draft", shot_count: 14, duration_seconds: 248, updated_at: "2026-05-03T15:00:00Z" },
  { id: "p6", name: "深夜的电梯",   cover_url: null, hue: 12,  status: "done",  shot_count: 9,  duration_seconds: 156, updated_at: "2026-04-20T19:30:00Z" },
];

export const MOCK_CHARACTERS: Character[] = [
  { id: "c1", name: "林夏",       role: "女主", desc: "25岁都市白领，独立坚韧，常穿米色风衣，齐耳短发", tags: ["女主", "都市"], ref_image_url: "ref-1", ref_images: [], voice_sample_url: null, hue: 340, has_ref: true,  created_at: "", updated_at: "" },
  { id: "c2", name: "陈砚",       role: "男主", desc: "28岁建筑师，沉稳寡言，金丝眼镜短发，常着深灰大衣",   tags: ["男主", "都市"], ref_image_url: "ref-2", ref_images: [], voice_sample_url: null, hue: 220, has_ref: true,  created_at: "", updated_at: "" },
  { id: "c3", name: "苏老师",     role: "配角", desc: "中年女性教师，温和有力量，齐肩卷发，常着米白针织开衫", tags: ["配角", "成熟"], ref_image_url: "ref-3", ref_images: [], voice_sample_url: null, hue: 150, has_ref: true,  created_at: "", updated_at: "" },
  { id: "c4", name: "小宁",       role: "少年", desc: "12岁少女，扎双马尾，校服，活泼但敏感",                tags: ["少年", "校园"], ref_image_url: null,    ref_images: [], voice_sample_url: null, hue: 50,  has_ref: false, created_at: "", updated_at: "" },
  { id: "c5", name: "老李",       role: "配角", desc: "便利店老板，60岁左右，圆脸笑眯眯，蓝色围裙",          tags: ["配角"],         ref_image_url: "ref-5", ref_images: [], voice_sample_url: null, hue: 30,  has_ref: true,  created_at: "", updated_at: "" },
  { id: "c6", name: "外卖员阿强", role: "路人", desc: "30岁外卖员，戴着帽子和口罩，蓝色制服",                tags: ["路人", "都市"], ref_image_url: null,    ref_images: [], voice_sample_url: null, hue: 200, has_ref: false, created_at: "", updated_at: "" },
];

const PROJECT_DETAILS: Record<string, Project> = {
  p1: {
    id: "p1", name: "雨夜的告别", cover_url: null, hue: 220, status: "draft",
    shot_count: 3, duration_seconds: 204,
    created_at: "2026-05-15T08:00:00Z", updated_at: "2026-05-17T08:00:00Z",
    global: {
      season: "秋", time_of_day: "黑夜",
      scene_images: ["咖啡厅 · 室内", "街道 · 雨夜"],
      scene_selected: 1,
      position_image_url: "站位草图 v2",
      style: ["真人实拍"],
      characters: ["c1", "c2"],
      story: "林夏与陈砚在咖啡厅相约，准备最后一次见面。她把戒指放到桌上，雨声盖过他们的沉默。最后林夏起身离开，没有回头。",
    },
    shots: [
      {
        id: "s1", name: "推门入店", order: 0,
        cast_ids: ["c1"],
        action: { start: "林夏在咖啡厅门外驻足", mid: "推开玻璃门走入店内", end: "环视一圈后径直走向靠窗的位置" },
        micro: { eyes: "微微眯起，扫视店内", look: "略显犹豫", emotion: "压抑、克制" },
        gesture: "右手收拢风衣领口，左手攥紧手机",
        camera: [{ id: "push_in", speed: "慢", magnitude: "中", direction: null }],
        lines: { char_id: "c1", text: "", audio_url: null },
        mono:  { char_id: "c1", text: "已经三个月没来这家店了。", audio_url: "mono-01.m4a" },
        narration: { char_id: null, text: "", audio_url: null },
        sfx: "玻璃门铃铛声、雨声闷过门",
      },
      {
        id: "s2", name: "落座与对视", order: 1,
        cast_ids: ["c1", "c2"],
        action: { start: "林夏在陈砚对面坐下", mid: "脱下风衣搭在椅背", end: "抬头与陈砚短暂对视后看向窗外" },
        micro: { eyes: "回避对视", look: "克制紧张", emotion: "刺痛但平静" },
        gesture: "用手指无意识地摩挲杯沿",
        camera: [{ id: "pan_l", speed: "中", magnitude: "中", direction: null }],
        lines: { char_id: "c2", text: "你来了。", audio_url: "line-02-chen.m4a" },
        mono: null, narration: null,
        sfx: "",
      },
      {
        id: "s3", name: "递出戒指", order: 2,
        cast_ids: ["c1", "c2"],
        action: { start: "林夏从口袋取出戒指盒", mid: "缓缓推到桌子中央", end: "双手收回放在膝上" },
        micro: { eyes: "盯着戒指盒", look: "决绝", emotion: "释然" },
        gesture: "推盒子时手指微微颤抖",
        camera: [{ id: "boom_d", speed: "慢", magnitude: "小", direction: null }],
        lines: { char_id: "c1", text: "还给你。", audio_url: "line-03-lin.m4a" },
        mono: null, narration: null,
        sfx: "戒指盒触桌的轻响",
      },
    ],
    output: { ambient_sfx: "咖啡厅低噪声、远处雨声、隐约爵士乐", subtitle: true, music: true },
  },
};

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
    season: null, time_of_day: null,
    scene_images: [], scene_selected: null,
    position_image_url: null,
    style: [], characters: [], story: "",
  },
  shots: [
    {
      id: "s_init", name: "新分镜", order: 0,
      cast_ids: [],
      action: { start: "", mid: "", end: "" },
      micro: { eyes: "", look: "", emotion: "" },
      gesture: "", camera: [],
      lines: null, mono: null, narration: null,
      sfx: "",
    },
  ],
  output: { ambient_sfx: "", subtitle: false, music: false },
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

export async function mockListCharacters(): Promise<Character[]> {
  await delay(120);
  return MOCK_CHARACTERS.slice();
}

export type CharacterUpsert = Omit<Character, "id" | "has_ref" | "created_at" | "updated_at">;

export async function mockCreateCharacter(input: CharacterUpsert): Promise<Character> {
  await delay(180);
  const id = "c_" + Date.now().toString(36);
  const now = new Date().toISOString();
  const c: Character = {
    ...input,
    id,
    has_ref: !!input.ref_image_url,
    created_at: now,
    updated_at: now,
  };
  MOCK_CHARACTERS.push(c);
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
  return merged;
}

export async function mockDeleteCharacter(id: string): Promise<void> {
  await delay(140);
  const idx = MOCK_CHARACTERS.findIndex((c) => c.id === id);
  if (idx !== -1) MOCK_CHARACTERS.splice(idx, 1);
}

// === Auth ===============================================================
export async function mockSendSms(): Promise<{ expires_in: number; next_send_in: number }> {
  await delay(160);
  return { expires_in: 60, next_send_in: 60 };
}

export async function mockLoginPhone(phone: string): Promise<LoginResponse> {
  await delay(220);
  return {
    token: "mock-token-" + Date.now().toString(36),
    expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
    user: {
      id: "u_mock",
      name: "你",
      phone: phone.slice(0, 3) + "****" + phone.slice(7),
      avatar_url: null,
    },
  };
}

export async function mockLoginPassword(account: string): Promise<LoginResponse> {
  await delay(220);
  return {
    token: "mock-token-" + Date.now().toString(36),
    expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
    user: { id: "u_mock", name: account || "你", phone: "138****8000", avatar_url: null },
  };
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
    prompt: null,
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
