import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CloseIcon, MicIcon, UploadIcon } from "@/components/icons";
import { Avatar } from "@/components/primitives/Avatar";
import { ChipSelect } from "@/components/primitives/ChipSelect";
import { Field } from "@/components/primitives/Field";
import { Placeholder } from "@/components/primitives/Placeholder";
import { createCharacter, updateCharacter, type CharacterUpsert } from "@/api/characters";
import { avatarHue } from "@/lib/avatarHue";
import type { Character } from "@/types";

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
              title="参考图"
              tags={["opt", "upload"]}
              help="主图作为角色基准。可补充侧面、表情、服装等参考图增强一致性。"
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="thumb" style={{ aspectRatio: "3/4" }}>
                  <Placeholder label="主图 · 1024×1024" />
                </div>
                <div className="upload" style={{ minHeight: 0 }}>
                  <div className="upload-icon">
                    <UploadIcon />
                  </div>
                  <div style={{ fontSize: 12 }}>添加更多角度</div>
                </div>
              </div>
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

            <Field
              title="声线参考"
              tags={["opt", "audio"]}
              help="可上传一段角色样音，用于台词与独白生成时的音色参考。"
            >
              <button
                className="btn"
                style={{ justifyContent: "flex-start", padding: "12px 14px", width: "100%" }}
              >
                <MicIcon /> 上传或录制声线参考
              </button>
            </Field>
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
