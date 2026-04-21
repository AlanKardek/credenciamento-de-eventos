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

type Participant = {
  id: number;
  name: string;
  email: string;
  cpf?: string | null;
  checkIn: boolean;
};

export default function EventDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const eventId = Number(params.id);
  const [token, setToken] = useState("");
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const [eventResponse, participantsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/events/${eventId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE_URL}/events/${eventId}/participants`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (
          eventResponse.status === 401 ||
          eventResponse.status === 403 ||
          participantsResponse.status === 401 ||
          participantsResponse.status === 403
        ) {
          window.localStorage.removeItem(TOKEN_STORAGE_KEY);
          router.replace("/login");
          return;
        }

        if (!eventResponse.ok || !participantsResponse.ok) {
          throw new Error("Nao foi possivel carregar os dados do evento.");
        }

        const eventData = (await eventResponse.json()) as EventDetail;
        const participantsData = (await participantsResponse.json()) as Participant[];

        if (active) {
          setEvent(eventData);
          setParticipants(participantsData);
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

    loadData();

    return () => {
      active = false;
    };
  }, [eventId, router, token]);

  return (
    <main className="min-h-screen bg-[#111318] text-white">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        <div className="mb-6">
          <Link href="/" className="rounded-md border border-[#3f4658] bg-[#232834] px-4 py-2 text-sm text-[#d3d8e4] hover:bg-[#2a3040]">
            Voltar para dashboard
          </Link>
        </div>

        {loading ? <p className="text-sm text-[#b8bfd1]">Carregando...</p> : null}
        {error ? <p className="text-sm text-[#f5a5a5]">{error}</p> : null}

        {!loading && !error && event ? (
          <>
            <section className="mb-6 rounded-2xl border border-[#2c313d] bg-[#1a1d24] p-5">
              <h1 className="text-2xl font-semibold">{event.title}</h1>
              <p className="mt-2 text-sm text-[#9ba2b3]">Descricao: {event.description || "-"}</p>
              <p className="text-sm text-[#9ba2b3]">Organizacao: {event.organizer || "-"}</p>
              <p className="text-sm text-[#9ba2b3]">
                Participantes: {event.participantLimit ? `Limitado (${event.participantLimit})` : "Ilimitado"}
              </p>
              <p className="text-sm text-[#9ba2b3]">Data: {event.date}</p>
              <p className="text-sm text-[#9ba2b3]">Inicio: {event.eventStart || "-"}</p>
              <p className="text-sm text-[#9ba2b3]">Fim: {event.eventEnd || "-"}</p>
              <p className="text-sm text-[#9ba2b3]">Local: {event.location || "-"}</p>
              <p className="text-sm text-[#9ba2b3]">Status: {event.status || "-"}</p>
            </section>

            <section className="rounded-2xl border border-[#2c313d] bg-[#1a1d24] p-5">
              <h2 className="mb-4 text-xl font-semibold">Participantes</h2>
              {participants.length === 0 ? (
                <p className="text-sm text-[#b8bfd1]">Nenhum participante cadastrado.</p>
              ) : (
                <div className="space-y-3">
                  {participants.map((participant) => (
                    <div key={participant.id} className="rounded-lg border border-[#34394a] bg-[#212634] p-3">
                      <p className="font-medium">{participant.name}</p>
                      <p className="text-sm text-[#b8bfd1]">{participant.email}</p>
                      <p className="text-sm text-[#b8bfd1]">CPF: {participant.cpf || "-"}</p>
                      <p className="text-sm text-[#b8bfd1]">Check-in: {participant.checkIn ? "Sim" : "Nao"}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
