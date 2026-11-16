"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus, Search, Trash2, Pencil, Users2, ShieldCheck, Truck, ShoppingBag, UserX, UserCheck, Clock, MapPin, Mail, Phone,
  CheckCircle2, XCircle, AlertTriangle,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Button from "@/components/ui/Button";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import Pagination from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/ToastProvider";
import { ICON_SIZE } from "@/lib/constants/icon-size";
import { roleLabel } from "@/lib/roles";
import type { AccountStatus } from "@/lib/users";

type User = {
  id: number; username: string; role: string; contact: string | null; email: string | null; createdAt: string;
  firstName: string | null; middleName: string | null; lastName: string | null; suffix: string | null;
  accountStatus: AccountStatus; statusNote: string | null; reviewedAt: string | null;
  defaultAddress: string | null; defaultLat: number | null; defaultLng: number | null;
};

// The admin only ever creates internal accounts. Customers register themselves
// through public signup, and a second admin isn't something the store hands out
// from this form. Mirrored by the POST guard in /api/users.
const CREATABLE_ROLES = ["cashier", "driver"] as const;

const EMPTY = { username: "", password: "", role: "cashier", contact: "", email: "" };

type Tab = "all" | "pending" | "customers" | "staff";

const REJECT_REASONS = [
  "The details look incomplete or incorrect.",
  "The location is outside our delivery area.",
  "This person already has an account.",
];

const STATUS_STYLE: Record<AccountStatus, { label: string; bg: string; fg: string }> = {
  pending: { label: "Waiting approval", bg: "var(--warn-soft)", fg: "var(--warn)" },
  approved: { label: "Approved", bg: "var(--good-soft)", fg: "var(--good)" },
  rejected: { label: "Rejected", bg: "var(--bad-soft)", fg: "var(--bad)" },
};

function StatusChip({ status }: { status: AccountStatus }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.approved;
  return (
    <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  );
}

function fullLegalName(u: User) {
  if (!u.firstName || !u.lastName) return null;
  return [u.firstName, u.middleName, u.lastName, u.suffix].filter(Boolean).join(" ");
}

const mapLink = (lat: number, lng: number) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;

const ago = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
};

