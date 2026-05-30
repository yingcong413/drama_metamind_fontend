import type { Character, Project } from "@/types";
import { CAMERA_MOVES, SHOT_SIZES } from "@/lib/fieldDefs";
// labelFor / filenameFromUrl 自 v0.9.5 起不再用:
// 主体定义段改为「将图片N中的角色定义为X / 以图片N为背景」格式,不再附文件名。

/**
 * 素材在 payload.images / payload.audios 数组中的实际下标(0-based)。
 * prompt 中以「图片N / 音频N」指代(N 为 1-based 下标;v0.9.5 起去掉 @ 前缀)。
 *
 * 排序原则遵循 Seedance 2.0 文档「重要素材前置」:
 *   角色参考图 → 场景图 → 站位草图 → 道具参考图 → 旁白音频
 */
export interface AssetIndexMap {
  /** character_id → images 数组中的下标（0-based） */
  characterImage: Record<string, number>;
  /** 场景图在 images 中的下标，未上传为 -1 */
  scene: number;
  /** 站位草图在 images 中的下标，未上传为 -1 */
  position: number;
  /** 道具参考图在 images 中的下标，未上传为 -1 */
  prop: number;
  /** 旁白音频在 audios 中的下标，未上传为 -1 */
  narration: number;
}

/**
 * 解析角色的"参考图"实际引用值（发到 Seedance API 的字符串）。
 * 优先级(与 resolveCharacterAudioRef 对齐):
 *   1. asset_bundle.primary_image_ark_asset_id → asset://{id}
 *      (SeeGen / 火山方舟侧的素材 id,Seedance 视频生成 API 原生支持
 *       asset:// 协议,稳定且不依赖中间 URL 是否公网可达)
 *   2. asset_bundle.primary_image_url(TOS 公网 URL,兜底)
 *   3. legacy ref_image_url(老数据迁移期保留)
 *   4. data URL(本地 base64 - 看上游是否接受)
 *   5. 都没有 → null
 *
 * ★ 为什么 asset:// 排第一?
 *   素材在 SeeGen 注册成功后,asset_id 就是稳定引用;直接拿 TOS URL 会受
 *   桶 ACL / 防盗链 / 临时签名失效影响。asset:// 让上游自己去内部 fetch,
 *   不存在跨网络拉不到的问题。
 *
 * ★ 过滤掉 mock 占位 URL(mock.tos.example、placeholder 等):
 *   它们看起来是 URL 但实际无法被 Seedance 拉取,发上去会让模型自己编脸。
 */
export function resolveCharacterImageRef(c: Character | undefined | null): string | null {
  if (!c) return null;
  // 1. SeeGen / 方舟 asset id(最稳)
  const arkId = c.asset_bundle?.primary_image_ark_asset_id;
  if (arkId && arkId.trim()) return `asset://${arkId}`;
  // 2. asset_bundle 的真实 TOS URL
  const bundleUrl = c.asset_bundle?.primary_image_url;
  if (isReachableUrl(bundleUrl)) return bundleUrl!;
  // 3. legacy ref_image_url
  const legacy = c.ref_image_url;
  if (isReachableUrl(legacy)) return legacy!;
  // 4. data URL(本地上传 base64)
  if (legacy && legacy.startsWith("data:")) return legacy;
  if (bundleUrl && bundleUrl.startsWith("data:")) return bundleUrl;
  return null;
}

