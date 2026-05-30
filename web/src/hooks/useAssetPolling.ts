// useAssetPolling.ts —— 轮询 GET /assets/:id 直到 status 进入终态
// PRD-v0.5 §2.1.4.4：3s 间隔，120s 超时，与 upload_virtual_avatar.py 的 POLL_INTERVAL/POLL_TIMEOUT 一致
//
// 用法（CharacterDrawer 内）：
//   const { asset, status, error } = useAssetPolling(assetId, {
//     enabled: asset.status === "processing" || asset.status === "uploading",
//     onActive: (a) => toast.success(`${a.original_filename} 已就绪`),
//     onFailed: (a) => toast.error(`${a.original_filename} 失败：${a.processing_error}`),
//   });

import { useEffect, useRef, useState } from "react";
import { getAsset } from "@/api/assets";
import type { Asset, AssetStatus } from "@/types";

const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 120_000;

const TERMINAL_STATES: ReadonlySet<AssetStatus> = new Set(["active", "failed", "rejected"]);

export type PollingPhase = "idle" | "polling" | "settled" | "timeout";

export interface UseAssetPollingOptions {
  /** 关闭时 hook 立即停止轮询；默认 true */
  enabled?: boolean;
  /** 轮询间隔（ms），默认 3000 */
  intervalMs?: number;
  /** 总超时（ms），默认 120000 */
  timeoutMs?: number;
  onActive?: (asset: Asset) => void;
  onFailed?: (asset: Asset) => void;
}

export interface UseAssetPollingResult {
  asset: Asset | null;
  phase: PollingPhase;
  error: string | null;
}

export function useAssetPolling(
  assetId: string | null,
  opts: UseAssetPollingOptions = {}
): UseAssetPollingResult {
  const {
    enabled = true,
    intervalMs = POLL_INTERVAL_MS,
    timeoutMs = POLL_TIMEOUT_MS,
    onActive,
    onFailed,
  } = opts;

  const [asset, setAsset] = useState<Asset | null>(null);
  const [phase, setPhase] = useState<PollingPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  // 用 ref 装回调，避免每次 render 都重新订阅
  const onActiveRef = useRef(onActive);
  const onFailedRef = useRef(onFailed);
  useEffect(() => {
    onActiveRef.current = onActive;
    onFailedRef.current = onFailed;
  }, [onActive, onFailed]);

  useEffect(() => {
    if (!assetId || !enabled) {
      setPhase("idle");
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const startedAt = Date.now();
    setPhase("polling");
    setError(null);

    async function tick() {
      try {
        const a = await getAsset(assetId!);
        if (cancelled) return;
        setAsset(a);
        if (TERMINAL_STATES.has(a.status)) {
          setPhase("settled");
          if (a.status === "active") onActiveRef.current?.(a);
          else if (a.status === "failed") onFailedRef.current?.(a);
          return;
        }
        if (Date.now() - startedAt > timeoutMs) {
          setPhase("timeout");
          setError(`轮询超时 ${timeoutMs / 1000}s，请稍后刷新`);
          return;
        }
        timer = setTimeout(tick, intervalMs);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message);
        // 网络错误不立刻退出，继续轮询直到超时
        if (Date.now() - startedAt > timeoutMs) {
          setPhase("timeout");
          return;
        }
        timer = setTimeout(tick, intervalMs);
      }
    }

    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [assetId, enabled, intervalMs, timeoutMs]);

  return { asset, phase, error };
}
