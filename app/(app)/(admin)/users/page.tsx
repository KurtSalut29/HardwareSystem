"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus, Trash2, Pencil, Users2, ShieldCheck, ShoppingBag, UserX, UserCheck, MapPin, Mail, Phone,
  CheckCircle2, XCircle, UserPen, UserPlus } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Button from "@/components/ui/Button";
import FilterTiles, { type FilterTile } from "@/components/ui/FilterTiles";
import SearchField from "@/components/ui/SearchField";
import EmptyState from "@/components/ui/EmptyState";
import Pagination from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/ToastProvider";
import { roleLabel } from "@/lib/roles";
import type { AccountStatus } from "@/lib/users";
import Alert from "@/components/ui/Alert";

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

const STATUS_STYLE: Record<AccountStatus, { label: string; pill: string }> = {
  pending: { label: "Waiting approval", pill: "bg-warn-soft text-warn" },
  approved: { label: "Approved", pill: "bg-good-soft text-good" },
  rejected: { label: "Rejected", pill: "bg-bad-soft text-bad" },
};

function StatusChip({ status }: { status: AccountStatus }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.approved;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.pill}`}>
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

/** Initial in a circle, tinted by role so staff, drivers and customers read apart at a glance. */
function Avatar({ u, size = "md" }: { u: User; size?: "md" | "lg" }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full font-display font-extrabold ${size === "lg" ? "size-11 text-base" : "size-9 text-sm"} ${
      u.role === "customer" ? "bg-good-soft text-good" : u.role === "driver" ? "bg-warn-soft text-warn" : "bg-brand-soft text-brand"}`}>
      {(u.firstName ?? u.username).charAt(0).toUpperCase()}
    </span>
  );
}

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

  const TILES: FilterTile<Tab>[] = [
    { key: "all", label: "All users", value: users.length, icon: <Users2 className="size-5" />, tone: "brand" },
    { key: "pending", label: "To approve", value: pending.length, icon: <UserCheck className="size-5" />, tone: pending.length ? "warn" : "neutral", urgent: pending.length > 0 },
    { key: "customers", label: "Customers", value: customerCount, icon: <ShoppingBag className="size-5" />, tone: "good" },
    { key: "staff", label: "Staff & drivers", value: users.length - customerCount, icon: <ShieldCheck className="size-5" />, tone: "brand", hint: `${driverCount} ${driverCount === 1 ? "driver" : "drivers"}` },
  ];

  const ReviewButtons = ({ u, full = false }: { u: User; full?: boolean }) => (
    <>
      <button type="button" onClick={() => setApproveTarget(u)} aria-label={`Approve ${u.username}`}
        className={`${full ? "flex-1" : ""} inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-good/40 bg-good-soft px-3 text-[12.5px] font-semibold text-good transition hover:border-good`}>
        <CheckCircle2 className="size-3.5" /> Approve
      </button>
      <button type="button" onClick={() => { setRejectTarget(u); setRejectReason(""); }} aria-label={`Reject ${u.username}`}
        className={`${full ? "flex-1" : ""} inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold text-bad transition hover:bg-bad-soft`}>
        <XCircle className="size-3.5" /> Reject
      </button>
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Users"
        subtitle={loading ? "Loading accounts…" : (
          <>
            <span className="font-semibold text-ink-2">{users.length}</span> accounts · <span className="font-semibold text-ink-2">{staffCount}</span> staff, <span className="font-semibold text-ink-2">{driverCount}</span> {driverCount === 1 ? "driver" : "drivers"}, <span className="font-semibold text-ink-2">{customerCount}</span> customers
            {pending.length > 0 && <> · <span className="font-semibold text-warn">{pending.length} waiting for approval</span></>}
          </>
        )}
        action={<Button onClick={openAdd} icon={<Plus className="size-4" />}>Add staff or driver</Button>}
      />

      <FilterTiles tiles={TILES} value={tab} onChange={(k) => { setTab(k); setPage(1); }} label="Filter users" loading={loading} />

      {!mailReady && (
        <Alert tone="warn" title="Approval emails are off">
          Customers won&apos;t get an email when you approve them until the store&apos;s Gmail is set up
          (GMAIL_USER and GMAIL_APP_PASSWORD in the server settings). Approving still works.
        </Alert>
      )}

      <section aria-label="Users" className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-3">
          <SearchField value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Name, email or number" label="Search users" className="min-w-0 flex-1 sm:max-w-md" />
          <p className="ml-auto text-[13px] text-ink-3">
            <span className="num font-semibold text-ink">{filtered.length}</span> {filtered.length === 1 ? "account" : "accounts"}
          </p>
        </div>

        {tab === "pending" ? (
          /* Approval queue: everything the admin needs to decide, on one card */
          <div className="p-4">
            {loading ? (
              <p className="py-12 text-center text-sm text-ink-4">Loading…</p>
            ) : paginated.length === 0 ? (
              <EmptyState icon={UserCheck} title="No one is waiting" description="New customer registrations show up here for you to approve." />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {paginated.map((u) => (
                  <div key={u.id} className="flex flex-col gap-3 rounded-2xl border border-line p-4">
                    <div className="flex items-start gap-3">
                      <Avatar u={u} size="lg" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold text-ink">{fullLegalName(u) ?? u.username}</p>
                        <p className="text-[12px] text-ink-4">Registered {ago(u.createdAt)}</p>
                      </div>
                      <StatusChip status={u.accountStatus} />
                    </div>
                    <dl className="space-y-1.5 rounded-xl bg-subtle p-3 text-[13px] text-ink-2">
                      <div className="flex items-center gap-2"><Mail className="size-3.5 shrink-0 text-ink-4" /><dd className="truncate">{u.email ?? "—"}</dd></div>
                      <div className="flex items-center gap-2"><Phone className="size-3.5 shrink-0 text-ink-4" /><dd className="num">{u.contact ?? "—"}</dd></div>
                      <div className="flex items-start gap-2">
                        <MapPin className="mt-0.5 size-3.5 shrink-0 text-ink-4" />
                        <dd className="min-w-0">
                          {u.defaultAddress ?? "No location"}
                          {u.defaultLat != null && u.defaultLng != null && (
                            <a href={mapLink(u.defaultLat, u.defaultLng)} target="_blank" rel="noreferrer" className="ml-1.5 whitespace-nowrap font-semibold text-brand hover:underline">View on map</a>
                          )}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-auto flex gap-2">
                      <ReviewButtons u={u} full />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : loading ? (
          <ul className="divide-y divide-line">
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3.5">
                <div className="size-9 animate-pulse rounded-full bg-recess" /><div className="h-4 flex-1 animate-pulse rounded bg-recess" />
              </li>
            ))}
          </ul>
        ) : paginated.length === 0 ? (
          <EmptyState icon={UserX} title="No users found" description="Try a different search or add a new user." />
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_130px_110px_168px] gap-4 border-b border-line px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-4 md:grid">
              <span>User</span><span>Role</span><span>Mobile</span><span>Joined</span><span className="w-[168px] text-right">Actions</span>
            </div>
            <ul className="divide-y divide-line">
              {paginated.map((u) => {
                const waiting = u.role === "customer" && u.accountStatus !== "approved";
                return (
                  <li key={u.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 transition hover:bg-subtle md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_130px_110px_168px]">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar u={u} />
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold text-ink">{fullLegalName(u) ?? u.username}</p>
                        <p className="truncate text-[12px] text-ink-4">{u.email ?? (fullLegalName(u) ? u.username : "No email — signs in with username")}</p>
                      </div>
                    </div>
                    <div className="col-start-2 row-start-1 flex flex-wrap items-center justify-end gap-1.5 md:col-start-auto md:row-start-auto md:justify-start">
                      <Badge label={roleLabel(u.role)} variant={u.role} />
                      {waiting && <StatusChip status={u.accountStatus} />}
                      {u.accountStatus === "rejected" && u.statusNote && <p className="hidden w-full text-[11.5px] text-ink-4 md:block">{u.statusNote}</p>}
                    </div>
                    <span className="num hidden text-[13px] text-ink-2 md:block">{u.contact ?? <span className="text-ink-4">—</span>}</span>
                    <span className="hidden text-[12.5px] text-ink-4 md:block">{new Date(u.createdAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</span>
                    <div className="col-span-2 flex flex-wrap items-center gap-1.5 md:col-span-1 md:justify-end">
                      <span className="num mr-auto text-[12px] text-ink-4 md:hidden">{u.contact ?? "No mobile"} · joined {new Date(u.createdAt).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}</span>
                      {waiting && <ReviewButtons u={u} />}
                      <button type="button" onClick={() => openEdit(u)} aria-label={`Edit ${u.username}`}
                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-line px-2.5 text-xs font-semibold text-ink-2 transition hover:border-brand/40 hover:bg-brand-soft hover:text-brand-ink"><Pencil className="size-3.5" /> Edit</button>
                      <button type="button" onClick={() => setDeleteTarget(u)} aria-label={`Delete ${u.username}`}
                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-line px-2.5 text-xs font-semibold text-bad transition hover:border-bad/40 hover:bg-bad-soft"><Trash2 className="size-3.5" /> Delete</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <Pagination page={currentPage} totalPages={Math.max(1, totalPages)} total={filtered.length} pageSize={PER_PAGE} onChange={setPage} noun="users" />
      </section>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete this user?"
        body={<>Are you sure you want to delete <span className="font-medium text-ink">{deleteTarget?.username}</span>? This cannot be undone.</>}
        confirmLabel="Yes, delete"
      />

      <ConfirmModal
        open={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        onConfirm={async () => { if (approveTarget && (await review(approveTarget, "approve"))) setApproveTarget(null); }}
        title="Approve this customer?"
        variant="info"
        body={<>
          <span className="font-medium text-ink">{approveTarget?.username}</span> will be able to sign in and order.
          {approveTarget?.email && <> We&apos;ll email <span className="font-medium text-ink">{approveTarget.email}</span> to let them know.</>}
        </>}
        confirmLabel="Yes, approve"
      />

      <Modal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="Turn down this registration?" icon={<UserX className="size-5" />} description="They get an email with your reason, so keep it polite."
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
          <p className="text-sm text-ink-2">
            <span className="font-medium text-ink">{rejectTarget?.username}</span> won&apos;t be able to sign in. The reason is emailed to them, so keep it polite.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {REJECT_REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setRejectReason(r)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition ${rejectReason === r ? "bg-brand-soft border-brand/30 text-brand" : "border-line text-ink-2 hover:bg-subtle"}`}>
                {r}
              </button>
            ))}
          </div>
          <label htmlFor="reject-reason" className="block text-xs font-medium text-ink-2">Reason</label>
          <textarea id="reject-reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} maxLength={300} rows={3}
            className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-4 shadow-[0_1px_2px_rgba(16,24,64,0.04)] transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
            placeholder="Why the account can't be approved" />
        </div>
      </Modal>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editTarget ? "Edit user" : "Add staff or driver"}
        icon={editTarget ? <UserPen className="size-5" /> : <UserPlus className="size-5" />}
        description={editTarget ? "Change the role, sign-in email or mobile number." : "Staff run the counter and orders. Drivers deliver them."}
        footer={
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" form="user-form" className="flex-1" loading={saving}>
              {editTarget ? "Save changes" : "Add user"}
            </Button>
          </div>
        }
      >
        <form id="user-form" onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">{editTarget?.role === "customer" ? "Name" : "Username"}</label>
              <input
                required disabled={!!editTarget} value={form.username}
                onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-4 shadow-[0_1px_2px_rgba(16,24,64,0.04)] transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 disabled:bg-subtle disabled:text-ink-4"
                placeholder="Enter username" />
              {editTarget && <p className="text-[11px] text-ink-4 mt-1">This can&apos;t be changed after the account is made.</p>}
            </div>
            <div className="col-span-2">
              <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Email {editTarget && <span className="text-ink-4">(used to sign in)</span>}</label>
              <input type="email" required={!editTarget} value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-4 shadow-[0_1px_2px_rgba(16,24,64,0.04)] transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10" placeholder="name@gmail.com" />
            </div>
            {!editTarget && (
              <div>
                <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Password</label>
                <input required type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-4 shadow-[0_1px_2px_rgba(16,24,64,0.04)] transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10" placeholder="Password" />
                <p className="text-[11px] text-ink-4 mt-1">8+ characters, with a letter and a number.</p>
              </div>
            )}
            <div className={editTarget ? "col-span-2" : ""}>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Role</label>
              <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-4 shadow-[0_1px_2px_rgba(16,24,64,0.04)] transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10">
                {/* When editing someone who is already a customer or admin, keep
                    their current role in the list — otherwise just opening the
                    form and saving would silently demote them to Staff. */}
                {roleOptions.map((r) => (
                  <option key={r} value={r}>{roleLabel(r)}</option>
                ))}
              </select>
              {!editTarget && (
                <p className="text-[11px] text-ink-4 mt-1">Customers create their own accounts when they sign up.</p>
              )}
            </div>
            <div className="col-span-2">
              <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Mobile number <span className="text-ink-4">(optional)</span></label>
              <input value={form.contact} onChange={(e) => setForm((p) => ({ ...p, contact: e.target.value }))} inputMode="numeric"
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-4 shadow-[0_1px_2px_rgba(16,24,64,0.04)] transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10" placeholder="0917 123 4567" />
              <p className="text-[11px] text-ink-4 mt-1">11 digits starting with 09.</p>
            </div>
          </div>
          {error && <Alert tone="bad" compact>{error}</Alert>}
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