function UsersPageInner() {
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>(() => (searchParams.get("tab") === "pending" ? "pending" : "all"));
  const [loading, setLoading] = useState(true);
  const [mailReady, setMailReady] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [approveTarget, setApproveTarget] = useState<User | null>(null);
  const [rejectTarget, setRejectTarget] = useState<User | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;
  const showToast = useToast();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/users");
    setUsers(res.ok ? await res.json() : []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => {
    fetch("/api/users/review").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) setMailReady(Boolean(d.mailReady)); }).catch(() => {});
  }, []);

  const pending = users.filter((u) => u.role === "customer" && u.accountStatus === "pending");
  const q = search.trim().toLowerCase();
  const filtered = users
    .filter((u) =>
      tab === "all" ? true
        : tab === "pending" ? u.role === "customer" && u.accountStatus === "pending"
        : tab === "customers" ? u.role === "customer"
        : u.role !== "customer")
    .filter((u) => !q || [u.username, u.role, u.email ?? "", u.contact ?? "", fullLegalName(u) ?? ""].some((v) => v.toLowerCase().includes(q)));
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const currentPage = Math.min(page, Math.max(1, totalPages));
  const paginated = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  const staffCount = users.filter((u) => u.role === "admin" || u.role === "cashier").length;
  const driverCount = users.filter((u) => u.role === "driver").length;
  const customerCount = users.filter((u) => u.role === "customer").length;

  function openAdd() {
    setEditTarget(null);
    setForm(EMPTY);
    setError("");
    setShowModal(true);
  }

  function openEdit(u: User) {
    setEditTarget(u);
    setForm({ username: u.username, password: "", role: u.role, contact: u.contact ?? "", email: u.email ?? "" });
    setError("");
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setError(""); setSaving(true);
    const res = editTarget
      ? await fetch("/api/users", {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editTarget.id, role: form.role, contact: form.contact, email: form.email }),
        })
      : await fetch("/api/users", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error); return; }
    setShowModal(false); setForm(EMPTY);
    showToast(editTarget ? "User updated successfully" : "User added successfully");
    fetchUsers();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const res = await fetch("/api/users", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: target.id }) });
    if (!res.ok) { showToast((await res.json()).error, "error"); return; }
    setDeleteTarget(null);
    showToast(`"${target.username}" deleted`);
    fetchUsers();
  }

  async function review(u: User, decision: "approve" | "reject", note = "") {
    setReviewing(true);
    const res = await fetch("/api/users/review", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, decision, note }),
    });
    setReviewing(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { showToast(data.error ?? "Couldn't save that.", "error"); return false; }
    setUsers((prev) => prev.map((x) => (x.id === u.id ? data.user : x)));
    const verb = decision === "approve" ? "Approved" : "Turned down";
    showToast(
      data.emailSent
        ? `${verb} ${u.username}. We emailed ${u.email}.`
        : `${verb} ${u.username}, but the email wasn't sent: ${data.emailError}`,
      data.emailSent ? "success" : "warning",
    );
    return true;
  }

  const roleOptions: string[] =
    editTarget && !CREATABLE_ROLES.includes(editTarget.role as (typeof CREATABLE_ROLES)[number])
      ? [editTarget.role, ...CREATABLE_ROLES]
      : [...CREATABLE_ROLES];

  const TABS: { key: Tab; label: string; count: number; urgent?: boolean }[] = [
    { key: "all", label: "All users", count: users.length },
    { key: "pending", label: "Waiting approval", count: pending.length, urgent: pending.length > 0 },
    { key: "customers", label: "Customers", count: customerCount },
    { key: "staff", label: "Staff & drivers", count: users.length - customerCount },
  ];

  const ReviewButtons = ({ u, full = false }: { u: User; full?: boolean }) => (
    <>
      <button onClick={() => setApproveTarget(u)} aria-label={`Approve ${u.username}`}
        className={`${full ? "flex-1 justify-center" : ""} flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white rounded-lg transition hover:opacity-90`}
        style={{ background: "var(--good)" }}>
        <CheckCircle2 size={ICON_SIZE.xs} /> Approve
      </button>
      <button onClick={() => { setRejectTarget(u); setRejectReason(""); }} aria-label={`Reject ${u.username}`}
        className={`${full ? "flex-1 justify-center" : ""} flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition`}>
        <XCircle size={ICON_SIZE.xs} /> Reject
      </button>
    </>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users"
        subtitle="Approve new customers, and add staff and driver accounts."
        action={<Button onClick={openAdd} icon={<Plus size={ICON_SIZE.md} />}>Add Staff / Driver</Button>}
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Users" value={users.length} icon={<Users2 size={ICON_SIZE.lg} className="text-blue-600" />} iconBg="bg-blue-50" />
        <StatCard title="Staff (Admin/Staff)" value={staffCount} icon={<ShieldCheck size={ICON_SIZE.lg} className="text-purple-600" />} iconBg="bg-purple-50" />
        <StatCard title="Drivers" value={driverCount} icon={<Truck size={ICON_SIZE.lg} className="text-indigo-600" />} iconBg="bg-indigo-50" />
        <StatCard title="Customers" value={customerCount} icon={<ShoppingBag size={ICON_SIZE.lg} className="text-emerald-600" />} iconBg="bg-emerald-50" />
      </div>

      {!mailReady && (
        <div className="rounded-xl border px-4 py-3 text-xs flex items-start gap-2" style={{ borderColor: "var(--warn)", background: "var(--warn-soft)", color: "var(--warn)" }}>
          <AlertTriangle size={ICON_SIZE.sm} className="shrink-0 mt-px" />
          <span>
            <b>Approval emails are off.</b> Customers won&apos;t get an email when you approve them until the store&apos;s Gmail is set up
            (GMAIL_USER and GMAIL_APP_PASSWORD in the server settings). Approving still works.
          </span>
        </div>
      )}

      {/* New customers waiting for approval, front and center */}
      {pending.length > 0 && tab !== "pending" && (
        <button onClick={() => { setTab("pending"); setPage(1); }}
          className="w-full rounded-xl border px-4 py-3 flex items-center gap-3 text-left transition hover:shadow-sm"
          style={{ borderColor: "var(--warn)", background: "var(--warn-soft)" }}>
          <Clock size={ICON_SIZE.md} style={{ color: "var(--warn)" }} className="shrink-0" />
          <span className="flex-1 text-sm" style={{ color: "var(--warn)" }}>
            <b>{pending.length} new customer{pending.length === 1 ? "" : "s"}</b> waiting for your approval. They can&apos;t sign in until you approve them.
          </span>
          <span className="text-xs font-bold shrink-0" style={{ color: "var(--warn)" }}>Review</span>
        </button>
      )}

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex flex-wrap items-center gap-2 p-3 border-b border-gray-100">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter users">
            {TABS.map((t) => {
              const on = tab === t.key;
              return (
                <button key={t.key} role="tab" aria-selected={on} onClick={() => { setTab(t.key); setPage(1); }}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${on ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                  {t.label}
                  <span className={`text-[10.5px] font-bold px-1.5 rounded-full ${on ? "bg-white/20 text-white" : t.urgent ? "text-white" : "bg-gray-100 text-gray-500"}`}
                    style={!on && t.urgent ? { background: "var(--warn)" } : undefined}>
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="relative w-full sm:w-72 sm:ml-auto">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, email or number..."
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition placeholder:text-gray-400" />
          </div>
        </div>

        {tab === "pending" ? (
          /* Approval queue: everything the admin needs to decide, on one card */
          <div className="p-4">
            {loading ? (
              <p className="py-12 text-center text-gray-400 text-sm">Loading...</p>
            ) : paginated.length === 0 ? (
              <EmptyState icon={UserCheck} title="No one is waiting" description="New customer registrations show up here for you to approve." />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {paginated.map((u) => (
                  <div key={u.id} className="rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-display font-extrabold shrink-0" style={{ background: "linear-gradient(155deg, var(--brand), var(--brand-ink))" }}>
                        {(u.firstName ?? u.username).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900">{fullLegalName(u) ?? u.username}</p>
                        <p className="text-[11px] text-gray-400">Registered {ago(u.createdAt)}</p>
                      </div>
                      <StatusChip status={u.accountStatus} />
                    </div>
                    <dl className="text-xs text-gray-600 space-y-1.5">
                      <div className="flex items-center gap-2"><Mail size={ICON_SIZE.xs} className="text-gray-400 shrink-0" /><dd className="truncate">{u.email ?? "—"}</dd></div>
                      <div className="flex items-center gap-2"><Phone size={ICON_SIZE.xs} className="text-gray-400 shrink-0" /><dd className="num">{u.contact ?? "—"}</dd></div>
                      <div className="flex items-start gap-2">
                        <MapPin size={ICON_SIZE.xs} className="text-gray-400 shrink-0 mt-0.5" />
                        <dd className="min-w-0">
                          {u.defaultAddress ?? "No location"}
                          {u.defaultLat != null && u.defaultLng != null && (
                            <a href={mapLink(u.defaultLat, u.defaultLng)} target="_blank" rel="noreferrer" className="ml-1.5 font-semibold text-blue-600 hover:underline whitespace-nowrap">View on map</a>
                          )}
                        </dd>
                      </div>
                    </dl>
                    <div className="flex gap-2 pt-1 border-t border-gray-100 mt-auto">
                      <ReviewButtons u={u} full />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Table — tablet and up. A table's columns don't reflow, so on a phone this either
                clips data or forces sideways scrolling to read a phone number; below md we swap
                to a stacked card list instead of fighting the grid. */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">User</th>
                    <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Role</th>
                    <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Contact</th>
                    <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Joined</th>
                    <th className="py-2.5 px-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr><td colSpan={5} className="py-12 text-center text-gray-400">Loading...</td></tr>
                  ) : paginated.length === 0 ? (
                    <tr><td colSpan={5}><EmptyState icon={UserX} title="No users found" description="Try a different search or add a new user." /></td></tr>
                  ) : paginated.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-display font-extrabold shrink-0" style={{ background: "linear-gradient(155deg, var(--brand), var(--brand-ink))" }}>
                            {u.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="font-medium text-gray-900">{u.username}</span>
                            {u.email && <p className="text-[11px] text-gray-400 truncate">{u.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge label={roleLabel(u.role)} variant={u.role} />
                          {u.role === "customer" && u.accountStatus !== "approved" && <StatusChip status={u.accountStatus} />}
                        </div>
                        {u.accountStatus === "rejected" && u.statusNote && <p className="text-[11px] text-gray-400 mt-1 max-w-[220px]">{u.statusNote}</p>}
                      </td>
                      <td className="py-3 px-4 text-gray-500 num">{u.contact ?? "—"}</td>
                      <td className="py-3 px-4 text-gray-400 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center gap-1.5 justify-end">
                          {u.role === "customer" && u.accountStatus !== "approved" && <ReviewButtons u={u} />}
                          <button onClick={() => openEdit(u)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition">
                            <Pencil size={ICON_SIZE.xs} /> Edit
                          </button>
                          <button onClick={() => setDeleteTarget(u)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition">
                            <Trash2 size={ICON_SIZE.xs} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Card list — phones only */}
            <div className="md:hidden divide-y divide-gray-50">
              {loading ? (
                <p className="py-12 text-center text-gray-400 text-sm">Loading...</p>
              ) : paginated.length === 0 ? (
                <EmptyState icon={UserX} title="No users found" description="Try a different search or add a new user." />
              ) : paginated.map((u) => (
                <div key={u.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-display font-extrabold shrink-0" style={{ background: "linear-gradient(155deg, var(--brand), var(--brand-ink))" }}>
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-gray-900 truncate">{u.username}</span>
                        <Badge label={roleLabel(u.role)} variant={u.role} />
                      </div>
                      {u.email && <p className="text-xs text-gray-500 mt-1 truncate">{u.email}</p>}
                      <p className="text-xs text-gray-500 mt-0.5">{u.contact ?? "No contact on file"}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">Joined {new Date(u.createdAt).toLocaleDateString()}</p>
                      {u.role === "customer" && u.accountStatus !== "approved" && <div className="mt-1.5"><StatusChip status={u.accountStatus} /></div>}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    {u.role === "customer" && u.accountStatus !== "approved" && <ReviewButtons u={u} full />}
                    <button onClick={() => openEdit(u)} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition">
                      <Pencil size={ICON_SIZE.xs} /> Edit
                    </button>
                    <button onClick={() => setDeleteTarget(u)} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition">
                      <Trash2 size={ICON_SIZE.xs} /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <Pagination page={currentPage} totalPages={Math.max(1, totalPages)} total={filtered.length} pageSize={PER_PAGE} onChange={setPage} noun="users" />
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete User?"
        body={<>Are you sure you want to delete <span className="font-medium text-gray-800">{deleteTarget?.username}</span>? This cannot be undone.</>}
        confirmLabel="Yes, Delete"
      />

      <ConfirmModal
        open={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        onConfirm={async () => { if (approveTarget && (await review(approveTarget, "approve"))) setApproveTarget(null); }}
        title="Approve this customer?"
        variant="info"
        body={<>
          <span className="font-medium text-gray-800">{approveTarget?.username}</span> will be able to sign in and order.
          {approveTarget?.email && <> We&apos;ll email <span className="font-medium text-gray-800">{approveTarget.email}</span> to let them know.</>}
        </>}
        confirmLabel="Yes, approve"
      />

      <Modal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="Turn down this registration?"
        footer={
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button type="button" variant="danger" className="flex-1" loading={reviewing} disabled={!rejectReason.trim()}
              onClick={async () => { if (rejectTarget && (await review(rejectTarget, "reject", rejectReason))) setRejectTarget(null); }}>
              Reject
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            <span className="font-medium text-gray-800">{rejectTarget?.username}</span> won&apos;t be able to sign in. The reason is emailed to them, so keep it polite.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {REJECT_REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setRejectReason(r)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition ${rejectReason === r ? "bg-blue-50 border-blue-300 text-blue-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                {r}
              </button>
            ))}
          </div>
          <label htmlFor="reject-reason" className="block text-xs font-medium text-gray-600">Reason</label>
          <textarea id="reject-reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} maxLength={300} rows={3}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
            placeholder="Why the account can't be approved" />
        </div>
      </Modal>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editTarget ? "Edit User" : "Add Staff or Driver"}
        footer={
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" form="user-form" className="flex-1" loading={saving}>
              {editTarget ? "Save Changes" : "Add User"}
            </Button>
          </div>
        }
      >
        <form id="user-form" onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">{editTarget?.role === "customer" ? "Name" : "Username"}</label>
              <input
                required disabled={!!editTarget} value={form.username}
                onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition disabled:bg-gray-50 disabled:text-gray-400"
                placeholder="Enter username" />
              {editTarget && <p className="text-[11px] text-gray-400 mt-1">This can&apos;t be changed after the account is made.</p>}
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Email {editTarget && <span className="text-gray-400">(used to sign in)</span>}</label>
              <input type="email" required={!editTarget} value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition" placeholder="name@gmail.com" />
            </div>
            {!editTarget && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
                <input required type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition" placeholder="Password" />
                <p className="text-[11px] text-gray-400 mt-1">8+ characters, with a letter and a number.</p>
              </div>
            )}
            <div className={editTarget ? "col-span-2" : ""}>
              <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
              <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition bg-white">
                {/* When editing someone who is already a customer or admin, keep
                    their current role in the list — otherwise just opening the
                    form and saving would silently demote them to Staff. */}
                {roleOptions.map((r) => (
                  <option key={r} value={r}>{roleLabel(r)}</option>
                ))}
              </select>
              {!editTarget && (
                <p className="text-[11px] text-gray-400 mt-1">Customers create their own accounts when they sign up.</p>
              )}
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Mobile number <span className="text-gray-400">(optional)</span></label>
              <input value={form.contact} onChange={(e) => setForm((p) => ({ ...p, contact: e.target.value }))} inputMode="numeric"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition" placeholder="0917 123 4567" />
              <p className="text-[11px] text-gray-400 mt-1">11 digits starting with 09.</p>
            </div>
          </div>
          {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        </form>
      </Modal>
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense>
      <UsersPageInner />
    </Suspense>
  );
}
