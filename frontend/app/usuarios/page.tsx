"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_BASE_URL, TOKEN_STORAGE_KEY } from "@/app/constants/auth";

type ManagedUser = {
  id: number;
  name: string;
  email: string;
  role: "ADMIN" | "STAFF";
  ownedEventsCount?: number;
  checkInActionsCount?: number;
};

type UserFormState = {
  name: string;
  email: string;
  role: "ADMIN" | "STAFF";
  password: string;
};

function getRoleLabel(role: string) {
  return role === "ADMIN" ? "Administrador" : "Staff";
}

export default function UsersPage() {
  const router = useRouter();
  const [token, setToken] = useState(() =>
    typeof window === "undefined" ? "" : window.localStorage.getItem(TOKEN_STORAGE_KEY) || ""
  );
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [forms, setForms] = useState<Record<number, UserFormState>>({});
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [movingToUserId, setMovingToUserId] = useState<number | null>(null);
  const [transferEventIdByUser, setTransferEventIdByUser] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const savedToken = window.localStorage.getItem(TOKEN_STORAGE_KEY) || "";
    if (!savedToken) {
      router.replace("/login");
      return;
    }

    setToken(savedToken);
  }, [router]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let active = true;

    async function loadUsers() {
      setLoading(true);
      setError("");

      try {
        const [meResponse, usersResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/me`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE_URL}/admin/users`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (meResponse.status === 401 || usersResponse.status === 401) {
          window.localStorage.removeItem(TOKEN_STORAGE_KEY);
          router.replace("/login");
          return;
        }

        if (usersResponse.status === 403) {
          throw new Error("Somente administradores podem gerenciar usuarios.");
        }

        if (!meResponse.ok || !usersResponse.ok) {
          throw new Error("Nao foi possivel carregar os usuarios.");
        }

        const me = (await meResponse.json()) as ManagedUser;
        const data = (await usersResponse.json()) as ManagedUser[];

        if (!active) {
          return;
        }

        setCurrentUserId(me.id);
        setUsers(data);
        setForms(
          data.reduce<Record<number, UserFormState>>((acc, user) => {
            acc[user.id] = {
              name: user.name,
              email: user.email,
              role: user.role,
              password: "",
            };
            return acc;
          }, {})
        );
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Erro ao carregar usuarios.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadUsers();

    return () => {
      active = false;
    };
  }, [router, token]);

  function updateForm(userId: number, field: keyof UserFormState, value: string) {
    setForms((current) => ({
      ...current,
      [userId]: {
        ...current[userId],
        [field]: value,
      },
    }));
  }

  async function saveUser(event: FormEvent<HTMLFormElement>, user: ManagedUser) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    const form = forms[user.id];
    if (!form) {
      return;
    }

    const trimmedName = form.name.trim();
    const trimmedEmail = form.email.trim();

    if (!trimmedName || !trimmedEmail) {
      setError("Nome e email sao obrigatorios.");
      return;
    }

    if (form.password && form.password.length < 6) {
      setError("A nova senha deve ter no minimo 6 caracteres.");
      return;
    }

    setSavingUserId(user.id);

    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/${user.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          role: form.role,
          password: form.password || null,
        }),
      });

      if (response.status === 401) {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        router.replace("/login");
        return;
      }

      if (response.status === 403) {
        throw new Error("Somente administradores podem atualizar usuarios.");
      }

      if (!response.ok) {
        let message = "Nao foi possivel salvar o usuario.";
        try {
          const body = (await response.json()) as { error?: string };
          if (body?.error) {
            message = body.error;
          }
        } catch {}
        throw new Error(message);
      }

      const updatedUser = (await response.json()) as ManagedUser;
      setUsers((current) =>
        current.map((item) =>
          item.id === updatedUser.id
            ? {
                ...item,
                ...updatedUser,
              }
            : item
        )
      );
      setForms((current) => ({
        ...current,
        [updatedUser.id]: {
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          password: "",
        },
      }));
      setSuccessMessage(`Usuario ${updatedUser.name} atualizado com sucesso.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar usuario.");
    } finally {
      setSavingUserId(null);
    }
  }

  async function moveEventToUser(targetUser: ManagedUser) {
    setError("");
    setSuccessMessage("");

    const rawEventId = (transferEventIdByUser[targetUser.id] || "").trim();
    const eventId = Number(rawEventId);

    if (!Number.isInteger(eventId) || eventId <= 0) {
      setError("Informe um ID de evento valido para mover.");
      return;
    }

    setMovingToUserId(targetUser.id);

    try {
      const response = await fetch(`${API_BASE_URL}/admin/events/${eventId}/owner`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetUserId: targetUser.id,
        }),
      });

      if (response.status === 401) {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        router.replace("/login");
        return;
      }

      if (response.status === 403) {
        throw new Error("Somente administradores podem mover eventos entre contas.");
      }

      if (!response.ok) {
        let message = "Nao foi possivel mover o evento.";
        try {
          const body = (await response.json()) as { error?: string };
          if (body?.error) {
            message = body.error;
          }
        } catch {}
        throw new Error(message);
      }

      setTransferEventIdByUser((current) => ({
        ...current,
        [targetUser.id]: "",
      }));

      setUsers((current) =>
        current.map((item) =>
          item.id === targetUser.id
            ? { ...item, ownedEventsCount: (item.ownedEventsCount ?? 0) + 1 }
            : item
        )
      );

      setSuccessMessage(`Evento E${eventId} movido para ${targetUser.name} com sucesso.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao mover evento.");
    } finally {
      setMovingToUserId(null);
    }
  }

  return (
    <main className="theme-page">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Usuarios</h1>
            <p className="theme-muted mt-2 text-sm">
              Gerencie permissoes, email de acesso e redefinicao de senha.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/contas/nova" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              Criar conta
            </Link>
            <Link href="/" className="theme-secondary-button rounded-md px-4 py-2 text-sm">
              Voltar
            </Link>
          </div>
        </div>

        {error ? <p className="theme-error-message mb-4 rounded-lg p-3 text-sm">{error}</p> : null}
        {successMessage ? <p className="theme-success-message mb-4 rounded-lg p-3 text-sm">{successMessage}</p> : null}
        {loading ? <p className="theme-muted text-sm">Carregando usuarios...</p> : null}

        {!loading ? (
          <section className="space-y-4">
            {users.map((user) => {
              const form = forms[user.id];
              const isCurrentUser = user.id === currentUserId;
              const isSaving = savingUserId === user.id;

              return (
                <article key={user.id} className="theme-panel rounded-lg p-5 shadow-sm">
                  <form onSubmit={(event) => saveUser(event, user)} className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-semibold">{user.name}</h2>
                          <span className="rounded-md border border-slate-300 bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200">
                            {getRoleLabel(user.role)}
                          </span>
                          {isCurrentUser ? (
                            <span className="rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 dark:border-blue-700 dark:bg-blue-900 dark:text-blue-200">
                              Sua conta
                            </span>
                          ) : null}
                        </div>
                        <p className="theme-muted mt-1 text-sm">
                          {user.ownedEventsCount ?? 0} eventos | {user.checkInActionsCount ?? 0} acoes de check-in
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label htmlFor={`name-${user.id}`} className="theme-label mb-2 block text-sm font-medium">
                          Nome
                        </label>
                        <input
                          id={`name-${user.id}`}
                          value={form?.name ?? ""}
                          disabled={isCurrentUser}
                          onChange={(event) => updateForm(user.id, "name", event.target.value)}
                          className="theme-input w-full rounded-lg px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </div>

                      <div>
                        <label htmlFor={`email-${user.id}`} className="theme-label mb-2 block text-sm font-medium">
                          Email de login
                        </label>
                        <input
                          id={`email-${user.id}`}
                          type="email"
                          value={form?.email ?? ""}
                          disabled={isCurrentUser}
                          onChange={(event) => updateForm(user.id, "email", event.target.value)}
                          className="theme-input w-full rounded-lg px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </div>

                      <div>
                        <label htmlFor={`role-${user.id}`} className="theme-label mb-2 block text-sm font-medium">
                          Permissao
                        </label>
                        <select
                          id={`role-${user.id}`}
                          value={form?.role ?? user.role}
                          disabled={isCurrentUser}
                          onChange={(event) => updateForm(user.id, "role", event.target.value as UserFormState["role"])}
                          className="theme-input w-full rounded-lg px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="ADMIN">Administrador</option>
                          <option value="STAFF">Staff</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor={`password-${user.id}`} className="theme-label mb-2 block text-sm font-medium">
                          Nova senha
                        </label>
                        <input
                          id={`password-${user.id}`}
                          type="password"
                          value={form?.password ?? ""}
                          disabled={isCurrentUser}
                          onChange={(event) => updateForm(user.id, "password", event.target.value)}
                          placeholder="Deixe vazio para manter"
                          className="theme-input w-full rounded-lg px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isCurrentUser || isSaving}
                        className="rounded-lg border border-green-700 bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSaving ? "Salvando..." : "Salvar usuario"}
                      </button>
                    </div>
                  </form>

                  <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
                    <p className="theme-label mb-2 text-sm font-medium">Mover evento para esta conta</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        value={transferEventIdByUser[user.id] ?? ""}
                        onChange={(event) =>
                          setTransferEventIdByUser((current) => ({
                            ...current,
                            [user.id]: event.target.value,
                          }))
                        }
                        placeholder="ID do evento (ex: 12)"
                        className="theme-input w-full max-w-xs rounded-lg px-4 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => moveEventToUser(user)}
                        disabled={movingToUserId === user.id}
                        className="rounded-lg border border-indigo-700 bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {movingToUserId === user.id ? "Movendo..." : "Mover evento"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        ) : null}
      </div>
    </main>
  );
}
