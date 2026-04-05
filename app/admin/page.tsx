"use client";

import { useState, useEffect, useCallback } from "react";
import LogoutButton from "@/components/LogoutButton";

type User = { id: number; username: string; role: string; contact: string | null; createdAt: string };
type Product = { id: number; name: string; category: string; price: number; stock: number; barcode: string | null };
type TransactionItem = { id: number; quantity: number; price: number; product: { name: string } };
type Transaction = { id: number; totalAmount: number; paymentMethod: string; dateTime: string; type: string; user: { username: string }; items: TransactionItem[] };

const TABS = ["Users", "Products", "Transactions"] as const;
type Tab = typeof TABS[number];

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("Users");
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // User form
  const [userForm, setUserForm] = useState({ username: "", password: "", role: "customer", contact: "" });
  // Product form
  const [productForm, setProductForm] = useState({ id: 0, name: "", category: "", price: "", stock: "", barcode: "" });
  const [editingProduct, setEditingProduct] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/users");
    setUsers(await res.json());
    setLoading(false);
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/products");
    setProducts(await res.json());
    setLoading(false);
  }, []);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/transactions");
    setTransactions(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "Users") fetchUsers();
    else if (tab === "Products") fetchProducts();
    else fetchTransactions();
  }, [tab, fetchUsers, fetchProducts, fetchTransactions]);

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userForm),
    });
    if (!res.ok) { setError((await res.json()).error); return; }
    setUserForm({ username: "", password: "", role: "customer", contact: "" });
    fetchUsers();
  }

  async function handleDeleteUser(id: number) {
    if (!confirm("Delete this user?")) return;
    await fetch("/api/users", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    fetchUsers();
  }

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const method = editingProduct ? "PUT" : "POST";
    const res = await fetch("/api/products", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...productForm, price: Number(productForm.price), stock: Number(productForm.stock) }),
    });
    if (!res.ok) { setError((await res.json()).error); return; }
    setProductForm({ id: 0, name: "", category: "", price: "", stock: "", barcode: "" });
    setEditingProduct(false);
    fetchProducts();
  }

  async function handleDeleteProduct(id: number) {
    if (!confirm("Delete this product?")) return;
    await fetch("/api/products", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    fetchProducts();
  }

  function startEditProduct(p: Product) {
    setProductForm({ id: p.id, name: p.name, category: p.category, price: String(p.price), stock: String(p.stock), barcode: p.barcode || "" });
    setEditingProduct(true);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
            <p className="text-gray-500 text-sm">Manage your hardware store</p>
          </div>
          <LogoutButton />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(""); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        {loading && <p className="text-gray-400 text-sm">Loading...</p>}

        {/* USERS TAB */}
        {tab === "Users" && (
          <div className="space-y-6">
            <form onSubmit={handleAddUser} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 grid grid-cols-2 gap-3">
              <h2 className="col-span-2 font-semibold text-gray-700">Add New User</h2>
              <input required placeholder="Username" value={userForm.username} onChange={e => setUserForm(p => ({ ...p, username: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input required placeholder="Password" type="password" value={userForm.password} onChange={e => setUserForm(p => ({ ...p, password: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <select value={userForm.role} onChange={e => setUserForm(p => ({ ...p, role: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="customer">Customer</option>
                <option value="cashier">Cashier</option>
                <option value="admin">Admin</option>
              </select>
              <input placeholder="Contact (optional)" value={userForm.contact} onChange={e => setUserForm(p => ({ ...p, contact: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="submit" className="col-span-2 bg-blue-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-blue-700 transition">Add User</button>
            </form>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Username</th>
                    <th className="px-4 py-3 text-left">Role</th>
                    <th className="px-4 py-3 text-left">Contact</th>
                    <th className="px-4 py-3 text-left">Created</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{u.username}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.role === "admin" ? "bg-purple-100 text-purple-700" : u.role === "cashier" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>{u.role}</span></td>
                      <td className="px-4 py-3 text-gray-500">{u.contact || "—"}</td>
                      <td className="px-4 py-3 text-gray-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right"><button onClick={() => handleDeleteUser(u.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PRODUCTS TAB */}
        {tab === "Products" && (
          <div className="space-y-6">
            <form onSubmit={handleSaveProduct} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 grid grid-cols-2 gap-3">
              <h2 className="col-span-2 font-semibold text-gray-700">{editingProduct ? "Edit Product" : "Add New Product"}</h2>
              <input required placeholder="Product name" value={productForm.name} onChange={e => setProductForm(p => ({ ...p, name: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input required placeholder="Category" value={productForm.category} onChange={e => setProductForm(p => ({ ...p, category: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input required placeholder="Price" type="number" min="0" step="0.01" value={productForm.price} onChange={e => setProductForm(p => ({ ...p, price: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input required placeholder="Stock" type="number" min="0" value={productForm.stock} onChange={e => setProductForm(p => ({ ...p, stock: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input placeholder="Barcode (optional)" value={productForm.barcode} onChange={e => setProductForm(p => ({ ...p, barcode: e.target.value }))} className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="col-span-2 flex gap-2">
                <button type="submit" className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-blue-700 transition">{editingProduct ? "Save Changes" : "Add Product"}</button>
                {editingProduct && <button type="button" onClick={() => { setEditingProduct(false); setProductForm({ id: 0, name: "", category: "", price: "", stock: "", barcode: "" }); }} className="px-4 bg-gray-200 text-gray-700 rounded-lg py-2 text-sm font-semibold hover:bg-gray-300 transition">Cancel</button>}
              </div>
            </form>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-left">Price</th>
                    <th className="px-4 py-3 text-left">Stock</th>
                    <th className="px-4 py-3 text-left">Barcode</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {products.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                      <td className="px-4 py-3 text-gray-500">{p.category}</td>
                      <td className="px-4 py-3 text-gray-700">₱{p.price.toFixed(2)}</td>
                      <td className="px-4 py-3"><span className={`font-medium ${p.stock <= 5 ? "text-red-500" : "text-gray-700"}`}>{p.stock}</span></td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{p.barcode || "—"}</td>
                      <td className="px-4 py-3 text-right flex gap-2 justify-end">
                        <button onClick={() => startEditProduct(p)} className="text-blue-500 hover:text-blue-700 text-xs font-medium">Edit</button>
                        <button onClick={() => handleDeleteProduct(p.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TRANSACTIONS TAB */}
        {tab === "Transactions" && (
          <div className="space-y-3">
            {transactions.map(t => (
              <div key={t.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-semibold text-gray-800">#{t.id}</span>
                    <span className="ml-2 text-xs text-gray-400">{new Date(t.dateTime).toLocaleString()}</span>
                    <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{t.type}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-800">₱{t.totalAmount.toFixed(2)}</p>
                    <p className="text-xs text-gray-400">{t.paymentMethod} · {t.user.username}</p>
                  </div>
                </div>
                <div className="text-xs text-gray-500 space-y-0.5">
                  {t.items.map(i => (
                    <div key={i.id} className="flex justify-between">
                      <span>{i.product.name} × {i.quantity}</span>
                      <span>₱{(i.price * i.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {transactions.length === 0 && !loading && <p className="text-gray-400 text-sm text-center py-8">No transactions yet.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
