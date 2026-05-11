"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_BASE_URL, TOKEN_STORAGE_KEY } from "@/app/constants/auth";

export default function NewEventPage() {
  const router = useRouter();
  const [token, setToken] = useState(() =>
    typeof window === "undefined" ? "" : window.localStorage.getItem(TOKEN_STORAGE_KEY) || ""
  );
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    organizer: "",
    date: "",
    eventStart: "",
    eventEnd: "",
    location: "",
    status: "OPEN",
    hasParticipantLimit: false,
    participantLimit: "",
  });

  useEffect(() => {
    const savedToken = window.localStorage.getItem(TOKEN_STORAGE_KEY) || "";
    if (!savedToken) {
      router.replace("/login");
      return;
    }
    setToken(savedToken);
    setAuthReady(true);
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!formData.title.trim() || !formData.date.trim()) {
      setError("Nome do evento e data sao obrigatorios.");
      return;
    }

    if (formData.hasParticipantLimit) {
      const limitNumber = Number(formData.participantLimit);
      if (!Number.isInteger(limitNumber) || limitNumber <= 0) {
        setError("Informe um limite de participantes valido.");
        return;
      }
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/admin/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          organizer: formData.organizer.trim() || null,
          date: formData.date,
          eventStart: formData.eventStart || null,
          eventEnd: formData.eventEnd || null,
          location: formData.location.trim() || null,
          status: formData.status,
          participantLimit: formData.hasParticipantLimit ? Number(formData.participantLimit) : null,
        }),
      });

      if (response.status === 401) {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        router.replace("/login");
        return;
      }

      if (response.status === 403) {
        throw new Error("Sua conta nao tem permissao para criar eventos.");
      }

      if (!response.ok) {
        let message = "Nao foi possivel criar o evento.";
        try {
          const body = (await response.json()) as { error?: string };
          if (body?.error) {
            message = body.error;
          }
        } catch {}
        throw new Error(message);
      }

      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar evento.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="theme-page">
      <div className="mx-auto max-w-3xl px-4 py-6 md:px-6">
        <div className="mb-6">
          <Link href="/" className="theme-secondary-button rounded-md px-4 py-2 text-sm">
            Voltar para dashboard
          </Link>
        </div>

        <section className="theme-panel rounded-2xl p-6">
          <h1 className="mb-5 text-2xl font-semibold">Criacao de evento</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="title" className="theme-label mb-1 block text-sm font-semibold tracking-wide">
                Nome do evento
              </label>
              <input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                className="theme-input w-full rounded-md px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label htmlFor="description" className="theme-label mb-1 block text-sm font-semibold tracking-wide">
                Descricao
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                rows={4}
                className="theme-input w-full rounded-md px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label htmlFor="organizer" className="theme-label mb-1 block text-sm font-semibold tracking-wide">
                Organizacao responsavel
              </label>
              <input
                id="organizer"
                value={formData.organizer}
                onChange={(e) => setFormData((prev) => ({ ...prev, organizer: e.target.value }))}
                className="theme-input w-full rounded-md px-3 py-2 text-sm"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label htmlFor="date" className="theme-label mb-1 block text-sm font-semibold tracking-wide">
                  Data do evento
                </label>
                <input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                  className="theme-input w-full rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="eventStart" className="theme-label mb-1 block text-sm font-semibold tracking-wide">
                  Inicio do evento
                </label>
                <input
                  id="eventStart"
                  type="time"
                  value={formData.eventStart}
                  onChange={(e) => setFormData((prev) => ({ ...prev, eventStart: e.target.value }))}
                  className="theme-input w-full rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="eventEnd" className="theme-label mb-1 block text-sm font-semibold tracking-wide">
                  Fim do evento
                </label>
                <input
                  id="eventEnd"
                  type="time"
                  value={formData.eventEnd}
                  onChange={(e) => setFormData((prev) => ({ ...prev, eventEnd: e.target.value }))}
                  className="theme-input w-full rounded-md px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="location" className="theme-label mb-1 block text-sm font-semibold tracking-wide">
                Local
              </label>
              <input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                className="theme-input w-full rounded-md px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label htmlFor="status" className="theme-label mb-1 block text-sm font-semibold tracking-wide">
                Status
              </label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                className="theme-input w-full rounded-md px-3 py-2 text-sm"
              >
                <option value="DRAFT">DRAFT</option>
                <option value="OPEN">OPEN</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </div>

            <div className="theme-subpanel rounded-md p-3">
              <p className="theme-label mb-2 text-sm font-semibold tracking-wide">
                Quantidade de participantes
              </p>
              <div className="theme-subpanel mb-3 inline-grid grid-cols-2 gap-1 rounded-md p-1">
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, hasParticipantLimit: true }))}
                  aria-pressed={formData.hasParticipantLimit}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium leading-none transition ${
                    formData.hasParticipantLimit
                      ? "border border-blue-500 bg-blue-600 text-white"
                      : "border border-transparent bg-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  Limitado
                </button>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, hasParticipantLimit: false, participantLimit: "" }))}
                  aria-pressed={!formData.hasParticipantLimit}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium leading-none transition ${
                    !formData.hasParticipantLimit
                      ? "border border-blue-500 bg-blue-600 text-white"
                      : "border border-transparent bg-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  Ilimitado
                </button>
              </div>

              {formData.hasParticipantLimit ? (
                <input
                  type="number"
                  min={1}
                  value={formData.participantLimit}
                  onChange={(e) => setFormData((prev) => ({ ...prev, participantLimit: e.target.value }))}
                  placeholder="Ex: 300"
                  className="theme-input w-full rounded-md px-3 py-2 text-sm"
                />
              ) : null}
            </div>

            {error ? <p className="theme-error-message rounded-lg p-3 text-sm">{error}</p> : null}

            <div className="flex items-center justify-end gap-2">
              <Link href="/" className="theme-secondary-button rounded-md px-4 py-2 text-sm">
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={loading || !authReady || !token}
                className="inline-flex items-center gap-2 rounded-md border border-green-700 bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span aria-hidden="true" className="text-base leading-none">+</span>
                <span>{loading ? "Criando..." : "Criar evento"}</span>
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

