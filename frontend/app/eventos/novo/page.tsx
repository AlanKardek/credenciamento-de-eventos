"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_BASE_URL, TOKEN_STORAGE_KEY } from "@/app/constants/auth";

export default function NewEventPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
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

      if (response.status === 401 || response.status === 403) {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        router.replace("/login");
        return;
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
    <main className="min-h-screen bg-[#111318] text-white">
      <div className="mx-auto max-w-3xl px-4 py-6 md:px-6">
        <div className="mb-6">
          <Link href="/" className="rounded-md border border-[#3f4658] bg-[#232834] px-4 py-2 text-sm text-[#d3d8e4] hover:bg-[#2a3040]">
            Voltar para dashboard
          </Link>
        </div>

        <section className="rounded-2xl border border-[#2c313d] bg-[#1a1d24] p-6">
          <h1 className="mb-5 text-2xl font-semibold">Criacao de evento</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="title" className="mb-1 block text-sm font-semibold tracking-wide text-[#f2f5ff]">
                Nome do evento
              </label>
              <input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                className="w-full rounded-md border border-[#3f4658] bg-[#232834] px-3 py-2 text-sm text-[#dbe0ec] outline-none focus:border-[#4e70ff]"
              />
            </div>

            <div>
              <label htmlFor="description" className="mb-1 block text-sm font-semibold tracking-wide text-[#f2f5ff]">
                Descricao
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                rows={4}
                className="w-full rounded-md border border-[#3f4658] bg-[#232834] px-3 py-2 text-sm text-[#dbe0ec] outline-none focus:border-[#4e70ff]"
              />
            </div>

            <div>
              <label htmlFor="organizer" className="mb-1 block text-sm font-semibold tracking-wide text-[#f2f5ff]">
                Organizacao responsavel
              </label>
              <input
                id="organizer"
                value={formData.organizer}
                onChange={(e) => setFormData((prev) => ({ ...prev, organizer: e.target.value }))}
                className="w-full rounded-md border border-[#3f4658] bg-[#232834] px-3 py-2 text-sm text-[#dbe0ec] outline-none focus:border-[#4e70ff]"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label htmlFor="date" className="mb-1 block text-sm font-semibold tracking-wide text-[#f2f5ff]">
                  Data do evento
                </label>
                <input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                  className="w-full rounded-md border border-[#3f4658] bg-[#232834] px-3 py-2 text-sm text-[#dbe0ec] outline-none focus:border-[#4e70ff]"
                />
              </div>
              <div>
                <label htmlFor="eventStart" className="mb-1 block text-sm font-semibold tracking-wide text-[#f2f5ff]">
                  Inicio do evento
                </label>
                <input
                  id="eventStart"
                  type="time"
                  value={formData.eventStart}
                  onChange={(e) => setFormData((prev) => ({ ...prev, eventStart: e.target.value }))}
                  className="w-full rounded-md border border-[#3f4658] bg-[#232834] px-3 py-2 text-sm text-[#dbe0ec] outline-none focus:border-[#4e70ff]"
                />
              </div>
              <div>
                <label htmlFor="eventEnd" className="mb-1 block text-sm font-semibold tracking-wide text-[#f2f5ff]">
                  Fim do evento
                </label>
                <input
                  id="eventEnd"
                  type="time"
                  value={formData.eventEnd}
                  onChange={(e) => setFormData((prev) => ({ ...prev, eventEnd: e.target.value }))}
                  className="w-full rounded-md border border-[#3f4658] bg-[#232834] px-3 py-2 text-sm text-[#dbe0ec] outline-none focus:border-[#4e70ff]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="location" className="mb-1 block text-sm font-semibold tracking-wide text-[#f2f5ff]">
                Local
              </label>
              <input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                className="w-full rounded-md border border-[#3f4658] bg-[#232834] px-3 py-2 text-sm text-[#dbe0ec] outline-none focus:border-[#4e70ff]"
              />
            </div>

            <div>
              <label htmlFor="status" className="mb-1 block text-sm font-semibold tracking-wide text-[#f2f5ff]">
                Status
              </label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                className="w-full rounded-md border border-[#3f4658] bg-[#232834] px-3 py-2 text-sm text-[#dbe0ec] outline-none focus:border-[#4e70ff]"
              >
                <option value="DRAFT">DRAFT</option>
                <option value="OPEN">OPEN</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </div>

            <div className="rounded-md border border-[#3f4658] bg-[#232834] p-3">
              <p className="mb-2 text-sm font-semibold tracking-wide text-[#f2f5ff]">
                Quantidade de participantes
              </p>
              <div className="mb-3 inline-grid grid-cols-2 gap-1 rounded-md border border-[#3f4658] bg-[#1c202a] p-1">
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, hasParticipantLimit: true }))}
                  aria-pressed={formData.hasParticipantLimit}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium leading-none transition ${
                    formData.hasParticipantLimit
                      ? "border border-[#2f61ff] bg-[#1b2f7a] text-[#dbe6ff]"
                      : "border border-transparent bg-transparent text-[#b9c1d5] hover:bg-[#252b37]"
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
                      ? "border border-[#2f61ff] bg-[#1b2f7a] text-[#dbe6ff]"
                      : "border border-transparent bg-transparent text-[#b9c1d5] hover:bg-[#252b37]"
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
                  className="w-full rounded-md border border-[#4a5166] bg-[#1c202a] px-3 py-2 text-sm text-[#dbe0ec] outline-none focus:border-[#4e70ff]"
                />
              ) : null}
            </div>

            {error ? <p className="text-sm text-[#f5a5a5]">{error}</p> : null}

            <div className="flex items-center justify-end gap-2">
              <Link href="/" className="rounded-md border border-[#4b4f5d] bg-[#232834] px-4 py-2 text-sm text-[#d3d8e4] hover:bg-[#2a3040]">
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-md border border-[#2f9e5f] bg-[#1d6a3f] px-5 py-2 text-sm font-semibold text-[#ddf7e7] hover:bg-[#247a4a] disabled:cursor-not-allowed disabled:opacity-70"
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
