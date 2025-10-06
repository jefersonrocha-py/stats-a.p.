"use client";

import { useEffect, useMemo, useState } from "react";

type User = {
  id: number;
  name: string;
  email: string;
  role: "SUPERADMIN" | "ADMIN" | "USER";
  createdAt: string;
};

export default function AdminPage() {
  const [items, setItems] = useState<User[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "USER" });

  async function load() {
    const r = await fetch("/api/users", { cache: "no-store" });
    if (!r.ok) {
      alert("Acesso negado. Apenas superadmin.");
      return;
    }
    const j = await r.json();
    setItems(j?.items ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const x = q.toLowerCase();
    return items.filter(
      (u) =>
        u.name.toLowerCase().includes(x) ||
        u.email.toLowerCase().includes(x) ||
        (u.role || "").toLowerCase().includes(x)
    );
  }, [items, q]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        alert(j?.error || "Falha ao criar usuário");
        return;
      }
      setForm({ name: "", email: "", password: "", role: "USER" });
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Painel Administrador</h1>

      {/* Criar usuário */}
      <div className="glass rounded-2xl p-4">
        <form onSubmit={createUser} className="grid md:grid-cols-5 gap-2">
          <input
            className="px-3 py-2 rounded bg-white/70 dark:bg-white/5"
            placeholder="Nome"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            className="px-3 py-2 rounded bg-white/70 dark:bg-white/5"
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <input
            className="px-3 py-2 rounded bg-white/70 dark:bg-white/5"
            placeholder="Senha"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          <select
            className="px-3 py-2 rounded bg-white/70 dark:bg-white/5"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
            <option value="SUPERADMIN">SUPERADMIN</option>
          </select>
          <button className="px-3 py-2 rounded bg-brand1 text-white hover:opacity-90" disabled={busy}>
            {busy ? "Criando..." : "Criar"}
          </button>
        </form>
      </div>

      {/* Lista de usuários */}
      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="flex justify-between gap-2">
          <input
            placeholder="Buscar por nome/email/role..."
            className="px-3 py-2 rounded bg-white/70 dark:bg-white/5 w-full md:w-96"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-black/5 dark:bg-white/10">
              <tr>
                <th className="text-left p-2">Nome</th>
                <th className="text-left p-2">Email</th>
                <th className="text-left p-2">Role</th>
                <th className="text-left p-2">Criado em</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-t border-black/10 dark:border-white/10">
                  <td className="p-2">{u.name}</td>
                  <td className="p-2">{u.email}</td>
                  <td className="p-2">{u.role}</td>
                  <td className="p-2 text-xs opacity-70">{new Date(u.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-center opacity-60">
                    Sem resultados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
