"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL, TOKEN_STORAGE_KEY } from "@/app/constants/auth";

type EventItem = {
  id: number;
  title: string;
  description?: string | null;
  organizer?: string | null;
  participantLimit?: number | null;
  date: string;
  eventStart?: string | null;
  eventEnd?: string | null;
  location?: string | null;
  status?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type EventsDashboardProps = {
  mode: "active" | "archived";
};

function formatDateBr(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("pt-BR");
}

function isArchivedStatus(status?: string | null) {
  return status === "ARCHIVED";
}

function getNextStatus(status?: string | null) {
  return isArchivedStatus(status) ? "DRAFT" : "ARCHIVED";
}

function getStatusLabel(status?: string | null) {
  switch (status) {
    case "OPEN":
      return "Aberto";
    case "CLOSED":
      return "Fechado";
    case "ARCHIVED":
      return "Arquivado";
    case "DRAFT":
    default:
      return "Rascunho";
  }
}

function getStatusClasses(status?: string | null) {
  switch (status) {
    case "OPEN":
      return "border-green-300 bg-green-50 text-green-700";
    case "CLOSED":
      return "border-amber-300 bg-amber-50 text-amber-700";
    case "ARCHIVED":
      return "border-slate-300 bg-slate-100 text-slate-700";
    case "DRAFT":
    default:
      return "border-slate-300 bg-slate-100 text-slate-700";
  }
}

export default function EventsDashboard({ mode }: EventsDashboardProps) {
  const router = useRouter();
  const [eventos, setEventos] = useState<EventItem[]>([]);
  const [token, setToken] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [processingEventId, setProcessingEventId] = useState<number | null>(null);

  const archivedMode = mode === "archived";
  const pageTitle = archivedMode ? "Eventos arquivados" : "Lista de eventos";
  const emptyMessage = archivedMode
    ? "Nenhum evento arquivado."
    : "Nenhum evento encontrado.";

  useEffect(() => {
    const savedToken = window.localStorage.getItem(TOKEN_STORAGE_KEY) || "";

    if (!savedToken) {
      router.replace("/login");
      return;
    }

    setToken(savedToken);
    setAuthReady(true);
  }, [router]);

  useEffect(() => {
    if (!authReady || !token) {
      return;
    }

    let active = true;

    async function loadEvents() {
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

        if (active) {
          setEventos(data);
        }
      } catch (err) {
        if (!active) {
          return;
        }

        setError(err instanceof Error ? err.message : "Erro ao carregar eventos.");
        setEventos([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadEvents();

    return () => {
      active = false;
    };
  }, [authReady, router, token]);

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

  async function toggleArchive(evento: EventItem) {
    const nextStatus = getNextStatus(evento.status);

    setProcessingEventId(evento.id);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/admin/events/${evento.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: evento.title,
          description: evento.description ?? null,
          organizer: evento.organizer ?? null,
          participantLimit: evento.participantLimit ?? null,
          date: evento.date,
          eventStart: evento.eventStart ?? null,
          eventEnd: evento.eventEnd ?? null,
          location: evento.location ?? null,
          status: nextStatus,
        }),
      });

      if (response.status === 401) {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        router.replace("/login");
        return;
      }

      if (response.status === 403) {
        throw new Error("Somente administradores podem arquivar eventos.");
      }

      if (!response.ok) {
        let message = "Nao foi possivel atualizar o evento.";

        try {
          const body = (await response.json()) as { error?: string };
          if (body?.error) {
            message = body.error;
          }
        } catch {}

        throw new Error(message);
      }

      setEventos((current) =>
        current.map((item) =>
          item.id === evento.id
            ? {
                ...item,
                status: nextStatus,
              }
            : item
        )
      );

      setSuccessMessage(
        nextStatus === "ARCHIVED"
          ? "Evento arquivado com sucesso."
          : "Evento desarquivado com sucesso."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar evento.");
    } finally {
      setProcessingEventId(null);
    }
  }

  const visibleEvents = eventos.filter((evento) =>
    archivedMode ? isArchivedStatus(evento.status) : !isArchivedStatus(evento.status)
  );

  if (!authReady) {
    return <main className="min-h-screen bg-[#111318] text-white" />;
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <section className="mb-8 border-b border-slate-200 dark:border-slate-700 pb-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">{pageTitle}</h1>
              <p className="mt-2 text-base text-slate-500 dark:text-slate-400">
                {archivedMode
                  ? "Eventos arquivados ficam separados da dashboard principal."
                  : "Gerencie seus eventos e mova para arquivados quando necessario."}
              </p>
            </div>

            {!archivedMode ? (
              <button
                onClick={() => router.push("/eventos/novo")}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors shadow-sm"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 5v14m7-7H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Criar evento</span>
              </button>
            ) : null}
          </div>
        </section>

        {error ? <p className="mb-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">{error}</p> : null}
        {successMessage ? <p className="mb-4 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3">{successMessage}</p> : null}

        {loading ? <p className="text-sm text-slate-500 dark:text-slate-400">Carregando eventos...</p> : null}

        {!loading && visibleEvents.length === 0 ? (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center">
            <p className="text-base text-slate-500 dark:text-slate-400">{emptyMessage}</p>
          </div>
        ) : null}

        <section className="space-y-4">
          {visibleEvents.map((evento) => {
            const isProcessing = processingEventId === evento.id;
            const actionLabel = isArchivedStatus(evento.status) ? "Desarquivar" : "Arquivar";

            return (
              <article
                key={evento.id}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-3 flex-grow">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-block rounded-md border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200">
                        E{evento.id}
                      </span>
                      <span
                        className={`inline-block rounded-md border px-2.5 py-1 text-xs font-medium ${getStatusClasses(evento.status)}`}
                      >
                        {getStatusLabel(evento.status)}
                      </span>
                    </div>

                    <div>
                      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{evento.title}</h2>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                        <span className="font-medium">Data:</span> {formatDateBr(evento.date)} | <span className="font-medium">Criado em:</span> {formatDateBr(evento.createdAt)}
                      </p>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        <span className="font-medium">Local:</span> {evento.location || "Não informado"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-start gap-2">
                    <button
                      onClick={() => downloadReport(evento.id)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>Relatório</span>
                    </button>
                    <button
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors"
                      title="QR Code"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <rect x="3" y="3" width="8" height="8" stroke="currentColor" strokeWidth="1.5"/>
                        <rect x="13" y="3" width="8" height="8" stroke="currentColor" strokeWidth="1.5"/>
                        <rect x="3" y="13" width="8" height="8" stroke="currentColor" strokeWidth="1.5"/>
                        <rect x="15" y="15" width="4" height="4" stroke="currentColor" strokeWidth="1"/>
                      </svg>
                      <span>QR Code</span>
                    </button>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => router.push(`/eventos/${evento.id}`)}
                        className="rounded-lg border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900 hover:bg-blue-100 dark:hover:bg-blue-800 px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 transition-colors"
                      >
                        Abrir
                      </button>
                      <button
                        onClick={() => toggleArchive(evento)}
                        disabled={isProcessing}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900 hover:bg-amber-100 dark:hover:bg-amber-800 px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-300 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M4 7h16m-2 0v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7m3-3h6l1 3H8l1-3Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>{isProcessing ? "Salvando..." : actionLabel}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
