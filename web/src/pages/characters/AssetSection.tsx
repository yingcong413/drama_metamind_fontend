// AssetSection.tsx —— CharacterDrawer 复用的素材上传 + 状态展示组件
// PRD-v0.7 §2.4 「保留三块布局」决议
//
// 两个变体：
//   - <SingleAssetSlot kind="image|audio" role_in_bundle="primary"> 主图 / 声线（单文件覆盖语义）
//   - <MultiAssetGrid kind="image" role_in_bundle="other">         多角度图（多文件）
//
// 共用流程：
//   1. 用户选文件 → validateAssetFile 预校验（不通过 toast 提示，不发请求）
//   2. uploadAsset → 后端返回 status=processing 的 Asset
//   3. useAssetPolling 每 3s 轮询 → status → active/failed
//   4. failed → 显示 AssetStatusBadge「重新上传」按钮，重走步骤 1

import { useRef, useState } from "react";
import { uploadAsset, deleteAsset } from "@/api/assets";
import { useAssetPolling } from "@/hooks/useAssetPolling";
import { validateAssetFile } from "@/lib/assetValidator";
import { useT, useTf } from "@/lib/i18n";
import { TrashIcon, UploadIcon, MicIcon } from "@/components/icons";
import type { Asset, AssetKind, AssetRole } from "@/types";
import { AssetStatusBadge } from "./AssetStatusBadge";

// ============ 单文件槽位（主图 / 声线） ============

interface SingleSlotProps {
  asset: Asset | null;
  kind: Extract<AssetKind, "image" | "audio">;
  role_in_bundle: AssetRole;
  characterId: string;
  onChange: () => void;
}

