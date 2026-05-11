"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_BASE_URL, TOKEN_STORAGE_KEY } from "@/app/constants/auth";

type CreateStaffResponse = {
  id: number;
  name: string;
  email: string;
  role: string;
};

export default function NewAccountPage() {
  const router = useRouter();
  const [token] = useState(() =>
    typeof window === "undefined" ? "" : window.localStorage.getItem(TOKEN_STORAGE_KEY) || ""
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "STAFF">("STAFF");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [createdAccount, setCreatedAccount] = useState<CreateStaffResponse | null>(null);

  useEffect(() => {
    if (!token) {
      router.replace("/login");
    }
  }, [router, token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");
    setCreatedAccount(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedEmail || !password) {
      setError("Nome, email e senha sao obrigatorios.");
      return;
    }

    if (password.length < 6) {
      setError("A senha deve ter no minimo 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("A confirmacao da senha nao confere.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}${role === "ADMIN" ? "/admin/users/client" : "/admin/users/staff"}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          password,
        }),
      });

      if (response.status === 401) {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        router.replace("/login");
        return;
      }

      if (response.status === 403) {
        throw new Error("Somente administradores podem criar contas.");
      }

      if (!response.ok) {
        let message = "Nao foi possivel criar a conta.";
        try {
          const body = (await response.json()) as { error?: string };
          if (body?.error) {
            message = body.error;
          }
        } catch {}
        throw new Error(message);
      }

      const data = (await response.json()) as CreateStaffResponse;
      setCreatedAccount(data);
      setSuccessMessage("Conta criada com sucesso.");
      setName("");
      setEmail("");
      setRole("STAFF");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar conta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="theme-page">
      <div className="mx-auto max-w-2xl px-4 py-6 md:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Criar conta</h1>
            <p className="theme-muted mt-2 text-sm">
              Cadastre uma conta e defina o nivel de permissao.
            </p>
          </div>
          <Link href="/" className="theme-secondary-button rounded-md px-4 py-2 text-sm">
            Voltar
          </Link>
        </div>

        {error ? <p className="theme-error-message mb-4 rounded-lg p-3 text-sm">{error}</p> : null}
        {successMessage ? (
          <p className="theme-success-message mb-4 rounded-lg p-3 text-sm">
            {successMessage}
            {createdAccount ? ` Usuario: ${createdAccount.name} (${createdAccount.email}).` : ""}
          </p>
        ) : null}

        <section className="theme-panel rounded-2xl p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="name" className="theme-label mb-2 block text-sm font-medium">
                Nome
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="theme-input w-full rounded-lg px-4 py-2 text-sm"
                placeholder="Nome da pessoa"
              />
            </div>

            <div>
              <label htmlFor="email" className="theme-label mb-2 block text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="theme-input w-full rounded-lg px-4 py-2 text-sm"
                placeholder="pessoa@empresa.com"
              />
            </div>

            <div>
              <label htmlFor="role" className="theme-label mb-2 block text-sm font-medium">
                Permissao
              </label>
              <select
                id="role"
                value={role}
                onChange={(event) => setRole(event.target.value as "ADMIN" | "STAFF")}
                className="theme-input w-full rounded-lg px-4 py-2 text-sm"
              >
                <option value="STAFF">Staff</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="password" className="theme-label mb-2 block text-sm font-medium">
                  Senha
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="theme-input w-full rounded-lg px-4 py-2 text-sm"
                  placeholder="Minimo de 6 caracteres"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="theme-label mb-2 block text-sm font-medium">
                  Confirmar senha
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="theme-input w-full rounded-lg px-4 py-2 text-sm"
                  placeholder="Repita a senha"
                />
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <Link href="/" className="theme-secondary-button rounded-lg px-6 py-2 text-sm font-semibold">
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg border border-green-700 bg-green-600 px-6 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Criando..." : "Criar conta"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
