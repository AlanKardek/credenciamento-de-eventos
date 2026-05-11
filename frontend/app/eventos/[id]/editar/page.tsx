"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { API_BASE_URL, TOKEN_STORAGE_KEY } from "@/app/constants/auth";

type EventDetail = {
  id: number;
  title: string;
  description?: string | null;
  organizer?: string | null;
  participantLimit?: number | null;
  date: string;
  eventStart?: string | null;
  eventEnd?: string | null;
  location?: string | null;
  status?: string;
};

export default function EditEventPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const eventId = Number(params.id);
  const [token, setToken] = useState("");
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    organizer: "",
    participantLimit: "",
    date: "",
    eventStart: "",
    eventEnd: "",
    location: "",
    status: "DRAFT",
  });

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

    async function loadEvent() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE_URL}/events/${eventId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 401 || response.status === 403) {
          window.localStorage.removeItem(TOKEN_STORAGE_KEY);
          router.replace("/login");
          return;
        }

        if (!response.ok) {
          throw new Error("Não foi possível carregar o evento.");
        }

        const eventData = (await response.json()) as EventDetail;

        if (active) {
          setEvent(eventData);
          setFormData({
            title: eventData.title,
            description: eventData.description || "",
            organizer: eventData.organizer || "",
            participantLimit: eventData.participantLimit?.toString() || "",
            date: eventData.date,
            eventStart: eventData.eventStart || "",
            eventEnd: eventData.eventEnd || "",
            location: eventData.location || "",
            status: eventData.status || "DRAFT",
          });
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Erro ao carregar evento.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    if (!Number.isInteger(eventId) || eventId <= 0) {
      setLoading(false);
      setError("ID de evento inválido.");
      return;
    }

    loadEvent();

    return () => {
      active = false;
    };
  }, [eventId, router, token]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      const payload = {
        ...formData,
        participantLimit: formData.participantLimit ? parseInt(formData.participantLimit) : null,
      };

      const response = await fetch(`${API_BASE_URL}/admin/events/${eventId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 401 || response.status === 403) {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        throw new Error("Não foi possível atualizar o evento.");
      }

      setSuccessMessage("Evento atualizado com sucesso!");
      setTimeout(() => {
        router.push(`/eventos/${eventId}`);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar evento.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="theme-page">
        <div className="mx-auto max-w-2xl px-4 py-6 md:px-6">
          <p className="theme-muted text-sm">Carregando...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="theme-page">
      <div className="mx-auto max-w-2xl px-3 py-4 sm:px-4 sm:py-6 md:px-6">
        <div className="mb-4 sm:mb-6">
          <Link href={`/eventos/${eventId}`} className="theme-secondary-button rounded-md px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm">
            Voltar para evento
          </Link>
        </div>

        {error && <p className="theme-error-message mb-4 rounded-lg p-2.5 text-xs sm:p-3 sm:text-sm">{error}</p>}
        {successMessage && <p className="theme-success-message mb-4 rounded-lg p-2.5 text-xs sm:p-3 sm:text-sm">{successMessage}</p>}

        {!error && event ? (
          <section className="theme-panel rounded-lg p-4 sm:rounded-2xl sm:p-6">
            <h1 className="mb-4 text-xl font-semibold sm:mb-6 sm:text-2xl">Editar evento</h1>

            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-5">
              <div>
                <label htmlFor="title" className="theme-label mb-1 block text-xs font-medium sm:mb-2 sm:text-sm">
                  Título *
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  className="theme-input w-full rounded-lg px-2.5 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm"
                  placeholder="Título do evento"
                />
              </div>

              <div>
                <label htmlFor="description" className="theme-label mb-1 block text-xs font-medium sm:mb-2 sm:text-sm">
                  Descrição
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className="theme-input w-full rounded-lg px-2.5 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm"
                  placeholder="Descrição do evento"
                  rows={3}
                />
              </div>

              <div>
                <label htmlFor="organizer" className="theme-label mb-1 block text-xs font-medium sm:mb-2 sm:text-sm">
                  Organização
                </label>
                <input
                  type="text"
                  id="organizer"
                  name="organizer"
                  value={formData.organizer}
                  onChange={handleChange}
                  className="theme-input w-full rounded-lg px-2.5 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm"
                  placeholder="Nome da organização"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:gap-5 md:grid-cols-2">
                <div>
                  <label htmlFor="date" className="theme-label mb-1 block text-xs font-medium sm:mb-2 sm:text-sm">
                    Data *
                  </label>
                  <input
                    type="date"
                    id="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    required
                    className="theme-input w-full rounded-lg px-2.5 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="participantLimit" className="theme-label mb-1 block text-xs font-medium sm:mb-2 sm:text-sm">
                    Limite de participantes
                  </label>
                  <input
                    type="number"
                    id="participantLimit"
                    name="participantLimit"
                    value={formData.participantLimit}
                    onChange={handleChange}
                    className="theme-input w-full rounded-lg px-2.5 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm"
                    placeholder="Deixe em branco para ilimitado"
                    min="1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:gap-5 md:grid-cols-2">
                <div>
                  <label htmlFor="eventStart" className="theme-label mb-1 block text-xs font-medium sm:mb-2 sm:text-sm">
                    Hora de início
                  </label>
                  <input
                    type="time"
                    id="eventStart"
                    name="eventStart"
                    value={formData.eventStart}
                    onChange={handleChange}
                    className="theme-input w-full rounded-lg px-2.5 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="eventEnd" className="theme-label mb-1 block text-xs font-medium sm:mb-2 sm:text-sm">
                    Hora de término
                  </label>
                  <input
                    type="time"
                    id="eventEnd"
                    name="eventEnd"
                    value={formData.eventEnd}
                    onChange={handleChange}
                    className="theme-input w-full rounded-lg px-2.5 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="location" className="theme-label mb-1 block text-xs font-medium sm:mb-2 sm:text-sm">
                  Local
                </label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  className="theme-input w-full rounded-lg px-2.5 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm"
                  placeholder="Endereço ou local do evento"
                />
              </div>

              <div>
                <label htmlFor="status" className="theme-label mb-1 block text-xs font-medium sm:mb-2 sm:text-sm">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="theme-input w-full rounded-lg px-2.5 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm"
                >
                  <option value="DRAFT">Rascunho</option>
                  <option value="OPEN">Aberto</option>
                  <option value="CLOSED">Fechado</option>
                  <option value="ARCHIVED">Arquivado</option>
                </select>
              </div>

              <div className="flex gap-2 pt-3 sm:gap-3 sm:pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg border border-green-700 bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 sm:px-6 sm:py-2 sm:text-sm"
                >
                  {saving ? "Salvando..." : "Salvar alterações"}
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/eventos/${eventId}`)}
                  className="theme-secondary-button flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold sm:px-6 sm:py-2 sm:text-sm"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        ) : null}
      </div>
    </main>
  );
}