export function SingleAssetSlot({
  asset,
  kind,
  role_in_bundle,
  characterId,
  onChange,
}: SingleSlotProps) {
  const t = useT();
  const tf = useTf();
  const inputRef = useRef<HTMLInputElement>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [localAsset, setLocalAsset] = useState<Asset | null>(asset);

  // 轮询新上传的 processing asset；外部传入的（已 active）不重复轮询
  const polling = useAssetPolling(
    localAsset && (localAsset.status === "processing" || localAsset.status === "uploading")
      ? localAsset.id
      : null,
    {
      onActive: () => onChange(),
      onFailed: () => onChange(),
    }
  );

  // 同步外部 asset 变更（如父组件 refetch 后）
  if (asset !== localAsset && !busy && !polling.asset) {
    setLocalAsset(asset);
  }

  const current = polling.asset ?? localAsset;

  const handlePick = () => {
    setIssues([]);
    inputRef.current?.click();
  };

  const handleFile = async (file: File) => {
    setIssues([]);
    const errs = await validateAssetFile(file, kind);
    if (errs.length) {
      setIssues(errs);
      return;
    }
    setBusy(true);
    try {
      const a = await uploadAsset({
        file,
        character_id: characterId,
        kind,
        role_in_bundle,
      });
      setLocalAsset(a);
      onChange();
    } catch (e) {
      setIssues([(e as Error).message]);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!current) return;
    if (!confirm(tf("确定删除「{name}」？", { name: current.original_filename }))) return;
    await deleteAsset(current.id);
    setLocalAsset(null);
    onChange();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input
        ref={inputRef}
        type="file"
        accept={kind === "image" ? "image/*" : "audio/*"}
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      {current ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: 10,
            border: "1px solid var(--line, #E5E7EB)",
            borderRadius: 8,
          }}
        >
          {kind === "image" && current.thumbnail_url && current.status === "active" ? (
            <img
              src={current.thumbnail_url}
              alt={current.original_filename}
              style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6 }}
            />
          ) : (
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 6,
                background: "var(--surface-soft, #F3F4F6)",
                display: "grid",
                placeItems: "center",
              }}
            >
              {kind === "image" ? <UploadIcon /> : <MicIcon />}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {current.original_filename}
            </div>
            <div style={{ marginTop: 4 }}>
              <AssetStatusBadge
                status={current.status}
                error={current.processing_error}
                onReupload={current.status === "failed" ? handlePick : undefined}
              />
            </div>
          </div>
          <button
            className="btn btn-sm btn-ghost"
            onClick={handleDelete}
            title={t("删除")}
            disabled={busy}
          >
            <TrashIcon />
          </button>
        </div>
      ) : (
        <button
          className="btn"
          style={{ justifyContent: "flex-start", padding: "12px 14px", width: "100%" }}
          onClick={handlePick}
          disabled={busy}
        >
          {kind === "image" ? <UploadIcon /> : <MicIcon />}
          {busy ? ` ${t("上传中…")}` : kind === "image" ? ` ${t("上传主图")}` : ` ${t("上传声线参考")}`}
        </button>
      )}

      {issues.length > 0 && (
        <ul style={{ color: "#991B1B", fontSize: 12, paddingLeft: 18, margin: 0 }}>
          {issues.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============ 多文件网格（多角度图） ============

interface MultiGridProps {
  assets: Asset[];
  kind: Extract<AssetKind, "image">;
  characterId: string;
  onChange: () => void;
}

export function MultiAssetGrid({ assets, kind, characterId, onChange }: MultiGridProps) {
  const tf = useTf();
  const inputRef = useRef<HTMLInputElement>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [busyCount, setBusyCount] = useState(0);

  const handlePick = () => {
    setIssues([]);
    inputRef.current?.click();
  };

  const handleFiles = async (files: FileList) => {
    setIssues([]);
    setBusyCount(files.length);
    const errs: string[] = [];
    for (const file of Array.from(files)) {
      const e = await validateAssetFile(file, kind);
      if (e.length) {
        errs.push(`${file.name}: ${e.join("、")}`);
        setBusyCount((c) => c - 1);
        continue;
      }
      try {
        await uploadAsset({
          file,
          character_id: characterId,
          kind,
          role_in_bundle: "other", // 多图默认 other；用户可在卡片上手动设主图
        });
      } catch (err) {
        errs.push(`${file.name}: ${(err as Error).message}`);
      } finally {
        setBusyCount((c) => c - 1);
      }
    }
    if (errs.length) setIssues(errs);
    onChange();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(tf("确定删除「{name}」？", { name }))) return;
    await deleteAsset(id);
    onChange();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
          gap: 10,
        }}
      >
        {assets.map((a) => (
          <MultiThumb key={a.id} asset={a} onChange={onChange} onDelete={() => handleDelete(a.id, a.original_filename)} />
        ))}

        <button
          className="upload"
          style={{ minHeight: 120, cursor: busyCount > 0 ? "wait" : "pointer" }}
          onClick={handlePick}
          disabled={busyCount > 0}
        >
          <div className="upload-icon">
            <UploadIcon />
          </div>
          <div style={{ fontSize: 12 }}>
            {busyCount > 0 ? tf("上传 {n} 个中…", { n: busyCount }) : tf("添加更多角度", {})}
          </div>
        </button>
      </div>

      {issues.length > 0 && (
        <ul style={{ color: "#991B1B", fontSize: 12, paddingLeft: 18, margin: 0 }}>
          {issues.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// 单张多图卡片，内部跑 polling
function MultiThumb({
  asset,
  onChange,
  onDelete,
}: {
  asset: Asset;
  onChange: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const polling = useAssetPolling(
    asset.status === "processing" || asset.status === "uploading" ? asset.id : null,
    { onActive: onChange, onFailed: onChange }
  );
  const current = polling.asset ?? asset;

  return (
    <div
      style={{
        position: "relative",
        aspectRatio: "3/4",
        borderRadius: 6,
        overflow: "hidden",
        background: "var(--surface-soft, #F3F4F6)",
      }}
    >
      {current.thumbnail_url && current.status === "active" ? (
        <img
          src={current.thumbnail_url}
          alt={current.original_filename}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <div style={{ display: "grid", placeItems: "center", height: "100%", padding: 8, fontSize: 11, color: "#6B7280", textAlign: "center" }}>
          {current.original_filename}
        </div>
      )}
      <div style={{ position: "absolute", left: 4, bottom: 4 }}>
        <AssetStatusBadge status={current.status} error={current.processing_error} compact />
      </div>
      <button
        className="btn btn-sm btn-ghost"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title={t("删除")}
        style={{ position: "absolute", right: 2, top: 2, padding: 4, background: "rgba(255,255,255,0.85)", borderRadius: 4 }}
      >
        <TrashIcon />
      </button>
    </div>
  );
}
