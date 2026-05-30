// AdminRechargePage.tsx —— PRD §10.8.5 平台管理员手动充值
//
// 仅 user.is_platform_admin === true 可见。
// 极简表单:① 搜目标 org ② 填金额(可负为冲正)+ 赠送 ③ 必填备注 ④ 二次确认弹窗
// 下方表格显示最近 50 笔充值流水。

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { useIsPlatformAdmin } from "@/stores/auth";
import {
  createAdminRecharge,
  listAdminRecharges,
  searchOrgs,
  type AdminRechargeRecord,
  type OrgSearchItem,
} from "@/api/admin";
import { formatYuan } from "@/lib/format";

export function AdminRechargePage() {
  const isAdmin = useIsPlatformAdmin();
  if (!isAdmin) {
    // 非 admin 直接踢回 dashboard
    return <Navigate to="/dashboard" replace />;
  }
  return <RechargeBody />;
}

function RechargeBody() {
  const qc = useQueryClient();

  // ── 搜组织 ──
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<OrgSearchItem | null>(null);
  const searchQuery = useQuery({
    queryKey: ["admin-search-orgs", q],
    queryFn: () => searchOrgs(q),
    enabled: q.trim().length >= 1 && !selected,
    staleTime: 1000,
  });

  // ── 表单 ──
  const [amountYuan, setAmountYuan] = useState("");          // 元,可负
  const [bonusYuan, setBonusYuan] = useState("");            // 元,≥0
  const [note, setNote] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const amountCents = useMemo(() => {
    const n = parseFloat(amountYuan);
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }, [amountYuan]);
  const bonusCents = useMemo(() => {
    const n = parseFloat(bonusYuan);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
  }, [bonusYuan]);

  const canSubmit =
    !!selected &&
    amountCents !== 0 &&
    Math.abs(amountCents) <= 100_000_000 &&
    (amountCents > 0 || bonusCents === 0) &&     // 冲正不允许带赠送
    note.trim().length >= 2 &&
    note.trim().length <= 200;

  // ── 提交充值 ──
  const recharge = useMutation({
    mutationFn: () =>
      createAdminRecharge({
        org_id: selected!.id,
        amount_cents: amountCents,
        bonus_cents: bonusCents,
        method: amountCents < 0 ? "refund" : "admin_manual",
        note: note.trim(),
      }),
    onSuccess: (r) => {
      alert(
        `✓ 已${r.recharge.amount_cents < 0 ? "冲正" : "充值"} ¥${formatYuan(Math.abs(r.recharge.amount_cents))}\n` +
        `${r.recharge.bonus_cents > 0 ? `(含赠送 ¥${formatYuan(r.recharge.bonus_cents)})\n` : ""}` +
        `${selected!.name} 当前余额:¥${formatYuan(r.account.balance_cents)}`,
      );
      // 清空表单 + 刷新流水 + 刷新搜索(余额变了)
      setSelected(null);
      setQ("");
      setAmountYuan("");
      setBonusYuan("");
      setNote("");
      setShowConfirm(false);
      qc.invalidateQueries({ queryKey: ["admin-recharges"] });
    },
    onError: (e) => {
      alert(`充值失败:${e instanceof Error ? e.message : String(e)}`);
    },
  });

  // ── 流水表格 ──
  const recordsQuery = useQuery({
    queryKey: ["admin-recharges"],
    queryFn: () => listAdminRecharges(1, 50),
  });

  return (
    <>
      <AppTopBar crumbs={[{ label: "平台管理" }, { label: "手动充值" }]} />
      <div className="char-lib" style={{ maxWidth: 960 }}>
        <h1>手动充值 — 平台管理员</h1>
        <p className="char-lib-sub" style={{ marginBottom: 24 }}>
          B2B 客户线下打款后,在这里把金额加到对应 org 的余额。**所有操作有完整流水**,审计可追溯。
          负金额=冲正(撤销错单)。
        </p>

        <section
          style={{
            padding: 20,
            border: "1px solid var(--border)",
            borderRadius: 12,
            background: "var(--surface)",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* 1. 目标组织搜索 */}
          <Field title="目标组织" required>
            {selected ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: 12,
                  background: "var(--surface-2)",
                  border: "1px solid var(--accent, #6aa0ff)",
                  borderRadius: 8,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{selected.name}</div>
                  <div className="dim-2" style={{ fontSize: 12 }}>
                    {selected.account_type === "enterprise" ? "企业账户" : "个人账户"} ·
                    Owner: {selected.owner_name} ({selected.owner_phone_masked || "无手机号"}) ·
                    当前余额: <strong style={{ color: "var(--accent)" }}>¥{formatYuan(selected.balance_cents)}</strong>
                  </div>
                </div>
                <button className="btn btn-sm" onClick={() => setSelected(null)}>
                  换一个
                </button>
              </div>
            ) : (
              <>
                <input
                  className="input input-lg"
                  placeholder="搜公司名 / org_id / Owner 手机号..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  autoFocus
                />
                {q.trim() && searchQuery.data && (
                  <div
                    style={{
                      marginTop: 6,
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      maxHeight: 280,
                      overflow: "auto",
                      background: "var(--surface-2)",
                    }}
                  >
                    {searchQuery.data.list.length === 0 ? (
                      <div className="dim" style={{ padding: 12, fontSize: 13 }}>无匹配组织</div>
                    ) : (
                      searchQuery.data.list.map((o) => (
                        <button
                          key={o.id}
                          onClick={() => setSelected(o)}
                          style={{
                            display: "block",
                            width: "100%",
                            padding: 12,
                            background: "transparent",
                            border: "none",
                            borderTop: "1px solid var(--border)",
                            textAlign: "left",
                            cursor: "pointer",
                            fontSize: 13,
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.background = "var(--surface)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background = "transparent";
                          }}
                        >
                          <div style={{ fontWeight: 500 }}>{o.name}</div>
                          <div className="dim-2" style={{ fontSize: 11, marginTop: 2 }}>
                            {o.account_type === "enterprise" ? "企业" : "个人"} ·
                            Owner {o.owner_name} {o.owner_phone_masked} ·
                            余额 ¥{formatYuan(o.balance_cents)}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </Field>

          {/* 2. 金额 / 赠送 */}
          <div style={{ display: "flex", gap: 16 }}>
            <Field title="金额 (元)" required hint="可负为冲正">
              <input
                className="input input-lg"
                type="number"
                step="0.01"
                placeholder="10000.00"
                value={amountYuan}
                onChange={(e) => setAmountYuan(e.target.value)}
              />
            </Field>
            <Field title="赠送 (元)" hint="冲正不能带赠送">
              <input
                className="input input-lg"
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                value={bonusYuan}
                onChange={(e) => setBonusYuan(e.target.value)}
                disabled={amountCents < 0}
              />
            </Field>
          </div>

          {/* 3. 备注 */}
          <Field title="备注" required hint="对账依据,2-200 字">
            <textarea
              className="textarea textarea-lg"
              rows={2}
              placeholder="对公打款 2026-05-26 工行 ¥10000"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
            />
          </Field>

          {/* 4. 提交 */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              className="btn"
              onClick={() => {
                setSelected(null);
                setQ("");
                setAmountYuan("");
                setBonusYuan("");
                setNote("");
              }}
            >
              取消
            </button>
            <button
              className="btn btn-primary"
              disabled={!canSubmit || recharge.isPending}
              onClick={() => setShowConfirm(true)}
            >
              {recharge.isPending ? "充值中…" : "确认充值"}
            </button>
          </div>

          {!canSubmit && (selected || amountYuan || note) && (
            <div className="dim-2" style={{ fontSize: 11, marginTop: -8 }}>
              {!selected && "请先选目标组织;"}
              {amountCents === 0 && "金额不能为 0;"}
              {Math.abs(amountCents) > 100_000_000 && "金额超过单笔上限 ¥1,000,000;"}
              {amountCents < 0 && bonusCents !== 0 && "冲正不能带赠送;"}
              {(note.trim().length < 2 || note.trim().length > 200) && "备注必填(2-200 字)"}
            </div>
          )}
        </section>

        {/* 5. 流水 */}
        <h2 style={{ marginTop: 32, fontSize: 18 }}>最近 50 笔充值流水</h2>
        <RechargeTable rows={recordsQuery.data?.list ?? []} loading={recordsQuery.isLoading} />
      </div>

      {/* 二次确认 */}
      {showConfirm && selected && (
        <ConfirmDialog
          org={selected}
          amountCents={amountCents}
          bonusCents={bonusCents}
          note={note.trim()}
          pending={recharge.isPending}
          onCancel={() => setShowConfirm(false)}
          onConfirm={() => recharge.mutate()}
        />
      )}
    </>
  );
}

function Field({
  title,
  required,
  hint,
  children,
}: {
  title: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{title}</span>
        {required && <span style={{ color: "oklch(72% .15 25)", fontSize: 12 }}>*</span>}
        {hint && (
          <span className="dim-2" style={{ fontSize: 11 }}>
            ({hint})
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function RechargeTable({ rows, loading }: { rows: AdminRechargeRecord[]; loading: boolean }) {
  if (loading) {
    return <div className="dim" style={{ padding: 24 }}>加载中…</div>;
  }
  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          background: "var(--surface-2)",
          borderRadius: 8,
          color: "var(--text-tertiary)",
          fontSize: 13,
          textAlign: "center",
        }}
      >
        还没有充值流水
      </div>
    );
  }
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr
          style={{
            background: "var(--surface-2)",
            color: "var(--text-secondary)",
            fontSize: 11,
            letterSpacing: ".05em",
            textTransform: "uppercase",
          }}
        >
          <th style={{ padding: 10, textAlign: "left" }}>时间</th>
          <th style={{ padding: 10, textAlign: "left" }}>组织</th>
          <th style={{ padding: 10, textAlign: "right" }}>金额</th>
          <th style={{ padding: 10, textAlign: "right" }}>赠送</th>
          <th style={{ padding: 10, textAlign: "left" }}>方式</th>
          <th style={{ padding: 10, textAlign: "left" }}>操作人</th>
          <th style={{ padding: 10, textAlign: "left" }}>备注</th>
          <th style={{ padding: 10, textAlign: "left" }}>状态</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
            <td style={{ padding: 10 }} className="mono dim-2">
              {new Date(r.time).toLocaleString()}
            </td>
            <td style={{ padding: 10 }}>{r.org_name}</td>
            <td
              style={{
                padding: 10,
                textAlign: "right",
                color: r.amount_cents < 0 ? "oklch(72% .15 25)" : "var(--text)",
              }}
              className="mono"
            >
              {r.amount_cents < 0 ? "−" : "+"} ¥{formatYuan(Math.abs(r.amount_cents))}
            </td>
            <td style={{ padding: 10, textAlign: "right" }} className="mono dim-2">
              {r.bonus_cents > 0 ? `+ ¥${formatYuan(r.bonus_cents)}` : "—"}
            </td>
            <td style={{ padding: 10 }} className="dim-2">{r.method}</td>
            <td style={{ padding: 10 }}>{r.operator_name}</td>
            <td
              style={{
                padding: 10,
                maxWidth: 200,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              className="dim-2"
              title={r.note ?? ""}
            >
              {r.note ?? "—"}
            </td>
            <td style={{ padding: 10 }}>
              {r.status === "success" ? (
                <span style={{ color: "oklch(70% .15 145)" }}>✓ 成功</span>
              ) : r.status === "refunded" ? (
                <span style={{ color: "oklch(72% .15 25)" }}>↩ 冲正</span>
              ) : (
                <span className="dim-2">⋯ {r.status}</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ConfirmDialog({
  org,
  amountCents,
  bonusCents,
  note,
  pending,
  onConfirm,
  onCancel,
}: {
  org: OrgSearchItem;
  amountCents: number;
  bonusCents: number;
  note: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isRefund = amountCents < 0;
  const totalCredit = amountCents + bonusCents;
  return (
    <>
      <div
        onClick={onCancel}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 200 }}
      />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 520,
          maxWidth: "90vw",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 24,
          zIndex: 201,
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: 18 }}>
          {isRefund ? "⚠ 冲正确认" : "充值确认"}
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: "var(--text-secondary)" }}>
          确认给 <strong style={{ color: "var(--text)" }}>{org.name}</strong>{" "}
          {isRefund ? "扣减" : "充入"}{" "}
          <strong
            className="mono"
            style={{
              fontSize: 18,
              color: isRefund ? "oklch(72% .15 25)" : "var(--accent)",
            }}
          >
            ¥{formatYuan(Math.abs(amountCents))}
          </strong>
          {bonusCents > 0 && !isRefund && (
            <>
              {" "}（含赠送{" "}
              <strong className="mono" style={{ color: "var(--accent)" }}>
                ¥{formatYuan(bonusCents)}
              </strong>
              ，账户共增加{" "}
              <strong className="mono">¥{formatYuan(totalCredit)}</strong>）
            </>
          )}
          ？
        </div>
        <div
          style={{
            marginTop: 12,
            padding: 10,
            background: "var(--surface-2)",
            borderRadius: 6,
            fontSize: 12,
          }}
        >
          <div className="dim-2">备注</div>
          <div style={{ marginTop: 4 }}>{note}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button className="btn" onClick={onCancel} disabled={pending}>
            取消
          </button>
          <button
            className="btn"
            style={{
              background: isRefund ? "oklch(72% .15 25)" : "var(--accent, #6aa0ff)",
              color: "white",
              borderColor: "transparent",
            }}
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? "处理中…" : isRefund ? "确认冲正" : "确认充值"}
          </button>
        </div>
      </div>
    </>
  );
}