/** http(s):// 且不是 mock 占位域名 */
function isReachableUrl(s: string | null | undefined): boolean {
  if (!s) return false;
  if (!/^https?:\/\//i.test(s)) return false;
  // mock 占位域名一律视为不可达,避免发出去 404
  const blocklist = ["mock.tos.example", "placeholder.example"];
  return !blocklist.some((host) => s.includes(host));
}

/** 角色音色参考音频的引用。优先 asset_bundle.primary_audio_*，fallback legacy voice_sample_url。 */
export function resolveCharacterAudioRef(c: Character | undefined | null): string | null {
  if (!c) return null;
  const arkId = c.asset_bundle?.primary_audio_ark_asset_id;
  if (arkId && arkId.trim()) return `asset://${arkId}`;
  const url = c.asset_bundle?.primary_audio_url;
  if (url && url.trim()) return url;
  const legacy = c.voice_sample_url;
  if (legacy && /^(https?:\/\/|asset:\/\/|data:)/i.test(legacy)) return legacy;
  return null;
}

/**
 * 按 Seedance 2.0 推荐顺序排出素材数组的下标。
 * buildSeedancePayload 和 buildPromptText 共享同一份映射,保证「图片N」与 images[N-1] 一致。
 */
export function buildAssetIndex(p: Project, characters: Character[]): AssetIndexMap {
  const map: AssetIndexMap = {
    characterImage: {},
    scene: -1,
    position: -1,
    prop: -1,
    narration: -1,
  };
  let imgIdx = 0;
  // 1. 角色参考图（重要素材前置）
  // 用 resolveCharacterImageRef 保证只在角色库真的上传了素材时才占用「图片N」编号
  for (const cid of p.global.characters ?? []) {
    const c = characters.find((x) => x.id === cid);
    if (resolveCharacterImageRef(c)) {
      map.characterImage[cid] = imgIdx++;
    }
  }
  // 2. 场景图
  if (p.global.scene_image && p.global.scene_image.trim()) {
    map.scene = imgIdx++;
  }
  // 3. 站位草图
  if (p.global.position_image_url && p.global.position_image_url.trim()) {
    map.position = imgIdx++;
  }
  // 4. 道具参考图
  if (p.global.prop_image_url && p.global.prop_image_url.trim()) {
    map.prop = imgIdx++;
  }
  // 5. 旁白音频
  if (p.global.narration_audio_url && p.global.narration_audio_url.trim()) {
    map.narration = 0;
  }
  return map;
}

/**
 * 把 0-based 数组下标转成 prompt 里的「图片N」引用(N 是 1-based)。
 * v0.9.5 起去掉 `@` 前缀 —— Seedance 实测对裸的「图片1 / 图片2」识别更稳,
 * 且 `@` 在某些下游(任务日志 / 短信审核 / CSV 导出)会被当作敏感符号过滤。
 */
function imgRef(idx: number): string {
  return idx >= 0 ? `图片${idx + 1}` : "";
}
function audioRef(idx: number): string {
  return idx >= 0 ? `音频${idx + 1}` : "";
}

/** 把运镜 id 转成中文术语（如 push_in → "镜头缓慢推近"），direction/speed 也合并进去。 */
function formatCameraMove(c: NonNullable<Project["shots"][number]["camera"]>[number]): string {
  const meta = [...CAMERA_MOVES.basic, ...CAMERA_MOVES.advanced, ...CAMERA_MOVES.special]
    .find((x) => x.id === c.id);
  if (!meta) return c.id;
  const speed = c.speed ? `${c.speed}速` : "";
  const dir = c.direction ? `向${c.direction}` : "";
  return [speed, dir, meta.cn].filter(Boolean).join("");
}

/**
 * 拼接成最终发给模型 / 显示给用户的纯文本提示词。
 * v0.9.5 起整段输出**单行无换行**,各段落用空格拼接。
 * 主体定义遵守用户期望模板:
 *   - 角色:将图片N中的角色定义为<角色名>
 *   - 场景:以图片N为背景
 *   - 站位:以图片N为人物站位参考
 *   - 道具:以图片N为道具参考,保持道具外观、材质、颜色一致
 * 镜头与台词部分:
 *   - 镜头时序:镜头 1 / 镜头 2 / 镜头 3 …
 *   - 台词 {},音效 <>,背景音乐 (),字幕 【】
 *   - 不写精确时长,运镜每镜只取主要一种
 *   - 末尾追加画质 + 视觉风格 + 约束词
 *
 * 保存弹窗的展示 与 生成视频 payload.prompt 都必须走这一个函数,以保证两边一致。
 */
export function buildPromptText(p: Project, characters: Character[]): string {
  const idx = buildAssetIndex(p, characters);
  const g = p.global;
  const lines: string[] = [];

  // ────────── 1. 主体定义段(v0.9.5 简化为「将图片N中的角色定义为X / 以图片N为背景」格式) ──────────
  // 例:将图片1中的角色定义为莉亚,将图片2中的角色定义为机械狼,以图片3为背景。
  // 不再带 [desc] 包裹 —— 角色细节交给 story / shot 描述,主体定义只负责绑定 id ↔ 图片。
  const subjectDefs: string[] = [];
  for (const cid of g.characters ?? []) {
    const c = characters.find((x) => x.id === cid);
    if (!c) continue;
    const ref = imgRef(idx.characterImage[cid] ?? -1);
    if (ref) {
      subjectDefs.push(`将${ref}中的角色定义为${c.name}`);
    } else {
      // 没有参考图时,只能用文字描述,保持原有兜底写法
      const feature = (c.desc || c.role || "").trim();
      subjectDefs.push(`${c.name}(${feature || "角色"})`);
    }
  }
  if (idx.scene >= 0 && g.scene_image) {
    subjectDefs.push(`以${imgRef(idx.scene)}为背景`);
  }
  if (idx.position >= 0 && g.position_image_url) {
    subjectDefs.push(`以${imgRef(idx.position)}为人物站位参考`);
  }
  if (idx.prop >= 0 && g.prop_image_url) {
    subjectDefs.push(`以${imgRef(idx.prop)}为道具参考,保持道具外观、材质、颜色一致`);
  }
  if (subjectDefs.length) {
    lines.push(subjectDefs.join(",") + "。");
  }

  // 影像风格 + 旁白音频说明放在主体定义之后
  // v0.9.5: 时长不进 prompt —— Seedance payload 顶层已有 duration 字段,prompt 里重复反而抢权重
  const meta: string[] = [];
  if (g.style?.length) meta.push(`整体风格：${g.style.join(" + ")}`);
  if (idx.narration >= 0) meta.push(`旁白配音参考${audioRef(idx.narration)}`);
  if (meta.length) lines.push(meta.join("；") + "。");

  // 故事梗概
  if (g.story?.trim()) {
    lines.push(g.story.trim());
  }

  // ────────── 2. 分镜:镜头 1 / 镜头 2 / … ──────────
  // v0.9.5 起整段 prompt 不再包含换行符,所有段落用空格拼接,镜头标题加「。」收尾
  p.shots.forEach((s, i) => {
    lines.push(`镜头 ${i + 1}·${s.name}。`);

    const parts: string[] = [];
    // 分镜描述:整镜在讲什么,放在镜头段最前面
    if (s.description?.trim()) {
      parts.push(`${s.description.trim()}。`);
    }
    // 景别 + 运镜（合并到第一句）
    const camHead: string[] = [];
    if (s.shot_size) {
      const ss = SHOT_SIZES.find((x) => x.id === s.shot_size);
      if (ss) camHead.push(ss.cn);
    }
    if (s.camera?.length) {
      // 文档建议一个镜头里只指定 1 种运镜，取首个
      camHead.push(formatCameraMove(s.camera[0]));
    }
    if (camHead.length) parts.push(camHead.join("，") + "。");

    // 动作：起点 → 过程 → 结束
    const action = [s.action?.start, s.action?.mid, s.action?.end]
      .filter(Boolean)
      .join(" → ");
    if (action) {
      parts.push(`${action}（动作幅度 ${s.action_strength ?? 65}%）。`);
    }
    // 微表情
    const micro = [s.micro?.eyes, s.micro?.look, s.micro?.emotion]
      .filter(Boolean)
      .join("、");
    if (micro) {
      parts.push(`表情：${micro}（微表情 ${s.micro_strength ?? 65}%）。`);
    }
    // 小动作
    if (s.gesture) {
      parts.push(`小动作：${s.gesture}（强度 ${s.gesture_strength ?? 65}%）。`);
    }
    if (parts.length) lines.push(parts.join(" "));

    // 台词、独白、旁白（每条独立一行，便于模型识别）
    if (s.lines?.text) {
      const name = characters.find((c) => c.id === s.lines?.char_id)?.name ?? "角色";
      lines.push(`${name}说：{${s.lines.text}}`);
    }
    if (s.mono?.text) {
      const name = characters.find((c) => c.id === s.mono?.char_id)?.name ?? "角色";
      lines.push(`${name}内心独白：{${s.mono.text}}`);
    }
    if (s.narration?.text) {
      lines.push(`旁白：{${s.narration.text}}`);
    }
    // 音效用 <>
    if (s.sfx) {
      const sfxItems = s.sfx
        .split(/[、，,；;]/)
        .map((x) => x.trim())
        .filter(Boolean);
      if (sfxItems.length) {
        lines.push(sfxItems.map((x) => `<${x}>`).join("，"));
      }
    }
  });

  // ────────── 3. 全局环境音效 / 背景音乐 / 字幕 ──────────
  const globalAudio: string[] = [];
  if (p.output?.ambient_sfx?.trim()) {
    const items = p.output.ambient_sfx
      .split(/[、，,；;]/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (items.length) {
      globalAudio.push(`环境音效：${items.map((x) => `<${x}>`).join("，")}`);
    }
  }
  if (p.output?.music) {
    globalAudio.push("（背景音乐贯穿全片，与剧情情绪同步）");
  }
  if (globalAudio.length) {
    lines.push(globalAudio.join("。") + "。");
  }

  // ────────── 4. 末尾画质 + 视觉风格 + 约束词 ──────────
  // v0.9.5: 逐条 dedupe —— 用户在「画质内容」字段如果粘贴了完整约束块(常见操作),
  // 默认约束遇到字符串已存在于 customQuality 时就跳过,避免整段重复。
  const customQuality = g.image_quality?.trim();
  const defaults: string[] = [
    "整体画面高清、细节丰富、电影质感、色彩自然、光影柔和",
    "人物面部稳定不变形、动作连贯自然、无卡顿无闪烁、无穿模",
  ];
  // 主体多于 1 时追加防双胞胎约束
  if ((g.characters?.length ?? 0) > 1) {
    defaults.push("视频全程禁止出现外形、着装完全一致的人物，禁止双胞胎效果");
  }
  // 字幕约束
  if (p.output?.subtitle === false) {
    defaults.push("保持无字幕、避免生成任何文字或字幕");
  }
  // 通用约束
  defaults.push("不要生成水印、不要生成 Logo");

  const tail: string[] = [];
  if (customQuality) {
    // 去掉用户字段尾部的 。/./空白,避免最终拼出 "。。" 双句号
    tail.push(customQuality.replace(/[。.\s]+$/u, ""));
  }
  for (const d of defaults) {
    // 子串判断:用户字段里只要原样出现过这条约束就不重复加
    if (customQuality && customQuality.includes(d)) continue;
    tail.push(d);
  }
  if (tail.length) lines.push(tail.join("；") + "。");

  // v0.9.5: 整段 prompt 用单空格拼成一行,不再有 \n。
  // 防御性过滤空串(老分支可能 push 进空字符串)。
  return lines.filter((s) => s.trim().length > 0).join(" ").trim();
}
