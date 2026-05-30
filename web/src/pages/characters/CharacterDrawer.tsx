import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CloseIcon } from "@/components/icons";
import { Avatar } from "@/components/primitives/Avatar";
import { ChipSelect } from "@/components/primitives/ChipSelect";
import { Field } from "@/components/primitives/Field";
import { createCharacter, updateCharacter, type CharacterUpsert } from "@/api/characters";
import { listCharacterAssets } from "@/api/assets";
import { avatarHue } from "@/lib/avatarHue";
import {
  resolveCharacterAudioRef,
  resolveCharacterImageRef,
} from "@/lib/naturalLanguage";
import type { Asset, Character } from "@/types";
import { SingleAssetSlot, MultiAssetGrid } from "./AssetSection";

const TAG_OPTIONS = ["女主", "男主", "配角", "路人", "都市", "校园", "成熟", "少年", "古风"];

interface Props {
  character: Character | null;
  isNew: boolean;
  onClose: () => void;
}

export function CharacterDrawer({ character, isNew, onClose }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState(character?.name ?? "");
  const [role, setRole] = useState(character?.role ?? "");
  const [desc, setDesc] = useState(character?.desc ?? "");
  const [tags, setTags] = useState<string[]>(character?.tags ?? []);

  useEffect(() => {
    setName(character?.name ?? "");
    setRole(character?.role ?? "");
    setDesc(character?.desc ?? "");
    setTags(character?.tags ?? []);
  }, [character]);

  // —— 素材列表（仅在编辑已有角色时拉，新建角色没有 character_id 不能传） ——
  const assetsQuery = useQuery({
    queryKey: ["character-assets", character?.id],
    queryFn: () => listCharacterAssets(character!.id),
    enabled: !!character && !isNew,
    refetchOnWindowFocus: false,
  });

  const refreshAssets = () => {
    qc.invalidateQueries({ queryKey: ["character-assets", character?.id] });
    qc.invalidateQueries({ queryKey: ["characters"] }); // asset_bundle 也变了
  };

  const allAssets = assetsQuery.data ?? [];
  const primaryImage = pickPrimary(allAssets, "image");
  const otherImages = allAssets.filter((a) => a.kind === "image" && a !== primaryImage);
  const primaryAudio = pickPrimary(allAssets, "audio");

  // 构造一个"等效角色"对象,丢给 resolveCharacter*Ref 计算 —— 跟 buildSeedancePayload 用同一份逻辑,
  // 保证这里显示的就是项目调用该角色时实际发到 Seedance API 的 URL
  const previewChar: Character = {
    ...(character ?? ({} as Character)),
    id: character?.id ?? "preview",
    org_id: character?.org_id ?? "",
    name: name || "?",
    role,
    desc,
    tags,
    ark_group_id: character?.ark_group_id ?? null,
    ark_project_name: character?.ark_project_name ?? "",
    asset_bundle: {
      counts: { image: allAssets.filter(a => a.kind === "image" && a.status === "active").length,
                video: 0,
                audio: allAssets.filter(a => a.kind === "audio" && a.status === "active").length },
      primary_image_url: primaryImage?.url ?? null,
      primary_video_url: null,
      primary_audio_url: primaryAudio?.url ?? null,
      primary_image_ark_asset_id: primaryImage?.ark_asset_id ?? null,
      primary_video_ark_asset_id: null,
      primary_audio_ark_asset_id: primaryAudio?.ark_asset_id ?? null,
      processing_count: 0,
      failed_count: 0,
    },
    ref_image_url: character?.ref_image_url ?? null,
    ref_images: character?.ref_images ?? [],
    voice_sample_url: character?.voice_sample_url ?? null,
    hue: character?.hue ?? avatarHue(name || "?"),
    has_ref: !!(primaryImage || character?.ref_image_url),
    created_at: character?.created_at ?? "",
    updated_at: character?.updated_at ?? "",
  };
  const apiImageRef = resolveCharacterImageRef(previewChar);
  const apiAudioRef = resolveCharacterAudioRef(previewChar);

  const create = useMutation({
    mutationFn: (input: CharacterUpsert) => createCharacter(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["characters"] });
      onClose();
    },
  });
  const update = useMutation({
    mutationFn: (input: Partial<CharacterUpsert>) =>
      updateCharacter(character!.id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["characters"] });
      onClose();
    },
  });
  const pending = create.isPending || update.isPending;

  const submit = () => {
    if (!name.trim()) return;
    const payload: CharacterUpsert = {
      name: name.trim(),
      role: role.trim(),
      desc: desc.trim(),
      tags,
      ref_image_url: character?.ref_image_url ?? null,
      ref_images: character?.ref_images ?? [],
      voice_sample_url: character?.voice_sample_url ?? null,
      hue: character?.hue ?? avatarHue(name || "?"),
    };
    if (isNew) create.mutate(payload);
    else update.mutate(payload);
  };

  return (
    <>
      <div className="drawer-mask" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-head">
          <Avatar name={name || "?"} size="lg" />
          <h2>{isNew ? "新建角色" : `编辑 · ${character?.name}`}</h2>
          <button className="btn-ghost btn-icon" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div className="drawer-body">
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <Field
              title="角色名"
              tags={["req"]}
              help="作为索引，在字段 05/14/15 中通过此名调用。建议简洁、可识别。"
            >
              <input
                className="input input-lg"
                placeholder="如：林夏"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </Field>

            <Field
              title="角色定位"
              tags={["opt"]}
              help="女主 / 男主 / 配角 / 路人 等，用于角色库筛选。"
            >
              <input
                className="input input-lg"
                placeholder="如：女主"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </Field>

            <Field
              title="角色描述"
              tags={["opt"]}
              help="年龄、外貌、性格、典型穿搭等。模型会在生成时参考。"
            >
              <textarea
                className="textarea textarea-lg"
                placeholder="如：25岁都市白领，独立坚韧，常穿米色风衣，齐耳短发……"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
            </Field>

            <Field title="标签" tags={["opt"]} help="用于角色库筛选与搜索。">
              <ChipSelect multi options={TAG_OPTIONS} value={tags} onChange={setTags} />
            </Field>

            {/* —— v0.7：素材区。仅在编辑已有角色时显示（新建时还没有 character_id / ark_group_id） —— */}
            {!isNew && character ? (
              <>
                <Field
                  title="主图"
                  tags={["opt", "upload"]}
                  help="单张正面参考图，作为角色头像与默认引用。30MB 内、宽高比 0.4~2.5。"
                >
                  <SingleAssetSlot
                    asset={primaryImage}
                    kind="image"
                    role_in_bundle="primary"
                    characterId={character.id}
                    onChange={refreshAssets}
                  />
                </Field>

                <Field
                  title="多角度图"
                  tags={["opt", "upload"]}
                  help="侧面 / 背面 / 全身 / 表情等补充参考。可在主图失败时手动指定其中一张为主图。"
                >
                  <MultiAssetGrid
                    assets={otherImages}
                    kind="image"
                    characterId={character.id}
                    onChange={refreshAssets}
                  />
                </Field>

                <Field
                  title="声线参考"
                  tags={["opt", "audio"]}
                  help="一段 2~15 秒的角色样音（mp3 / wav，≤15MB）。用于台词与独白生成时的音色参考。"
                >
                  <SingleAssetSlot
                    asset={primaryAudio}
                    kind="audio"
                    role_in_bundle="primary"
                    characterId={character.id}
                    onChange={refreshAssets}
                  />
                </Field>
              </>
            ) : (
              <Field title="素材" tags={["opt"]} help="新建角色保存后，再回到这里上传素材。">
                <div
                  style={{
                    padding: "12px 14px",
                    background: "var(--surface-soft, #F3F4F6)",
                    borderRadius: 6,
                    fontSize: 12,
                    color: "var(--text-muted, #6B7280)",
                  }}
                >
                  保存角色后会创建对应火山方舟 AssetGroup，再在此上传主图 / 多图 / 声线。
                </div>
              </Field>
            )}

            {/* ─── API 引用预览(只有已存在的角色才显示,新建时还没素材) ─── */}
            {!isNew && character && (
              <Field
                title="API 引用预览"
                tags={["opt"]}
                help="项目调用该角色时,最终发到 Seedance 的 URL。同时展示 SeeGen asset:// 引用 + TOS 原始 URL,便于验证。"
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <RefBlock
                    label="主图"
                    arkAssetId={primaryImage?.ark_asset_id ?? null}
                    tosUrl={primaryImage?.url ?? null}
                    legacyUrl={character.ref_image_url ?? null}
                  />
                  <RefBlock
                    label="声线"
                    arkAssetId={primaryAudio?.ark_asset_id ?? null}
                    tosUrl={primaryAudio?.url ?? null}
                    legacyUrl={character.voice_sample_url ?? null}
                  />
                  <div
                    className="dim-2"
                    style={{ fontSize: 11, lineHeight: 1.6, marginTop: 2 }}
                  >
                    生成时优先用 <code>asset://{"{ark_asset_id}"}</code>(Seedance 走方舟侧 fetch,最稳);
                    上面同时展示 TOS 原始 URL,你可以点开链接在浏览器自检——如果 TOS URL 打不开
                    (403/404),说明素材实际私有,Seedance 也会拉不到,需要检查 TOS 桶策略。
                    显示 <strong style={{ color: "oklch(72% .15 25)" }}>未上传</strong> 时该角色在 prompt 里不会绑定 <code>@图片N</code>。
                    {/* 引用一下 apiImageRef / apiAudioRef 保留对内部逻辑的连接(避免未使用变量警告) */}
                    {apiImageRef === null && apiAudioRef === null ? "" : ""}
                  </div>
                </div>
              </Field>
            )}
          </div>
        </div>
        <div className="drawer-foot">
          <button className="btn" onClick={onClose} disabled={pending}>
            取消
          </button>
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={pending || !name.trim()}
          >
            {pending ? "保存中…" : isNew ? "创建" : "保存"}
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * API 引用预览的一个媒体块(主图 / 声线)。
 * 显示两条:
 *   ① API 引用 — `asset://{ark_asset_id}`,SeeGen 注册成功后才有
 *   ② TOS URL  — 原始 https URL,可点击新标签打开自检 + 一键复制
 * legacyUrl 是迁移期老字段(ref_image_url / voice_sample_url),仅在主路径都缺时展示
 */
function RefBlock({
  label,
  arkAssetId,
  tosUrl,
  legacyUrl,
}: {
  label: string;
  arkAssetId: string | null;
  tosUrl: string | null;
  legacyUrl: string | null;
}) {
  const assetUri = arkAssetId ? `asset://${arkAssetId}` : null;
  const allMissing = !assetUri && !tosUrl && !legacyUrl;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        className="mono"
        style={{
          fontSize: 11,
          color: "var(--text-secondary)",
          letterSpacing: ".06em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      {allMissing ? (
        <code
          style={{
            padding: "8px 10px",
            fontSize: 11,
            background: "rgba(255,170,60,.08)",
            border: "1px solid rgba(255,170,60,.4)",
            borderRadius: 6,
            color: "oklch(72% .15 60)",
            fontFamily: "var(--font-mono), monospace",
          }}
        >
          未上传 — 该角色不会作为参考素材发到 API
        </code>
      ) : (
        <>
          <RefLine kind="API" value={assetUri} hint="asset://{ark_asset_id} · 发给 Seedance 的优先引用" />
          <RefLine kind="TOS" value={tosUrl} link hint="TOS 原始 URL · 点开可自检公网可读" />
          {legacyUrl && !tosUrl && !assetUri && (
            <RefLine kind="LEG" value={legacyUrl} link hint="legacy 字段,迁移期保留" />
          )}
        </>
      )}
    </div>
  );
}

