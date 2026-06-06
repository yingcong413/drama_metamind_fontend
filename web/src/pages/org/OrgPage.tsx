// OrgPage.tsx —— PRD v0.9 §3 组织管理(Owner 视图)
//
// 仅企业账户 Owner 可访问;路由层在 router.tsx 用 RequireOwner 拦截。
// 包含:
//   - 组织概要(名称 / 席位 / 成员数)+ 改名按钮
//   - 成员列表(角色 / 状态 / 加入时间)
//   - 邀请成员 / 改昵称 / 启停 / 重置密码 / 踢出 / 转让 Owner
//   - 危险区:解散组织
//
// 个人账户进来 → 显示「升级为企业账户」CTA

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { Avatar } from "@/components/primitives/Avatar";
import { useAuthStore, useCanManageOrg } from "@/stores/auth";
import {
  createMember,
  dissolveOrg,
  getOrg,
  kickMember,
  leaveOrg,
  listMembers,
  patchMember,
  resetMemberPassword,
  transferOwner,
  updateOrg,
  upgradeToEnterprise,
} from "@/api/org";
import type { OrgMember } from "@/types";
import { useNavigate } from "react-router-dom";
import { useT, useTf } from "@/lib/i18n";

export function OrgPage() {
  const t = useT();
  const tf = useTf();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canManageOrg = useCanManageOrg();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const orgQuery = useQuery({ queryKey: ["org"], queryFn: getOrg });
  const membersQuery = useQuery({
    queryKey: ["org-members"],
    queryFn: listMembers,
    enabled: canManageOrg, // 个人账户没有「成员」概念
  });

  // ───── 邀请弹窗 ─────
  const [showInvite, setShowInvite] = useState(false);
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePwd, setInvitePwd] = useState("");
  const [revealedPwd, setRevealedPwd] = useState<string | null>(null);

  const invite = useMutation({
    mutationFn: () =>
      createMember({
        phone: invitePhone.trim(),
        name: inviteName.trim() || undefined,
        init_password: invitePwd.trim() || undefined,
      }),
    onSuccess: (r) => {
      setRevealedPwd(r.init_password);
      setInvitePhone("");
      setInviteName("");
      setInvitePwd("");
      qc.invalidateQueries({ queryKey: ["org-members"] });
      qc.invalidateQueries({ queryKey: ["org"] });
    },
  });

  // ───── 升级(个人 → 企业):个人 Owner 视图里直接是一个 CTA,无单独弹窗 ─────
  const [upgradeName, setUpgradeName] = useState("");
  const upgrade = useMutation({
    mutationFn: () => upgradeToEnterprise(upgradeName.trim()),
    onSuccess: (org) => {
      // 同步 user.org;再刷新 query
      if (user) setUser({ ...user, org });
      qc.invalidateQueries({ queryKey: ["org"] });
    },
  });

  // ───── 改名 ─────
  const [editingName, setEditingName] = useState(false);
  const [orgNameDraft, setOrgNameDraft] = useState("");
  const rename = useMutation({
    mutationFn: (name: string) => updateOrg({ name }),
    onSuccess: (org) => {
      setEditingName(false);
      if (user) setUser({ ...user, org });
      qc.invalidateQueries({ queryKey: ["org"] });
    },
  });

  // ───── 解散 ─────
  const [showDissolve, setShowDissolve] = useState(false);
  const [dissolveConfirm, setDissolveConfirm] = useState("");
  const dissolve = useMutation({
    mutationFn: () => dissolveOrg(),
    onSuccess: () => {
      // 解散后用户被挪到新的个人 org;清 store 强制重新登录
      useAuthStore.getState().logout();
      navigate("/login");
    },
  });

  // ───── 成员单行操作 ─────
  const togglDisable = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "disabled" }) =>
      patchMember(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-members"] }),
  });
  // 每月额度(硬限制):0=不限
  const setQuota = useMutation({
    mutationFn: ({ id, cents }: { id: string; cents: number }) =>
      patchMember(id, { monthly_quota_cents: cents }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-members"] }),
    onError: (e) => alert(tf("设置额度失败:{msg}", { msg: e instanceof Error ? e.message : String(e) })),
  });
  const resetPwd = useMutation({
    mutationFn: (id: string) => resetMemberPassword(id),
    onSuccess: (r) =>
      alert(
        tf("新密码:{pwd}", { pwd: r.new_password }) +
          "\n" +
          t("请妥善转告该成员,本提示只显示一次。"),
      ),
  });
  const kick = useMutation({
    mutationFn: (id: string) => kickMember(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-members"] }),
  });
  const transfer = useMutation({
    mutationFn: (id: string) => transferOwner(id),
    onSuccess: () => {
      // 转让后我变成 member;强制回登录页让 store 重拉
      useAuthStore.getState().logout();
      navigate("/login");
    },
  });

  // ───── Member 视图(role=member 的人进来)─────
  const isMember = user?.role === "member";
  const leave = useMutation({
    mutationFn: () => leaveOrg(),
    onSuccess: () => {
      useAuthStore.getState().logout();
      navigate("/login");
    },
  });

  if (!user) {
    return (
      <>
        <AppTopBar crumbs={[{ label: t("组织管理") }]} />
        <div style={{ padding: 24 }}>{t("请先登录")}</div>
      </>
    );
  }

  // ─────────── Member 视图 ───────────
  if (isMember) {
    return (
      <>
        <AppTopBar crumbs={[{ label: t("组织管理") }]} />
        <div className="char-lib" style={{ maxWidth: 720 }}>
          <h1>{t("当前组织")}</h1>
          <div className="dim" style={{ marginBottom: 16 }}>
            {tf("你是「{org}」的成员。Owner 拥有管理权限;你只能创作、提交生成、查看本人任务。", { org: orgQuery.data?.name ?? "" })}
          </div>
          <section
            style={{
              padding: 20,
              border: "1px solid var(--border)",
              borderRadius: 12,
              background: "var(--surface)",
            }}
          >
            <h2 style={{ marginTop: 0 }}>{t("离开组织")}</h2>
            <p className="dim-2" style={{ fontSize: 13, lineHeight: 1.6 }}>
              {t("离开后:你的角色会立即变为「个人账户 Owner」,但你在本组织创建的项目 / 角色 / 已上传素材将保留在本组织内,不会带走。")}
            </p>
            <button
              className="btn"
              style={{ borderColor: "oklch(72% .15 25)", color: "oklch(72% .15 25)" }}
              disabled={leave.isPending}
              onClick={() => {
                if (confirm(t("确认离开本组织?数据将留在原组织,你将变成个人账户。"))) {
                  leave.mutate();
                }
              }}
            >
              {leave.isPending ? t("处理中…") : t("离开组织")}
            </button>
          </section>
        </div>
      </>
    );
  }

  // ─────────── 个人 Owner 视图(显示升级 CTA)───────────
  if (!canManageOrg) {
    return (
      <>
        <AppTopBar crumbs={[{ label: t("组织管理") }]} />
        <div className="char-lib" style={{ maxWidth: 720 }}>
          <h1>{t("升级为企业账户")}</h1>
          <div className="dim" style={{ marginBottom: 24 }}>
            {t("你当前是个人账户(1 个席位、私人素材库、私人余额)。升级后可邀请同事加入组织,共享素材库与余额。")}
          </div>
          <section
            style={{
              padding: 24,
              border: "1px solid var(--border)",
              borderRadius: 12,
              background: "var(--surface)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 14, lineHeight: 1.8 }}>
              {t("升级后获得:")}
              <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                <li>{t("默认 20 个席位(需更多请联系制影 AI 商务)")}</li>
                <li>{t("组织内成员共享素材库与角色库")}</li>
                <li>{t("统一的企业余额账户与发票抬头")}</li>
                <li>{t("邀请 / 禁用 / 重置成员密码 / 转让 Owner 等管理权限")}</li>
              </ul>
            </div>
            <input
              className="input input-lg"
              placeholder={t("公司名称(2-30 字)")}
              value={upgradeName}
              onChange={(e) => setUpgradeName(e.target.value)}
              maxLength={30}
            />
            <button
              className="btn btn-primary btn-lg"
              disabled={
                upgradeName.trim().length < 2 ||
                upgradeName.trim().length > 30 ||
                upgrade.isPending
              }
              onClick={() => upgrade.mutate()}
            >
              {upgrade.isPending ? t("升级中…") : t("升级为企业账户")}
            </button>
            {upgrade.isError && (
              <div className="dim-2" style={{ color: "oklch(72% .15 25)", fontSize: 12 }}>
                {(upgrade.error as Error).message}
              </div>
            )}
          </section>
        </div>
      </>
    );
  }

  // ─────────── 企业 Owner 视图 ───────────
  const org = orgQuery.data;
  const members = membersQuery.data ?? [];

  return (
    <>
      <AppTopBar crumbs={[{ label: t("组织管理") }]} />
      <div className="char-lib">
        {/* Hero */}
        <div className="char-lib-hero">
          <div>
            <div
              className="dim-2 mono"
              style={{
                fontSize: 11,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              {t("Organization · 企业 Owner")}
            </div>
            {editingName ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  className="input input-lg"
                  value={orgNameDraft}
                  onChange={(e) => setOrgNameDraft(e.target.value)}
                  style={{ width: 260 }}
                  maxLength={30}
                  autoFocus
                />
                <button
                  className="btn btn-sm btn-primary"
                  disabled={
                    orgNameDraft.trim().length < 2 ||
                    orgNameDraft.trim().length > 30 ||
                    rename.isPending
                  }
                  onClick={() => rename.mutate(orgNameDraft.trim())}
                >
                  {t("保存")}
                </button>
                <button className="btn btn-sm" onClick={() => setEditingName(false)}>
                  {t("取消")}
                </button>
              </div>
            ) : (
              <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {org?.name ?? "…"}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setOrgNameDraft(org?.name ?? "");
                    setEditingName(true);
                  }}
                >
                  {t("改名")}
                </button>
              </h1>
            )}
            <p className="char-lib-sub">
              {t("组织内成员共享素材库与角色库。所有成员提交的生成任务都从组织余额扣费。")}
            </p>
          </div>
          <div className="char-lib-stats">
            <div className="stat">
              <div className="stat-n mono">{members.length}</div>
              <div className="stat-l">{t("当前成员")}</div>
            </div>
            <div className="stat">
              <div className="stat-n mono">{org?.seat_limit ?? "—"}</div>
              <div className="stat-l">{t("席位上限")}</div>
            </div>
            <div className="stat">
              <div className="stat-n mono">{members.filter((m) => m.status === "disabled").length}</div>
              <div className="stat-l">{t("已禁用")}</div>
            </div>
          </div>
        </div>

        {/* 工具栏 */}
        <div className="char-lib-toolbar">
          <div className="dim-2" style={{ fontSize: 12 }}>
            {members.length} / {org?.seat_limit ?? "—"} {t("席位")}
            {org && members.length >= org.seat_limit && (
              <span style={{ marginLeft: 8, color: "oklch(72% .15 60)" }}>
                {t("· 已满,需要更多席位请联系制影 AI 商务")}
              </span>
            )}
          </div>
          <button
            className="btn btn-primary btn-sm"
            style={{ marginLeft: "auto" }}
            disabled={!!org && members.length >= org.seat_limit}
            onClick={() => {
              setRevealedPwd(null);
              setShowInvite(true);
            }}
          >
            {t("+ 邀请成员")}
          </button>
        </div>

        {/* 成员列表 */}
        <div style={{ marginTop: 16 }}>
          <table
            className="table"
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
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
                <th style={{ padding: 12, textAlign: "left" }}>{t("成员")}</th>
                <th style={{ padding: 12, textAlign: "left" }}>{t("手机")}</th>
                <th style={{ padding: 12, textAlign: "left" }}>{t("角色")}</th>
                <th style={{ padding: 12, textAlign: "left" }}>{t("状态")}</th>
                <th style={{ padding: 12, textAlign: "left" }}>{t("加入时间")}</th>
                <th style={{ padding: 12, textAlign: "right" }}>{t("操作")}</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <MemberRow
                  key={m.user_id}
                  member={m}
                  isSelf={m.user_id === user.id}
                  onToggleStatus={() =>
                    togglDisable.mutate({
                      id: m.user_id,
                      status: m.status === "active" ? "disabled" : "active",
                    })
                  }
                  onReset={() => {
                    if (confirm(tf("确认重置「{name}」的密码?", { name: m.name }))) {
                      resetPwd.mutate(m.user_id);
                    }
                  }}
                  onSetQuota={() => {
                    const cur = ((m.monthly_quota_cents ?? 0) / 100).toString();
                    const input = window.prompt(
                      tf("给「{name}」设置本月额度(元，0=不限额):", { name: m.name }),
                      cur,
                    );
                    if (input === null) return;
                    const yuan = parseFloat(input);
                    if (!Number.isFinite(yuan) || yuan < 0) {
                      alert(t("请输入 ≥ 0 的数字"));
                      return;
                    }
                    setQuota.mutate({ id: m.user_id, cents: Math.round(yuan * 100) });
                  }}
                  onKick={() => {
                    if (confirm(tf("确认踢出「{name}」?该成员将变为个人账户,在本组织的数据不带走。", { name: m.name }))) {
                      kick.mutate(m.user_id);
                    }
                  }}
                  onTransfer={() => {
                    if (
                      confirm(
                        tf("确认转让 Owner 给「{name}」?转让后你立即降为 Member,失去管理权限。\n\n此操作单向、无需对方同意。", { name: m.name }),
                      )
                    ) {
                      transfer.mutate(m.user_id);
                    }
                  }}
                />
              ))}
            </tbody>
          </table>
          {membersQuery.isLoading && (
            <div className="dim" style={{ padding: 16 }}>{t("加载中…")}</div>
          )}
        </div>

        {/* 危险区:解散 */}
        <section
          style={{
            marginTop: 40,
            padding: 20,
            border: "1px solid oklch(50% .15 25 / 0.4)",
            borderRadius: 12,
            background: "oklch(50% .15 25 / 0.05)",
          }}
        >
          <h2 style={{ marginTop: 0, color: "oklch(72% .15 25)" }}>{t("危险区")}</h2>
          <p className="dim-2" style={{ fontSize: 13, lineHeight: 1.6 }}>
            {t("解散组织 → 所有成员立即转为个人账户;数据保留 30 天可恢复,之后软删除。")}
          </p>
          <button
            className="btn"
            style={{
              borderColor: "oklch(72% .15 25)",
              color: "oklch(72% .15 25)",
            }}
            onClick={() => setShowDissolve(true)}
          >
            {t("解散组织")}
          </button>
        </section>
      </div>

      {/* 邀请弹窗 */}
      {showInvite && (
        <Modal onClose={() => setShowInvite(false)} title={t("邀请新成员")}>
          {revealedPwd ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                {t("邀请成功!请把以下登录信息转告该成员:")}
              </div>
              <div
                style={{
                  padding: 12,
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontFamily: "monospace",
                  fontSize: 13,
                }}
              >
                <div>{t("手机号:")}{invitePhone || t("(已发送)")}</div>
                <div style={{ marginTop: 4 }}>{t("初始密码:")}<strong>{revealedPwd}</strong></div>
              </div>
              <div className="dim-2" style={{ fontSize: 11 }}>
                {t("⚠️ 本密码只显示一次,关闭后无法再查看。可让该成员登录后立刻修改。")}
              </div>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setRevealedPwd(null);
                  setShowInvite(false);
                }}
              >
                {t("我已记下,关闭")}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                className="input input-lg"
                placeholder={t("手机号(11 位)")}
                value={invitePhone}
                onChange={(e) => setInvitePhone(e.target.value)}
              />
              <input
                className="input input-lg"
                placeholder={t("昵称(选填)")}
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                maxLength={30}
              />
              <input
                className="input input-lg"
                placeholder={t("初始密码(选填,留空自动生成)")}
                value={invitePwd}
                onChange={(e) => setInvitePwd(e.target.value)}
              />
              {invite.isError && (
                <div className="dim-2" style={{ color: "oklch(72% .15 25)", fontSize: 12 }}>
                  {(invite.error as Error).message}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn" onClick={() => setShowInvite(false)}>{t("取消")}</button>
                <button
                  className="btn btn-primary"
                  disabled={!/^1[3-9]\d{9}$/.test(invitePhone) || invite.isPending}
                  onClick={() => invite.mutate()}
                >
                  {invite.isPending ? t("邀请中…") : t("邀请")}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* 解散确认 */}
      {showDissolve && (
        <Modal onClose={() => setShowDissolve(false)} title={t("解散组织 — 确认")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: "oklch(72% .15 25)" }}>
              {t("⚠️ 此操作将立即把所有成员转为个人账户。组织数据保留 30 天后软删除。")}
            </p>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {t("请输入组织名称")} <strong style={{ color: "var(--text)" }}>{org?.name}</strong> {t("以确认:")}
            </div>
            <input
              className="input input-lg"
              value={dissolveConfirm}
              onChange={(e) => setDissolveConfirm(e.target.value)}
              placeholder={org?.name}
              autoFocus
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setShowDissolve(false)}>
                {t("取消")}
              </button>
              <button
                className="btn"
                style={{
                  background: "oklch(72% .15 25)",
                  color: "white",
                  borderColor: "oklch(72% .15 25)",
                }}
                disabled={dissolveConfirm !== org?.name || dissolve.isPending}
                onClick={() => dissolve.mutate()}
              >
                {dissolve.isPending ? t("解散中…") : t("永久解散")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function MemberRow({
  member,
  isSelf,
  onToggleStatus,
  onReset,
  onKick,
  onTransfer,
  onSetQuota,
}: {
  member: OrgMember;
  isSelf: boolean;
  onToggleStatus: () => void;
  onReset: () => void;
  onKick: () => void;
  onTransfer: () => void;
  onSetQuota: () => void;
}) {
  const t = useT();
  return (
    <tr style={{ borderTop: "1px solid var(--border)" }}>
      <td style={{ padding: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar name={member.name} />
          <div style={{ fontWeight: 500 }}>
            {member.name}
            {isSelf && (
              <span className="dim-2 mono" style={{ marginLeft: 8, fontSize: 10 }}>
                {t("我")}
              </span>
            )}
          </div>
        </div>
      </td>
      <td style={{ padding: 12 }} className="mono dim-2">
        {member.phone}
      </td>
      <td style={{ padding: 12 }}>
        {member.role === "owner" ? (
          <span
            style={{
              padding: "2px 8px",
              background: "rgba(255,170,60,.1)",
              color: "oklch(72% .14 70)",
              borderRadius: 4,
              fontSize: 11,
            }}
          >
            Owner
          </span>
        ) : (
          <span
            style={{
              padding: "2px 8px",
              background: "var(--surface-2)",
              color: "var(--text-secondary)",
              borderRadius: 4,
              fontSize: 11,
            }}
          >
            Member
          </span>
        )}
      </td>
      <td style={{ padding: 12 }}>
        {member.status === "active" ? (
          <span style={{ color: "oklch(70% .15 145)" }}>{t("● 活跃")}</span>
        ) : (
          <span className="dim-2">{t("○ 已禁用")}</span>
        )}
      </td>
      <td style={{ padding: 12 }} className="dim-2">
        {member.joined_at ? new Date(member.joined_at).toLocaleDateString() : "—"}
      </td>
      <td style={{ padding: 12, textAlign: "right" }}>
        {!isSelf && member.role === "member" && (
          <div style={{ display: "inline-flex", gap: 4 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={onSetQuota}
              title={member.monthly_quota_cents && member.monthly_quota_cents > 0
                ? t("本月额度") + ": ¥" + (member.monthly_quota_cents / 100).toFixed(2)
                : t("本月额度: 不限")}
            >
              {member.monthly_quota_cents && member.monthly_quota_cents > 0
                ? "额度 ¥" + (member.monthly_quota_cents / 100).toFixed(0)
                : t("额度")}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onToggleStatus}>
              {member.status === "active" ? t("禁用") : t("启用")}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onReset}>
              {t("重置密码")}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onTransfer}>
              {t("转让 Owner")}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              style={{ color: "oklch(72% .15 25)" }}
              onClick={onKick}
            >
              {t("踢出")}
            </button>
          </div>
        )}
        {isSelf && (
          <span className="dim-2" style={{ fontSize: 11 }}>
            {t("(本人,使用账户中心修改)")}
          </span>
        )}
      </td>
    </tr>
  );
}

/** 通用弹窗 */
function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,.6)",
          zIndex: 200,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 480,
          maxWidth: "90vw",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          boxShadow: "0 20px 50px rgba(0,0,0,.5)",
          padding: 24,
          zIndex: 201,
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{title}</h2>
        {children}
      </div>
    </>
  );
}
