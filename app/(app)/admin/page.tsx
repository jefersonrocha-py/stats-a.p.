"use client";

import { useEffect, useMemo, useState } from "react";
import { buildApiHeaders } from "@services/api";
import { PASSWORD_POLICY_HINT } from "@lib/validatorsAuth";

type UserRole = "SUPERADMIN" | "ADMIN" | "USER";
type UserStatus = "ACTIVE" | "BLOCKED" | "SUSPENDED";

type User = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  isBlocked: boolean;
  suspendedUntil: string | null;
  createdAt: string;
};

type Feedback = {
  kind: "error" | "success";
  message: string;
} | null;

const EMPTY_FORM = { name: "", email: "", password: "", role: "USER" as UserRole };

function formatApiError(payload: any, fallback: string) {
  const detailMessage = payload?.details?.[0]?.message;
  if (typeof detailMessage === "string" && detailMessage.trim()) {
    return detailMessage;
  }

  switch (payload?.error) {
    case "EMAIL_TAKEN":
      return "Ja existe um usuario com este email.";
    case "CANNOT_MUTATE_SELF":
      return "Nao e permitido bloquear ou suspender o proprio usuario.";
    case "CANNOT_DELETE_SELF":
      return "Nao e permitido excluir o proprio usuario.";
    case "LAST_ACTIVE_SUPERADMIN":
      return "Precisa existir ao menos um superadmin ativo no sistema.";
    case "USER_NOT_FOUND":
      return "Usuario nao encontrado.";
    case "FORBIDDEN":
      return "Apenas superadmin pode administrar usuarios.";
    default:
      return fallback;
  }
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toDateTimeLocalValue(date: Date) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getDefaultSuspensionValue() {
  return toDateTimeLocalValue(new Date(Date.now() + 24 * 60 * 60_000));
}

function getStatusBadge(user: User) {
  if (user.status === "BLOCKED") {
    return { className: "bg-rose-500/15 text-rose-700 dark:text-rose-300", label: "Bloqueado" };
  }
  if (user.status === "SUSPENDED") {
    return { className: "bg-amber-500/15 text-amber-700 dark:text-amber-300", label: "Suspenso" };
  }
  return { className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", label: "Ativo" };
}

export default function AdminPage() {
  const [items, setItems] = useState<User[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [rowBusyId, setRowBusyId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [suspendDrafts, setSuspendDrafts] = useState<Record<number, string>>({});
  const [form, setForm] = useState(EMPTY_FORM);

  async function load() {
    const response = await fetch("/api/users", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setFeedback({
        kind: "error",
        message: formatApiError(payload, "Nao foi possivel carregar os usuarios."),
      });
      return;
    }

    setItems(payload?.items ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const query = q.toLowerCase();
    return items.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.role.toLowerCase().includes(query) ||
        user.status.toLowerCase().includes(query)
    );
  }, [items, q]);

  async function createUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/users", {
        body: JSON.stringify(form),
        headers: buildApiHeaders(undefined, "POST"),
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFeedback({
          kind: "error",
          message: formatApiError(payload, "Falha ao criar usuario."),
        });
        return;
      }

      setForm(EMPTY_FORM);
      setFeedback({ kind: "success", message: "Usuario criado com sucesso." });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function mutateUser(
    userId: number,
    init: RequestInit,
    successMessage: string,
    fallbackMessage: string
  ) {
    setRowBusyId(userId);
    setFeedback(null);
    try {
      const response = await fetch(`/api/users/${userId}`, init);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFeedback({
          kind: "error",
          message: formatApiError(payload, fallbackMessage),
        });
        return;
      }

      setFeedback({ kind: "success", message: successMessage });
      await load();
    } finally {
      setRowBusyId(null);
    }
  }

  async function handleActivate(userId: number) {
    await mutateUser(
      userId,
      {
        body: JSON.stringify({ action: "ACTIVATE" }),
        headers: buildApiHeaders(undefined, "PATCH"),
        method: "PATCH",
      },
      "Usuario reativado com sucesso.",
      "Nao foi possivel reativar o usuario."
    );
  }

  async function handleBlock(user: User) {
    const confirmed = window.confirm(`Bloquear o acesso de ${user.email}?`);
    if (!confirmed) return;

    await mutateUser(
      user.id,
      {
        body: JSON.stringify({ action: "BLOCK" }),
        headers: buildApiHeaders(undefined, "PATCH"),
        method: "PATCH",
      },
      "Usuario bloqueado com sucesso.",
      "Nao foi possivel bloquear o usuario."
    );
  }

  async function handleSuspend(user: User) {
    const draft = suspendDrafts[user.id] ?? getDefaultSuspensionValue();
    const suspensionDate = new Date(draft);

    if (Number.isNaN(suspensionDate.getTime())) {
      setFeedback({ kind: "error", message: "Informe uma data de suspensao valida." });
      return;
    }

    await mutateUser(
      user.id,
      {
        body: JSON.stringify({
          action: "SUSPEND",
          suspendedUntil: suspensionDate.toISOString(),
        }),
        headers: buildApiHeaders(undefined, "PATCH"),
        method: "PATCH",
      },
      "Usuario suspenso com sucesso.",
      "Nao foi possivel suspender o usuario."
    );
  }

  async function handleDelete(user: User) {
    const confirmed = window.confirm(`Excluir permanentemente o usuario ${user.email}?`);
    if (!confirmed) return;

    await mutateUser(
      user.id,
      {
        headers: buildApiHeaders(undefined, "DELETE"),
        method: "DELETE",
      },
      "Usuario excluido com sucesso.",
      "Nao foi possivel excluir o usuario."
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Painel Administrador</h1>
        <p className="text-sm opacity-75">
          Crie usuarios, aplique bloqueio permanente, suspensao temporaria e exclusao.
        </p>
      </div>

      {feedback && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            feedback.kind === "error"
              ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="glass rounded-2xl p-4">
        <form onSubmit={createUser} className="grid gap-3 md:grid-cols-5">
          <input
            className="surface-field rounded-xl px-3 py-2"
            placeholder="Nome"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
          />
          <input
            className="surface-field rounded-xl px-3 py-2"
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            required
          />
          <input
            className="surface-field rounded-xl px-3 py-2"
            placeholder="Senha"
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            required
          />
          <select
            className="surface-field rounded-xl px-3 py-2"
            value={form.role}
            onChange={(event) => setForm({ ...form, role: event.target.value as UserRole })}
          >
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
            <option value="SUPERADMIN">SUPERADMIN</option>
          </select>
          <button
            className="rounded-xl bg-brand1 px-3 py-2 text-white hover:opacity-90 disabled:opacity-60"
            disabled={busy}
            type="submit"
          >
            {busy ? "Criando..." : "Criar usuario"}
          </button>
        </form>
        <p className="mt-3 text-xs opacity-70">Politica de senha: {PASSWORD_POLICY_HINT}</p>
      </div>

      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <input
            placeholder="Buscar por nome, email, role ou status..."
            className="surface-field w-full rounded-xl px-3 py-2 md:w-96"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
          <div className="text-xs opacity-70">{filtered.length} usuario(s)</div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-black/5 dark:bg-white/10">
              <tr>
                <th className="p-2 text-left">Nome</th>
                <th className="p-2 text-left">Email</th>
                <th className="p-2 text-left">Role</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Suspenso ate</th>
                <th className="p-2 text-left">Criado em</th>
                <th className="p-2 text-left">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => {
                const badge = getStatusBadge(user);
                const busyRow = rowBusyId === user.id;
                const suspensionValue = suspendDrafts[user.id] ?? getDefaultSuspensionValue();

                return (
                  <tr key={user.id} className="border-t border-black/10 align-top dark:border-white/10">
                    <td className="p-2 font-medium">{user.name}</td>
                    <td className="p-2">{user.email}</td>
                    <td className="p-2">{user.role}</td>
                    <td className="p-2">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="p-2 text-xs opacity-80">
                      {user.suspendedUntil ? new Date(user.suspendedUntil).toLocaleString() : "-"}
                    </td>
                    <td className="p-2 text-xs opacity-70">
                      {new Date(user.createdAt).toLocaleString()}
                    </td>
                    <td className="p-2">
                      <div className="flex min-w-[360px] flex-col gap-2">
                        <div className="flex flex-wrap gap-2">
                          {user.status === "ACTIVE" ? (
                            <>
                              <button
                                type="button"
                                className="rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs text-rose-700 disabled:opacity-50 dark:text-rose-300"
                                disabled={busyRow}
                                onClick={() => void handleBlock(user)}
                              >
                                Bloquear
                              </button>
                              <button
                                type="button"
                                className="rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs text-amber-700 disabled:opacity-50 dark:text-amber-300"
                                disabled={busyRow}
                                onClick={() => void handleSuspend(user)}
                              >
                                Suspender
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="rounded-lg border border-emerald-500/30 px-3 py-1.5 text-xs text-emerald-700 disabled:opacity-50 dark:text-emerald-300"
                              disabled={busyRow}
                              onClick={() => void handleActivate(user.id)}
                            >
                              Reativar
                            </button>
                          )}

                          <button
                            type="button"
                            className="rounded-lg border border-black/15 px-3 py-1.5 text-xs disabled:opacity-50 dark:border-white/15"
                            disabled={busyRow}
                            onClick={() => void handleDelete(user)}
                          >
                            Excluir
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            className="surface-field rounded-lg px-3 py-1.5 text-xs"
                            type="datetime-local"
                            value={suspensionValue}
                            onChange={(event) =>
                              setSuspendDrafts((current) => ({
                                ...current,
                                [user.id]: event.target.value,
                              }))
                            }
                          />
                          <span className="text-xs opacity-60">
                            Defina quando a suspensao temporaria termina.
                          </span>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center opacity-60">
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
