"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL, TOKEN_STORAGE_KEY } from "@/app/constants/auth";

type LoginResponse = {
  token: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (token) {
      router.replace("/");
    }
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        let message = "Falha no login.";
        try {
          const data = (await response.json()) as { error?: string };
          if (data?.error) {
            message = data.error;
          }
        } catch {}

        if (response.status === 401) {
          message = "Email ou senha invalidos.";
        }

        throw new Error(message);
      }

      const data = (await response.json()) as LoginResponse;
      window.localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      router.replace("/");
    } catch (err) {
      if (err instanceof TypeError) {
        setError(`Nao foi possivel conectar ao backend em ${API_BASE_URL}. Verifique se ele esta rodando na porta 3001.`);
      } else {
        setError(err instanceof Error ? err.message : "Falha no login.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#111318] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
        <section className="w-full rounded-2xl border border-[#2c313d] bg-[#1a1d24] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
          <h1 className="mb-2 text-2xl font-semibold">Entrar</h1>
          <p className="mb-6 text-sm text-[#9ba2b3]">Acesse o painel de credenciamento.</p>
          <p className="mb-6 text-xs text-[#7f879b]">API: {API_BASE_URL}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm text-[#c5ccdb]">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-md border border-[#3f4658] bg-[#232834] px-3 py-2 text-sm text-[#dbe0ec] outline-none focus:border-[#4e70ff]"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm text-[#c5ccdb]">
                Senha
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-md border border-[#3f4658] bg-[#232834] px-3 py-2 text-sm text-[#dbe0ec] outline-none focus:border-[#4e70ff]"
              />
            </div>

            {error ? <p className="text-sm text-[#f5a5a5]">{error}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md border border-[#2f61ff] bg-[#1b2f7a] px-4 py-2 text-sm font-semibold text-[#dbe6ff] hover:bg-[#203a95] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
