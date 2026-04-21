"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL, TOKEN_STORAGE_KEY } from "@/app/constants/auth";

type EventItem = {
  id: number;
  title: string;
  date: string;
  createdAt?: string;
};

function formatDateBr(value?: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("pt-BR");
}

export default function Home() {
  const router = useRouter();
  const [eventos, setEventos] = useState<EventItem[]>([]);
  const [token, setToken] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const savedToken = window.localStorage.getItem(TOKEN_STORAGE_KEY) || "";

    if (!savedToken) {
      router.replace("/login");
      return;
    }

    setToken(savedToken);
    setAuthReady(true);
  }, [router]);

  const loadEvents = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/events`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401 || response.status === 403) {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        throw new Error("Nao foi possivel carregar os eventos.");
      }

      const data = (await response.json()) as EventItem[];
      setEventos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar eventos.");
      setEventos([]);
    } finally {
      setLoading(false);
    }
  }, [router, token]);

  useEffect(() => {
    if (!authReady || !token) {
      return;
    }
    loadEvents();
  }, [authReady, loadEvents, token]);

  async function downloadReport(eventId: number) {
    try {
      const response = await fetch(`${API_BASE_URL}/events/${eventId}/report.csv`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401 || response.status === 403) {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        throw new Error("Falha ao baixar relatorio.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || `relatorio_evento_${eventId}.csv`;

      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao baixar relatorio.");
    }
  }

  function logout() {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    router.replace("/login");
  }

  if (!authReady) {
    return <main className="min-h-screen bg-[#111318] text-white" />;
  }

  return (
    <main className="min-h-screen bg-[#111318] text-white">
      <div className="mx-auto max-w-6xl px-4 py-5 md:px-6">
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="rounded-md border border-[#2f61ff] bg-[#1b2f7a] px-4 py-2 text-sm font-medium text-[#dbe6ff] hover:bg-[#203a95]">
              Home
            </button>
            <span className="text-sm text-[#8f96a8]">Eventos</span>
          </div>

          <button
            onClick={logout}
            aria-label="Perfil do usuario"
            title="Sair"
            className="flex h-10 items-center justify-center rounded-full border border-[#2f61ff] bg-[#1b2f7a] px-3 text-sm font-semibold text-[#dbe6ff] hover:bg-[#203a95]"
          >
            Perfil
          </button>
        </header>

        <section className="mb-6 border-t border-[#2a3040] pt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">Lista de eventos</h1>
            <button
              onClick={() => router.push("/eventos/novo")}
              className="inline-flex items-center gap-2 rounded-md border border-[#2f9e5f] bg-[#1d6a3f] px-5 py-2 text-sm font-semibold text-[#ddf7e7] hover:bg-[#247a4a]"
            >
              <span aria-hidden="true" className="text-base leading-none">+</span>
              <span>Criar evento</span>
            </button>
          </div>
        </section>

        {error ? <p className="mb-4 text-sm text-[#f5a5a5]">{error}</p> : null}

        {loading ? <p className="text-sm text-[#b8bfd1]">Carregando eventos...</p> : null}

        {!loading && eventos.length === 0 ? (
          <div className="rounded-xl border border-[#2c313d] bg-[#1a1d24] p-5 text-sm text-[#b8bfd1]">
            Nenhum evento encontrado.
          </div>
        ) : null}

        <section className="space-y-4">
          {eventos.map((evento) => (
            <article
              key={evento.id}
              className="rounded-2xl border border-[#2c313d] bg-[#1a1d24] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.22)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="mb-2 inline-block rounded-md border border-[#4a5060] bg-[#222631] px-2 py-1 text-xs text-[#bcc3d3]">
                    E{evento.id}
                  </span>
                  <h2 className="text-lg font-semibold">{evento.title}</h2>
                  <p className="text-sm text-[#9ba2b3]">Criado em {formatDateBr(evento.createdAt)}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => downloadReport(evento.id)}
                    className="inline-flex items-center gap-2 rounded-md border border-[#3f4658] bg-[#232834] px-4 py-2 text-sm text-[#d3d8e4] hover:bg-[#2a3040]"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>Baixar relatorio</span>
                  </button>
                  <button
                    onClick={() => router.push(`/eventos/${evento.id}`)}
                    className="rounded-md border border-[#2f61ff] bg-[#1b2f7a] px-4 py-2 text-sm text-[#dbe6ff] hover:bg-[#203a95]"
                  >
                    Selecionar
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
