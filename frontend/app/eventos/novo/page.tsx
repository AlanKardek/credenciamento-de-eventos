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
      setError("Nome do evento e data são obrigatórios.");
      return;
    }

    if (formData.hasParticipantLimit) {
      const limitNumber = Number(formData.participantLimit);
      if (!Number.isInteger(limitNumber) || limitNumber <= 0) {
        setError("Informe um limite de participantes válido.");
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
        throw new Error("Sua conta não tem permissão para criar eventos.");
      }

      if (!response.ok) {
        let message = "Não foi possível criar o evento.";
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
      <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6 md:px-6">
        <div className="mb-4 sm:mb-6">
          <Link href="/" className="theme-secondary-button rounded-md px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm">
            Voltar para dashboard
          </Link>
        </div>

        <section className="theme-panel rounded-lg p-4 sm:rounded-2xl sm:p-6">
          <h1 className="mb-4 text-xl font-semibold sm:mb-5 sm:text-2xl">Criação de evento</h1>

          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div>
              <label htmlFor="title" className="theme-label mb-1 block text-xs font-semibold tracking-wide sm:text-sm">
                Nome do evento
              </label>
              <input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                className="theme-input w-full rounded-md px-2.5 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="description" className="theme-label mb-1 block text-xs font-semibold tracking-wide sm:text-sm">
                Descrição
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                rows={4}
                className="theme-input w-full rounded-md px-2.5 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="organizer" className="theme-label mb-1 block text-xs font-semibold tracking-wide sm:text-sm">
                Organização responsável
              </label>
              <input
                id="organizer"
                value={formData.organizer}
                onChange={(e) => setFormData((prev) => ({ ...prev, organizer: e.target.value }))}
                className="theme-input w-full rounded-md px-2.5 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm"
              />
            </div>

            <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
              <div>
                <label htmlFor="date" className="theme-label mb-1 block text-xs font-semibold tracking-wide sm:text-sm">
                  Data do evento
                </label>
                <input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                  className="theme-input w-full rounded-md px-2.5 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="eventStart" className="theme-label mb-1 block text-xs font-semibold tracking-wide sm:text-sm">
                  Início do evento
                </label>
                <input
                  id="eventStart"
                  type="time"
                  value={formData.eventStart}
                  onChange={(e) => setFormData((prev) => ({ ...prev, eventStart: e.target.value }))}
                  className="theme-input w-full rounded-md px-2.5 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="eventEnd" className="theme-label mb-1 block text-xs font-semibold tracking-wide sm:text-sm">
                  Fim do evento
                </label>
                <input
                  id="eventEnd"
                  type="time"
                  value={formData.eventEnd}
                  onChange={(e) => setFormData((prev) => ({ ...prev, eventEnd: e.target.value }))}
                  className="theme-input w-full rounded-md px-2.5 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="location" className="theme-label mb-1 block text-xs font-semibold tracking-wide sm:text-sm">
                Local
              </label>
              <input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                className="theme-input w-full rounded-md px-2.5 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="status" className="theme-label mb-1 block text-xs font-semibold tracking-wide sm:text-sm">
                Status
              </label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                className="theme-input w-full rounded-md px-2.5 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm"
              >
                <option value="DRAFT">DRAFT</option>
                <option value="OPEN">OPEN</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </div>

            <div className="theme-subpanel rounded-md p-2.5 sm:p-3">
              <p className="theme-label mb-2 text-xs font-semibold tracking-wide sm:text-sm">
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
                  className="theme-input w-full rounded-md px-2.5 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm"
                />
              ) : null}
            </div>

            {error ? <p className="theme-error-message rounded-lg p-2.5 text-xs sm:p-3 sm:text-sm">{error}</p> : null}

            <div className="flex items-center justify-end gap-2">
              <Link href="/" className="theme-secondary-button rounded-md px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm">
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={loading || !authReady || !token}
                className="inline-flex items-center gap-1.5 rounded-md border border-green-700 bg-green-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-70 sm:gap-2 sm:px-5 sm:py-2 sm:text-sm"
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

