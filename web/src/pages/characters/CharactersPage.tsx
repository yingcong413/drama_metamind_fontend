import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { PlusIcon, SearchIcon } from "@/components/icons";
import { deleteCharacter, listCharacters } from "@/api/characters";
import { cn } from "@/lib/cn";
import type { Character } from "@/types";
import { CharacterTile } from "./CharacterTile";
import { CharacterList } from "./CharacterList";
import { CharacterDrawer } from "./CharacterDrawer";
import { useT, useTf } from "@/lib/i18n";

type Filter = "all" | "ref" | "noref";
type View = "gallery" | "list";

export function CharactersPage() {
  const t = useT();
  const tf = useTf();
  const qc = useQueryClient();
  const { data: characters = [], isLoading } = useQuery({
    queryKey: ["characters"],
    queryFn: listCharacters,
  });

  const [editing, setEditing] = useState<Character | null>(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<View>("gallery");
  const [q, setQ] = useState("");

  const del = useMutation({
    mutationFn: (id: string) => deleteCharacter(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["characters"] }),
  });

  const counts = useMemo(
    () => ({
      all: characters.length,
      ref: characters.filter((c) => c.has_ref).length,
      noref: characters.filter((c) => !c.has_ref).length,
    }),
    [characters],
  );

  const filtered = useMemo(
    () =>
      characters
        .filter((c) =>
          filter === "all" ? true : filter === "ref" ? c.has_ref : !c.has_ref,
        )
        .filter(
          (c) => !q || c.name.includes(q) || c.role?.includes(q) || c.desc?.includes(q),
        ),
    [characters, filter, q],
  );

  const onDelete = (c: Character) => {
    if (confirm(tf("确认删除角色「{name}」？此操作不可撤销。", { name: c.name }))) del.mutate(c.id);
  };

  const closeDrawer = () => {
    setEditing(null);
    setCreating(false);
  };

  return (
    <>
      <AppTopBar
        crumbs={[{ label: t("角色库") }]}
        actions={
          <button className="btn-primary btn btn-sm" onClick={() => setCreating(true)}>
            <PlusIcon /> {t("新建角色")}
          </button>
        }
      />
      <div className="char-lib" data-screen-label="Character Library">
        <div className="char-lib-hero">
          <div>
            <div
              className="dim-2 mono"
              style={{
                fontSize: 11, letterSpacing: ".1em",
                textTransform: "uppercase", marginBottom: 8,
              }}
            >
              Character Library · {t("选角板")}
            </div>
            <h1>{t("角色库")}</h1>
            <p className="char-lib-sub">
              {t("全局资源，跨项目复用。每个角色由「名 / 参考图 / 描述 / 声线」四部分组成 —— 你在「字段 05 · 角色调用」和分镜出场角色中，直接通过此处建立的角色名进行调用。")}
            </p>
          </div>
          <div className="char-lib-stats">
            <div className="stat">
              <div className="stat-n mono">{counts.all}</div>
              <div className="stat-l">{t("总角色")}</div>
            </div>
            <div className="stat">
              <div className="stat-n mono">{counts.ref}</div>
              <div className="stat-l">{t("已绑定参考图")}</div>
            </div>
            <div className="stat">
              <div className="stat-n mono">{counts.noref}</div>
              <div className="stat-l">{t("无参考图")}</div>
            </div>
          </div>
        </div>

        <div className="char-lib-toolbar">
          <div className="segmented">
            <button className={cn(filter === "all" && "active")} onClick={() => setFilter("all")}>
              {tf("全部 · {n}", { n: counts.all })}
            </button>
            <button className={cn(filter === "ref" && "active")} onClick={() => setFilter("ref")}>
              {tf("有参考图 · {n}", { n: counts.ref })}
            </button>
            <button className={cn(filter === "noref" && "active")} onClick={() => setFilter("noref")}>
              {tf("无参考图 · {n}", { n: counts.noref })}
            </button>
          </div>
          <div className="cast-search" style={{ maxWidth: 280 }}>
            <SearchIcon />
            <input
              placeholder={t("搜索角色…")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="segmented" style={{ marginLeft: "auto" }}>
            <button className={cn(view === "gallery" && "active")} onClick={() => setView("gallery")}>
              {t("画廊")}
            </button>
            <button className={cn(view === "list" && "active")} onClick={() => setView("list")}>
              {t("列表")}
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="dim" style={{ padding: 24 }}>{t("加载中…")}</div>
        ) : view === "gallery" ? (
          <div className="char-gallery">
            {filtered.map((c) => (
              <CharacterTile
                key={c.id}
                character={c}
                onEdit={() => setEditing(c)}
                onDelete={() => onDelete(c)}
              />
            ))}
            <div className="char-tile-add" onClick={() => setCreating(true)}>
              <div className="add-glyph">+</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{t("新建角色")}</div>
              <div className="dim-2 mono" style={{ fontSize: 10, marginTop: 4 }}>
                {t("名字 / 参考图 / 描述 / 声线")}
              </div>
            </div>
          </div>
        ) : (
          <CharacterList
            characters={filtered}
            onEdit={(c) => setEditing(c)}
            onDelete={onDelete}
          />
        )}
      </div>

      {(editing || creating) && (
        <CharacterDrawer character={editing} isNew={creating} onClose={closeDrawer} />
      )}
    </>
  );
}
