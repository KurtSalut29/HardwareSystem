"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Search, Trash2, Pencil, Users2, ShieldCheck, Truck, ShoppingBag, UserX } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Button from "@/components/ui/Button";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/ToastProvider";
import { ICON_SIZE } from "@/lib/constants/icon-size";
import { roleLabel } from "@/lib/roles";

type User = { id: number; username: string; role: string; contact: string | null; createdAt: string };

// The admin only ever creates internal accounts. Customers register themselves
// through public signup, and a second admin isn't something the store hands out
// from this form. Mirrored by the POST guard in /api/users.
const CREATABLE_ROLES = ["cashier", "driver"] as const;

const EMPTY = { username: "", password: "", role: "cashier", contact: "" };

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;
  const showToast = useToast();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/users");
    setUsers(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filtered = users.filter(
    (u) => u.username.toLowerCase().includes(search.toLowerCase()) || u.role.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

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
    setForm({ username: u.username, password: "", role: u.role, contact: u.contact ?? "" });
    setError("");
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setError(""); setSaving(true);
    const res = editTarget
      ? await fetch("/api/users", {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editTarget.id, role: form.role, contact: form.contact }),
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

  const roleOptions: string[] =
    editTarget && !CREATABLE_ROLES.includes(editTarget.role as (typeof CREATABLE_ROLES)[number])
      ? [editTarget.role, ...CREATABLE_ROLES]
      : [...CREATABLE_ROLES];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users"
        subtitle="Add staff and driver accounts. Customers register themselves."
        action={<Button onClick={openAdd} icon={<Plus size={ICON_SIZE.md} />}>Add Staff / Driver</Button>}
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Users" value={users.length} icon={<Users2 size={ICON_SIZE.lg} className="text-blue-600" />} iconBg="bg-blue-50" />
        <StatCard title="Staff (Admin/Staff)" value={staffCount} icon={<ShieldCheck size={ICON_SIZE.lg} className="text-purple-600" />} iconBg="bg-purple-50" />
        <StatCard title="Drivers" value={driverCount} icon={<Truck size={ICON_SIZE.lg} className="text-indigo-600" />} iconBg="bg-indigo-50" />
        <StatCard title="Customers" value={customerCount} icon={<ShoppingBag size={ICON_SIZE.lg} className="text-emerald-600" />} iconBg="bg-emerald-50" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center gap-3 p-4 border-b border-gray-100">
          <div className="relative max-w-md flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search users by name..." className="w-full pl-11 pr-4 py-3 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition placeholder:text-gray-400" />
          </div>
          <span className="text-xs text-gray-400 ml-auto shrink-0">{filtered.length} users</span>
        </div>

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
                      <span className="font-medium text-gray-900">{u.username}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4"><Badge label={roleLabel(u.role)} variant={u.role} /></td>
                  <td className="py-3 px-4 text-gray-500">{u.contact ?? "—"}</td>
                  <td className="py-3 px-4 text-gray-400 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center gap-1.5 justify-end">
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
                  <p className="text-xs text-gray-500 mt-1">{u.contact ?? "No contact on file"}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Joined {new Date(u.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
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

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">Page {page} of {totalPages}</p>
            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 rounded-lg text-xs font-medium transition ${p === page ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-100"}`}>{p}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete User?"
        body={<>Are you sure you want to delete <span className="font-medium text-gray-800">{deleteTarget?.username}</span>? This cannot be undone.</>}
        confirmLabel="Yes, Delete"
      />

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
              <label className="block text-xs font-medium text-gray-600 mb-1">Username</label>
              <input
                required disabled={!!editTarget} value={form.username}
                onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition disabled:bg-gray-50 disabled:text-gray-400"
                placeholder="Enter username" />
              {editTarget && <p className="text-[11px] text-gray-400 mt-1">Username can&apos;t be changed after creation.</p>}
            </div>
            {!editTarget && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
                <input required type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition" placeholder="Password" />
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
              <label className="block text-xs font-medium text-gray-600 mb-1">Contact <span className="text-gray-400">(optional)</span></label>
              <input value={form.contact} onChange={(e) => setForm((p) => ({ ...p, contact: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition" placeholder="Phone or email" />
            </div>
          </div>
          {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        </form>
      </Modal>
    </div>
  );
}