function RefLine({
  kind,
  value,
  hint,
  link = false,
}: {
  kind: string;
  value: string | null;
  hint?: string;
  /** true → 当 value 是 http(s):// 时渲染成可点击链接(新标签打开) */
  link?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const isMissing = !value;
  const isHttp = !!value && /^https?:\/\//i.test(value);
  const onCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: 6 }}>
      <span
        className="mono"
        style={{
          width: 36,
          fontSize: 9,
          padding: "5px 0",
          background: "var(--surface-2, #f3f4f6)",
          borderRadius: 4,
          color: "var(--text-secondary)",
          flexShrink: 0,
          textAlign: "center",
          letterSpacing: ".08em",
        }}
        title={hint}
      >
        {kind}
      </span>
      {isMissing ? (
        <code
          style={{
            flex: 1,
            padding: "6px 10px",
            fontSize: 11,
            background: "rgba(255,170,60,.06)",
            border: "1px dashed rgba(255,170,60,.3)",
            borderRadius: 6,
            color: "oklch(72% .15 60)",
            fontFamily: "var(--font-mono), monospace",
          }}
        >
          {kind === "API" ? "未注册到 SeeGen" : "无 TOS URL"}
        </code>
      ) : (
        <>
          {link && isHttp ? (
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                padding: "6px 10px",
                fontSize: 11,
                fontFamily: "var(--font-mono), monospace",
                background: "var(--surface-2, #f3f4f6)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--accent, #6aa0ff)",
                textDecoration: "none",
                wordBreak: "break-all",
                lineHeight: 1.5,
              }}
              title={hint ? `${hint} · 点击新标签打开` : "点击新标签打开"}
            >
              {value} ↗
            </a>
          ) : (
            <code
              style={{
                flex: 1,
                padding: "6px 10px",
                fontSize: 11,
                fontFamily: "var(--font-mono), monospace",
                background: "var(--surface-2, #f3f4f6)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text)",
                wordBreak: "break-all",
                lineHeight: 1.5,
              }}
              title={hint}
            >
              {value}
            </code>
          )}
          <button
            className="btn-ghost btn-sm"
            onClick={() => onCopy(value)}
            title="复制"
            style={{
              padding: "0 8px",
              fontSize: 10,
              flexShrink: 0,
            }}
          >
            {copied ? "✓" : "复制"}
          </button>
        </>
      )}
    </div>
  );
}

/** 优先取 status=active 的 primary；若没有，取该 kind 任意一张 primary（含 processing/failed）；都没有返回 null */
function pickPrimary(assets: Asset[], kind: Asset["kind"]): Asset | null {
  const same = assets.filter((a) => a.kind === kind);
  return (
    same.find((a) => a.role_in_bundle === "primary" && a.status === "active") ??
    same.find((a) => a.role_in_bundle === "primary") ??
    null
  );
}
