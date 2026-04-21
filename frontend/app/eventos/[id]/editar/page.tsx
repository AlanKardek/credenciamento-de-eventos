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
          throw new Error("Nao foi possivel carregar o evento.");
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
      setError("ID de evento invalido.");
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
        throw new Error("Nao foi possivel atualizar o evento.");
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
      <main className="min-h-screen bg-[#111318] text-white">
        <div className="mx-auto max-w-2xl px-4 py-6 md:px-6">
          <p className="text-sm text-[#b8bfd1]">Carregando...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#111318] text-white">
      <div className="mx-auto max-w-2xl px-4 py-6 md:px-6">
        <div className="mb-6">
          <Link href={`/eventos/${eventId}`} className="rounded-md border border-[#3f4658] bg-[#232834] px-4 py-2 text-sm text-[#d3d8e4] hover:bg-[#2a3040]">
            Voltar para evento
          </Link>
        </div>

        {error && <p className="mb-4 text-sm text-[#f5a5a5]">{error}</p>}
        {successMessage && <p className="mb-4 text-sm text-[#ddf7e7]">{successMessage}</p>}

        {!error && event ? (
          <section className="rounded-2xl border border-[#2c313d] bg-[#1a1d24] p-6">
            <h1 className="mb-6 text-2xl font-semibold">Editar evento</h1>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-[#d3d8e4] mb-2">
                  Titulo *
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-[#34394a] bg-[#0f1117] px-4 py-2 text-sm text-[#d3d8e4] placeholder-[#566575] focus:border-[#2f61ff] focus:outline-none"
                  placeholder="Titulo do evento"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-[#d3d8e4] mb-2">
                  Descricao
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[#34394a] bg-[#0f1117] px-4 py-2 text-sm text-[#d3d8e4] placeholder-[#566575] focus:border-[#2f61ff] focus:outline-none"
                  placeholder="Descricao do evento"
                  rows={3}
                />
              </div>

              <div>
                <label htmlFor="organizer" className="block text-sm font-medium text-[#d3d8e4] mb-2">
                  Organizacao
                </label>
                <input
                  type="text"
                  id="organizer"
                  name="organizer"
                  value={formData.organizer}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[#34394a] bg-[#0f1117] px-4 py-2 text-sm text-[#d3d8e4] placeholder-[#566575] focus:border-[#2f61ff] focus:outline-none"
                  placeholder="Nome da organizacao"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="date" className="block text-sm font-medium text-[#d3d8e4] mb-2">
                    Data *
                  </label>
                  <input
                    type="date"
                    id="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border border-[#34394a] bg-[#0f1117] px-4 py-2 text-sm text-[#d3d8e4] focus:border-[#2f61ff] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="participantLimit" className="block text-sm font-medium text-[#d3d8e4] mb-2">
                    Limite de Participantes
                  </label>
                  <input
                    type="number"
                    id="participantLimit"
                    name="participantLimit"
                    value={formData.participantLimit}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-[#34394a] bg-[#0f1117] px-4 py-2 text-sm text-[#d3d8e4] placeholder-[#566575] focus:border-[#2f61ff] focus:outline-none"
                    placeholder="Deixe em branco para ilimitado"
                    min="1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="eventStart" className="block text-sm font-medium text-[#d3d8e4] mb-2">
                    Hora de Inicio
                  </label>
                  <input
                    type="time"
                    id="eventStart"
                    name="eventStart"
                    value={formData.eventStart}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-[#34394a] bg-[#0f1117] px-4 py-2 text-sm text-[#d3d8e4] focus:border-[#2f61ff] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="eventEnd" className="block text-sm font-medium text-[#d3d8e4] mb-2">
                    Hora de Termino
                  </label>
                  <input
                    type="time"
                    id="eventEnd"
                    name="eventEnd"
                    value={formData.eventEnd}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-[#34394a] bg-[#0f1117] px-4 py-2 text-sm text-[#d3d8e4] focus:border-[#2f61ff] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="location" className="block text-sm font-medium text-[#d3d8e4] mb-2">
                  Local
                </label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[#34394a] bg-[#0f1117] px-4 py-2 text-sm text-[#d3d8e4] placeholder-[#566575] focus:border-[#2f61ff] focus:outline-none"
                  placeholder="Endereco ou local do evento"
                />
              </div>

              <div>
                <label htmlFor="status" className="block text-sm font-medium text-[#d3d8e4] mb-2">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[#34394a] bg-[#0f1117] px-4 py-2 text-sm text-[#d3d8e4] focus:border-[#2f61ff] focus:outline-none"
                >
                  <option value="DRAFT">Rascunho</option>
                  <option value="PUBLISHED">Publicado</option>
                  <option value="ONGOING">Em andamento</option>
                  <option value="COMPLETED">Concluido</option>
                  <option value="CANCELLED">Cancelado</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg border border-[#2f9e5f] bg-[#1d6a3f] px-6 py-2 text-sm font-semibold text-[#ddf7e7] hover:bg-[#247a4a] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Salvando..." : "Salvar alteracoes"}
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/eventos/${eventId}`)}
                  className="flex-1 rounded-lg border border-[#3f4658] bg-[#232834] px-6 py-2 text-sm font-semibold text-[#d3d8e4] hover:bg-[#2a3040]"
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
