import { useEffect, useMemo, useRef, useState } from "react";
import { CloseIcon, CopyIcon, SparkleIcon } from "@/components/icons";
import {
  buildSeedancePayload,
  extractUsage,
  extractVideoUrl,
  getSeedanceTask,
  isTerminal,
  normalizeProgress,
  submitSeedance,
  type SeedanceRequest,
  type SeedanceTaskInfo,
} from "@/api/seedance";
import { createTask, patchTask } from "@/api/tasks";
import { buildPromptText } from "@/lib/naturalLanguage";
import { buildPromptSnapshot } from "@/lib/promptSnapshot";
import { saveGenerationResult } from "@/lib/generationResult";
import type { Character, Project } from "@/types";

type PreviewTab = "json" | "prompt";

interface Props {
  project: Project;
  characters: Character[];
  onClose: () => void;
  onConfirm: () => void;
}

type Phase = "preview" | "submitting" | "polling" | "success" | "failed";

export function GenerateRequestModal({ project, characters, onClose, onConfirm }: Props) {
  const payload: SeedanceRequest = useMemo(
    () => buildSeedancePayload(project, characters),
    [project, characters],
  );
  const payloadJson = useMemo(() => JSON.stringify(payload, null, 2), [payload]);
  // 与保存弹窗共用一份 prompt 文本(buildPromptText),保证两边一致
  const promptText = useMemo(
    () => buildPromptText(project, characters),
    [project, characters],
  );

  const [previewTab, setPreviewTab] = useState<PreviewTab>("json");
  const [phase, setPhase] = useState<Phase>("preview");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [info, setInfo] = useState<SeedanceTaskInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<number | null>(null);
  // PRD §10 P5:本地 task_id(我方 DB),与上游 task_id 区分
  const localTaskIdRef = useRef<string | null>(null);
  // 每秒滴答一次,用于显示"已等待 N 秒"
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (phase !== "polling" && phase !== "submitting") return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);
  const elapsedSec = submittedAt ? Math.floor((Date.now() - submittedAt) / 1000) : 0;
  void tick; // 引用 tick 让 elapsedSec 每秒触发重渲
  const pollRef = useRef<number | null>(null);

  // 退出时清理轮询
  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const startSubmit = async () => {
    setPhase("submitting");
    setError(null);
    setSubmittedAt(Date.now());

    /* eslint-disable no-console */
    console.group("[Generate] 提交视频生成任务");
    console.info("Endpoint :", getEndpointHint() + "/video/generations");
    console.info("Model    :", payload.model);
    console.info("Prompt 字数:", promptText.length);
    console.info("Payload  :", payload);
    /* eslint-enable no-console */

    // PRD §10 P5:同时做两件事 ——
    // 1) 把任务入我方 DB(POST /tasks),拿到我方 task_id;失败也要落库
    // 2) 提交到上游 Seedance,拿 upstream task_id
    // 顺序:先入库(快,毫秒级)→ 再提交上游(可能慢/失败)
    const snapshot = buildPromptSnapshot(project, characters);
    let localTaskId: string | null = null;
    try {
      const created = await createTask({
        project_id: project.id,
        type_id: "i2v",                          // Seedance 2.0 当前只走图生视频
        platform: "Seedance",
        upstream_model: payload.model,
        channel_id: 0,
        video_len_seconds: payload.duration,
        resolution: payload.resolution,
        prompt: snapshot,
      });
      localTaskId = created.id;
      localTaskIdRef.current = localTaskId;
      console.info("[Tasks] 本地任务入库 OK, local task_id =", localTaskId);
    } catch (e) {
      // v0.9.5 §10.8.3:余额不足(402)→ 不提交上游,直接报错引导充值
      const status = (e as { status?: number })?.status;
      if (status === 402) {
        const msg = e instanceof Error && e.message ? e.message : "积分不足，请先充值后再生成";
        console.warn("[Tasks] 余额不足,已拦截提交:", msg);
        console.groupEnd();
        setError(msg);
        setErrorCode("insufficient_balance");
        setPhase("failed");
        return;
      }
      // 其它入库失败不影响视频生成本身,但要记 warn(运维排查)
      console.warn("[Tasks] createTask 失败,继续提交上游:", e);
    }

    try {
      console.info("[Seedance] POST /video/generations 开始...");
      const { task_id: upstreamTaskId } = await submitSeedance(payload);
      console.info("[Seedance] 提交成功, upstream task_id =", upstreamTaskId);
      console.groupEnd();
      setTaskId(upstreamTaskId);
      // 入库后立刻把 upstream_task_id + 状态改成 running
      if (localTaskId) {
        patchTask(localTaskId, {
          upstream_task_id: upstreamTaskId,
          status: "running",
        }).catch((e) => console.warn("[Tasks] patch running 失败:", e));
      }
      setPhase("polling");
      // 启动轮询
      pollRef.current = window.setInterval(async () => {
        try {
          const next = await getSeedanceTask(upstreamTaskId);
          setInfo(next);
          // 上游进度同步到我方 DB(节流:每次轮询都打一次,可接受)
          const localProgress = normalizeProgress(next.progress);
          if (localTaskId) {
            patchTask(localTaskId, { progress: localProgress }).catch(() => { /* 静默 */ });
          }
          const term = isTerminal(next.status);
          if (term === "success") {
            const url = extractVideoUrl(next);
            setVideoUrl(url);
            setPhase("success");
            // 把 video_url 写 localStorage,ResultPage 加载时读出来播放
            if (url) {
              saveGenerationResult(project.id, { task_id: upstreamTaskId, video_url: url, resolution: payload.resolution });
            }
            // 终态回填到我方 DB
            // v0.9.1 §10.8.2:把 new-api 返回的 token 用量带上,后端按 ¥2/M+¥28/M 算 cost_cents
            const usage = extractUsage(next);
            if (localTaskId) {
              patchTask(localTaskId, {
                status: "success",
                progress: 100,
                output_video_url: url,
                end_time: new Date().toISOString(),
                input_tokens: usage?.prompt_tokens,
                output_tokens: usage?.completion_tokens,
              }).catch((e) => console.warn("[Tasks] patch success 失败:", e));
            }
            if (pollRef.current) {
              window.clearInterval(pollRef.current);
              pollRef.current = null;
            }
          } else if (term === "failed") {
            const reason = next.fail_reason || next.error?.message || "生成失败";
            setError(reason);
            setErrorCode(next.error?.code ?? null);
            setPhase("failed");
            if (localTaskId) {
              patchTask(localTaskId, {
                status: "failed",
                fail_reason: reason,
                end_time: new Date().toISOString(),
              }).catch((e) => console.warn("[Tasks] patch failed 失败:", e));
            }
            if (pollRef.current) {
              window.clearInterval(pollRef.current);
              pollRef.current = null;
            }
          }
        } catch (e) {
          // 轮询错误不致命,继续下一次
          console.warn("[Seedance poll]", e);
        }
      }, 4000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[Seedance] 提交失败:", msg);
      console.groupEnd();
      setError(msg);
      setPhase("failed");
      // 提交上游失败也要写回 DB,留底排查
      if (localTaskId) {
        patchTask(localTaskId, {
          status: "failed",
          fail_reason: msg,
          end_time: new Date().toISOString(),
        }).catch((err) => console.warn("[Tasks] patch submit-failed 失败:", err));
      }
    }
  };

  const handleClose = () => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    onClose();
  };

  const progress = normalizeProgress(info?.progress);

  const isPreview = phase === "preview";

  return (
    <div
      onClick={handleClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,.55)",
        display: "grid", placeItems: "center",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(900px, 94vw)", height: "min(720px, 88vh)",
          display: "flex", flexDirection: "column",
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
          boxShadow: "0 20px 60px rgba(0,0,0,.5)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 18px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              {isPreview ? "生成视频 · 请求预览" : "生成视频 · 任务状态"}
            </div>
            <div className="dim" style={{ fontSize: 12, marginTop: 2 }}>
              {isPreview
                ? `POST ${getEndpointHint()}/video/generations · ${payloadJson.length} 字符`
                : taskId
                  ? `task_id: ${taskId}`
                  : "提交中…"}
            </div>
          </div>
          <button className="btn-ghost btn-icon" onClick={handleClose} title="关闭">
            <CloseIcon />
          </button>
        </div>

        {/* 顶部 banner:对测试者解释共用 demo 账号 + 多人排队 */}
        <div
          style={{
            padding: "8px 18px",
            background: "rgba(106,160,255,.08)",
            borderBottom: "1px solid rgba(106,160,255,.25)",
            fontSize: 11,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
          }}
        >
          测试期所有人共用 Demo 账号,生成会进上游 GPU 队列,通常 <strong style={{ color: "var(--text)" }}>1–3 分钟</strong>。
          多人同时使用会更久;实际生成时长可能因模型能力略低于设定值。
        </div>

        <div style={{ flex: 1, padding: 18, overflow: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {isPreview ? (
            <>
              <div
                style={{
                  display: "inline-flex", gap: 4, padding: 3,
                  background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6,
                  alignSelf: "flex-start",
                }}
              >
                <TabBtn active={previewTab === "json"} onClick={() => setPreviewTab("json")}>
                  完整 JSON
                </TabBtn>
                <TabBtn active={previewTab === "prompt"} onClick={() => setPreviewTab("prompt")}>
                  Prompt 文本 · {promptText.length} 字
                </TabBtn>
              </div>
              <textarea
                id="generate-request-textarea"
                readOnly
                value={previewTab === "json" ? payloadJson : promptText}
                spellCheck={false}
                style={{
                  flex: 1,
                  resize: "none",
                  padding: 14,
                  fontSize: 12.5,
                  lineHeight: 1.6,
                  fontFamily: "var(--font-mono), monospace",
                  background: "var(--surface-2)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  outline: "none",
                  whiteSpace: previewTab === "json" ? "pre" : "pre-wrap",
                  tabSize: 2,
                }}
              />
              <div className="dim-2 mono" style={{ fontSize: 11 }}>
                Prompt 文本与「保存」弹窗共用同一份 <code>buildPromptText()</code>,两边永远一致。
              </div>
            </>
          ) : (
            <>
              <StatusPanel
                phase={phase}
                status={info?.status}
                progress={progress}
                error={error}
                errorCode={errorCode}
                elapsedSec={elapsedSec}
              />
              {videoUrl && (
                <div
                  style={{
                    padding: 12,
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>视频已生成 ✓</div>
                  <div
                    style={{ fontFamily: "var(--font-mono)", fontSize: 12, wordBreak: "break-all" }}
                  >
                    <a href={videoUrl} target="_blank" rel="noopener noreferrer">{videoUrl}</a>
                  </div>
                  <video
                    src={videoUrl}
                    controls
                    style={{ width: "100%", marginTop: 10, borderRadius: 6, background: "#000" }}
                  />
                </div>
              )}
              {/* 本次提交内容(确认生成后仍能回看,排查上游问题用) */}
              <SubmittedRequestPanel
                endpoint={getEndpointHint() + "/video/generations"}
                payloadJson={payloadJson}
                promptText={promptText}
                localTaskId={localTaskIdRef.current}
                upstreamTaskId={taskId}
                submittedAt={submittedAt}
                copyToClipboard={copy}
                copied={copied}
              />

              <details>
                <summary className="dim" style={{ cursor: "pointer", fontSize: 12 }}>
                  原始响应 / 调试信息
                </summary>
                <pre
                  style={{
                    marginTop: 8,
                    padding: 12,
                    fontSize: 11.5,
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    maxHeight: 240,
                    overflow: "auto",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {JSON.stringify(info ?? { error }, null, 2)}
                </pre>
              </details>
            </>
          )}
        </div>

        <div
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
            padding: "12px 18px",
            borderTop: "1px solid var(--border)",
          }}
        >
          <div className="dim-2 mono" style={{ fontSize: 11 }}>
            {isPreview
              ? "校验通过后点「确认生成」走真实接口"
              : phase === "polling"
                ? "正在轮询任务状态(每 4s)"
                : phase === "submitting"
                  ? "提交中…"
                  : phase === "success"
                    ? "完成"
                    : "失败"}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {isPreview && (
              <button
                className="btn btn-sm"
                onClick={() => copy(previewTab === "json" ? payloadJson : promptText)}
              >
                <CopyIcon />{" "}
                {copied
                  ? "已复制"
                  : previewTab === "json"
                    ? "复制 JSON"
                    : "复制 Prompt"}
              </button>
            )}
            {(phase === "success" && videoUrl) && (
              <button className="btn btn-sm" onClick={() => copy(videoUrl)}>
                <CopyIcon /> {copied ? "已复制" : "复制视频 URL"}
              </button>
            )}
            <button className="btn btn-sm" onClick={handleClose}>
              {phase === "success" || phase === "failed" ? "关闭" : "取消"}
            </button>
            {isPreview && (
              <button className="btn-primary btn btn-sm" onClick={startSubmit}>
                <SparkleIcon /> 确认生成
              </button>
            )}
            {phase === "success" && (
              <button
                className="btn-primary btn btn-sm"
                onClick={() => {
                  onConfirm();
                  handleClose();
                }}
              >
                查看结果页
              </button>
            )}
            {phase === "failed" && (
              <button className="btn-primary btn btn-sm" onClick={startSubmit}>
                重试
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TabBtn({
  active, onClick, children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 10px",
        fontSize: 12,
        border: "none",
        borderRadius: 4,
        background: active ? "var(--surface)" : "transparent",
        color: active ? "var(--text)" : "var(--text-secondary, #9aa)",
        cursor: "pointer",
        fontWeight: active ? 600 : 400,
      }}
    >
      {children}
    </button>
  );
}

/**
 * 「本次提交」可展开面板 —— PRD §10 用户反馈:
 * 用户在 submitting / polling / success / failed 任一阶段都能回看「我刚才发了什么」,
 * 含 endpoint URL、本地 task_id、上游 task_id、提交时刻、完整 JSON、Prompt 文本。
 *
 * 提交时刻 + endpoint 是排查「请求到底有没有发出去」的关键信息。
 */
function SubmittedRequestPanel({
  endpoint,
  payloadJson,
  promptText,
  localTaskId,
  upstreamTaskId,
  submittedAt,
  copyToClipboard,
  copied,
}: {
  endpoint: string;
  payloadJson: string;
  promptText: string;
  localTaskId: string | null;
  upstreamTaskId: string | null;
  submittedAt: number | null;
  copyToClipboard: (text: string) => void;
  copied: boolean;
}) {
  const [bodyTab, setBodyTab] = useState<"json" | "prompt">("json");
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {/* 头部:始终可见,显示关键信息 + 展开按钮 */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          padding: "10px 12px",
          background: "transparent",
          border: "none",
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 500 }}>本次提交</span>
        <span
          className="dim-2 mono"
          style={{ fontSize: 11, flex: 1 }}
        >
          {endpoint} · {payloadJson.length} 字符
        </span>
        <span className="dim-2" style={{ fontSize: 11 }}>
          {open ? "▾ 收起" : "▸ 展开"}
        </span>
      </button>

      {open && (
        <div
          style={{
            padding: 12,
            borderTop: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {/* 元信息 4 列 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: "4px 12px",
              fontSize: 11.5,
              fontFamily: "var(--font-mono)",
            }}
          >
            <span className="dim-2">Endpoint</span>
            <span style={{ wordBreak: "break-all" }}>{endpoint}</span>
            <span className="dim-2">本地 task_id</span>
            <span>{localTaskId || <em className="dim-2">(后端未登记)</em>}</span>
            <span className="dim-2">上游 task_id</span>
            <span>{upstreamTaskId || <em className="dim-2">(尚未提交)</em>}</span>
            <span className="dim-2">提交时间</span>
            <span>
              {submittedAt
                ? new Date(submittedAt).toLocaleString()
                : <em className="dim-2">—</em>}
            </span>
          </div>

          {/* JSON / Prompt Tab 切换 */}
          <div
            style={{
              display: "inline-flex",
              gap: 4,
              padding: 3,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              alignSelf: "flex-start",
            }}
          >
            <button
              onClick={() => setBodyTab("json")}
              style={{
                padding: "3px 10px",
                fontSize: 11.5,
                border: "none",
                borderRadius: 4,
                background: bodyTab === "json" ? "var(--surface-2)" : "transparent",
                color: bodyTab === "json" ? "var(--text)" : "var(--text-secondary)",
                cursor: "pointer",
                fontWeight: bodyTab === "json" ? 600 : 400,
              }}
            >
              JSON
            </button>
            <button
              onClick={() => setBodyTab("prompt")}
              style={{
                padding: "3px 10px",
                fontSize: 11.5,
                border: "none",
                borderRadius: 4,
                background: bodyTab === "prompt" ? "var(--surface-2)" : "transparent",
                color: bodyTab === "prompt" ? "var(--text)" : "var(--text-secondary)",
                cursor: "pointer",
                fontWeight: bodyTab === "prompt" ? 600 : 400,
              }}
            >
              Prompt · {promptText.length} 字
            </button>
            <button
              onClick={() => copyToClipboard(bodyTab === "json" ? payloadJson : promptText)}
              style={{
                padding: "3px 10px",
                fontSize: 11.5,
                border: "none",
                borderRadius: 4,
                background: "transparent",
                color: "var(--text-secondary)",
                cursor: "pointer",
                marginLeft: 4,
              }}
              title={`复制 ${bodyTab === "json" ? "JSON" : "Prompt"}`}
            >
              {copied ? "✓ 已复制" : "复制"}
            </button>
          </div>

          <pre
            style={{
              margin: 0,
              padding: 10,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontSize: 11,
              lineHeight: 1.5,
              fontFamily: "var(--font-mono), monospace",
              color: "var(--text)",
              maxHeight: 260,
              overflow: "auto",
              whiteSpace: bodyTab === "json" ? "pre" : "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {bodyTab === "json" ? payloadJson : promptText}
          </pre>
        </div>
      )}
    </div>
  );
}

/** 把 Volcano 英文 status 翻译成中文,提升测试者可读性 */
function translateStatus(s: string | undefined): string {
  const k = (s ?? "").toUpperCase();
  switch (k) {
    case "PENDING":      return "排队中(等待 GPU)";
    case "QUEUED":       return "排队中(等待 GPU)";
    case "IN_PROGRESS":  return "生成中";
    case "RUNNING":      return "生成中";
    case "SUCCESS":
    case "SUCCEEDED":    return "完成";
    case "FAILED":
    case "FAILURE":      return "失败";
    case "":             return "排队中";
    default:             return s ?? "排队中";
  }
}

function StatusPanel({
  phase,
  status,
  progress,
  error,
  errorCode,
  elapsedSec = 0,
}: {
  phase: Phase;
  status?: string;
  progress: number;
  error: string | null;
  errorCode?: string | null;
  elapsedSec?: number;
}) {
  const label =
    phase === "submitting"
      ? "正在提交任务给生成服务…"
      : phase === "polling"
        ? translateStatus(status)
        : phase === "success"
          ? "生成成功"
          : phase === "failed"
            ? "失败"
            : "";
  const ok = phase === "success";
  const bad = phase === "failed";
  return (
    <div>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 10,
          fontSize: 14, marginBottom: 8,
        }}
      >
        <span
          style={{
            width: 8, height: 8, borderRadius: "50%",
            background: ok ? "#3dd76a" : bad ? "#ff5d5d" : "var(--accent, #6aa0ff)",
            animation: ok || bad ? "none" : "pulse 1.2s infinite",
          }}
        />
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span className="dim-2 mono" style={{ fontSize: 12 }}>{progress}%</span>
      </div>
      <div
        style={{
          height: 6, borderRadius: 999,
          background: "var(--surface-2)", overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%", width: `${progress}%`,
            background: ok ? "#3dd76a" : bad ? "#ff5d5d" : "var(--accent, #6aa0ff)",
            transition: "width .3s ease",
          }}
        />
      </div>

      {/* 进行中:显示已等待 + 长等待友好提示 */}
      {(phase === "submitting" || phase === "polling") && elapsedSec > 0 && (
        <div className="dim-2" style={{ fontSize: 11, marginTop: 8, lineHeight: 1.6 }}>
          已等待 <span className="mono" style={{ color: "var(--text)" }}>{formatElapsed(elapsedSec)}</span>
          {progress === 0 && elapsedSec > 10 && (
            <span>
              {" · "}
              {phase === "submitting"
                ? "如果一直停在这里超过 60 秒,可能是上游繁忙或多人同时使用,我们会自动超时并提示"
                : "上游 GPU 排队中,通常需要 1-3 分钟。多人同时使用会更久"}
            </span>
          )}
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: 10, padding: 10,
            background: "rgba(255,93,93,.12)",
            border: "1px solid rgba(255,93,93,.4)",
            borderRadius: 6,
            color: "#ff8a8a",
            fontSize: 13,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {errorCode && (
            <div className="mono" style={{ fontSize: 11, opacity: 0.85, marginBottom: 4 }}>
              错误码:{errorCode}
            </div>
          )}
          {error}
        </div>
      )}
    </div>
  );
}

function getEndpointHint(): string {
  const base =
    (import.meta.env.VITE_SEEDANCE_BASE_URL as string | undefined) ||
    "/seedance-proxy/v1";
  return base;
}

function formatElapsed(sec: number): string {
  if (sec < 60) return `${sec} 秒`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m} 分 ${String(s).padStart(2, "0")} 秒`;
}
