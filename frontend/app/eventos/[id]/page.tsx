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
  institution?: string | null;
  jobTitle?: string | null;
  city?: string | null;
  uf?: string | null;
  category?: string | null;
  createdAt?: string | null;
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredParticipants, setFilteredParticipants] = useState<Participant[]>([]);

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

  // Filtrar participantes conforme digitação
  useEffect(() => {
    if (!searchQuery) {
      setFilteredParticipants(participants);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredParticipants(
        participants.filter(p =>
          p.name.toLowerCase().includes(query) ||
          p.email.toLowerCase().includes(query) ||
          (p.institution?.toLowerCase().includes(query) || false)
        )
      );
    }
  }, [searchQuery, participants]);

  const checkInCount = participants.filter(p => p.checkIn).length;
  const totalParticipants = participants.length;
  const percentualCheckIn = totalParticipants > 0 ? Math.round((checkInCount / totalParticipants) * 100) : 0;

  // Calcular dados para gráfico de timeline
  const timelineData = (() => {
    const grouped = new Map<string, number>();
    participants.forEach(p => {
      if (p.createdAt) {
        const date = new Date(p.createdAt).toLocaleDateString('pt-BR');
        grouped.set(date, (grouped.get(date) || 0) + 1);
      }
    });

    const sorted = Array.from(grouped.entries()).sort((a, b) =>
      new Date(a[0].split('/').reverse().join('-')).getTime() -
      new Date(b[0].split('/').reverse().join('-')).getTime()
    );

    let accumulated = 0;
    return sorted.map(([date, count]) => {
      accumulated += count;
      return { date, accumulated };
    });
  })();

  // Calcular dados para gráfico de pizza (categorias)
  const categoryData = (() => {
    const categories = new Map<string, number>();
    participants.forEach(p => {
      const cat = p.category || 'Não informado';
      categories.set(cat, (categories.get(cat) || 0) + 1);
    });
    return Array.from(categories.entries()).map(([name, value]) => ({ name, value }));
  })();

  const colors = ['#2f9e5f', '#2f61ff', '#ff6b6b', '#ffd93d', '#6bcf7f', '#4ecdc4', '#ff8c42', '#a78bfa'];

  const LineChart = ({ data }: { data: typeof timelineData }) => {
    if (data.length === 0) return null;

    const width = 350;
    const height = 150;
    const padding = 30;
    const maxValue = Math.max(...data.map(d => d.accumulated), 1);

    const points = data.map((d, i) => {
      const x = padding + (i / Math.max(data.length - 1, 1)) * (width - padding * 2);
      const y = height - padding - (d.accumulated / maxValue) * (height - padding * 2);
      return { x, y, ...d };
    });

    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="w-full">
        {[0, 1, 2].map(i => (
          <line
            key={`grid-${i}`}
            x1={padding}
            y1={padding + (i * (height - padding * 2)) / 2}
            x2={width - padding}
            y2={padding + (i * (height - padding * 2)) / 2}
            stroke="#34394a"
            strokeWidth="1"
            strokeDasharray="3"
          />
        ))}

        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#566575" strokeWidth="1" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#566575" strokeWidth="1" />

        <polyline
          points={points.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#2f61ff"
          strokeWidth="2"
        />

        {points.map((p, i) => (
          <circle key={`point-${i}`} cx={p.x} cy={p.y} r="2.5" fill="#2f61ff" />
        ))}
      </svg>
    );
  };

  const PieChart = ({ data }: { data: Array<{ name: string; value: number }> }) => {
    if (data.length === 0) return null;

    const total = data.reduce((sum, item) => sum + item.value, 0);
    const radius = 50;
    const cx = 70;
    const cy = 60;

    let currentAngle = -Math.PI / 2;
    const slices = data.map((item, index) => {
      const sliceAngle = (item.value / total) * 2 * Math.PI;
      const startAngle = currentAngle;
      const endAngle = currentAngle + sliceAngle;

      const x1 = cx + radius * Math.cos(startAngle);
      const y1 = cy + radius * Math.sin(startAngle);
      const x2 = cx + radius * Math.cos(endAngle);
      const y2 = cy + radius * Math.sin(endAngle);

      const largeArc = sliceAngle > Math.PI ? 1 : 0;
      const path = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

      currentAngle = endAngle;

      return { path, color: colors[index % colors.length], ...item };
    });

    return (
      <div className="flex items-center gap-3">
        <svg width="150" height="120" viewBox="0 0 150 120" className="flex-shrink-0">
          {slices.map((slice, i) => (
            <path
              key={`slice-${i}`}
              d={slice.path}
              fill={slice.color}
              stroke="#111318"
              strokeWidth="1"
            />
          ))}
        </svg>
        <div className="flex flex-col gap-1">
          {slices.map((slice, i) => (
            <div key={`legend-${i}`} className="flex items-center gap-2 text-xs">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: slice.color }}
              />
              <span className="text-[#b8bfd1]">{slice.name}</span>
              <span className="text-[#8f96a8]">{Math.round((slice.value / total) * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-[#111318] text-white">
      <div className="mx-auto max-w-6xl px-4 py-4 md:px-6">
        <div className="mb-4 flex justify-between items-center gap-2 flex-wrap">
          <Link href="/" className="rounded-md border border-[#3f4658] bg-[#232834] px-3 py-1.5 text-xs text-[#d3d8e4] hover:bg-[#2a3040] whitespace-nowrap">
            ← Voltar
          </Link>
          <div className="flex gap-2 flex-wrap">
            {!loading && !error && event && (
              <>
                <button
                  onClick={() => router.push(`/eventos/${eventId}/participantes/novo`)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#2f9e5f] bg-[#1d6a3f] px-3 py-1.5 text-xs font-semibold text-[#ddf7e7] hover:bg-[#247a4a]"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M12 5v14m7-7H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Adicionar Participante</span>
                </button>
                <button
                  onClick={() => setSearchOpen(!searchOpen)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#3f4658] bg-[#232834] px-3 py-1.5 text-xs font-semibold text-[#d3d8e4] hover:bg-[#2a3040]"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                    <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <span>Buscar</span>
                </button>
                <button
                  onClick={() => router.push(`/eventos/${eventId}/editar`)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#2f61ff] bg-[#1b2f7a] px-3 py-1.5 text-xs font-semibold text-[#dbe6ff] hover:bg-[#203a95]"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M3 17.25V21h3.75L17.81 9.94m-4.51-4.51l2.83-2.83c.39-.39 1.02-.39 1.41 0l2.83 2.83c.39.39.39 1.02 0 1.41l-2.83 2.83" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>Editar Evento</span>
                </button>
              </>
            )}
          </div>
        </div>

        {searchOpen && (
          <div className="mb-4 rounded-lg border border-[#2c313d] bg-[#1a1d24] p-3">
            <input
              type="text"
              placeholder="Buscar por nome, email ou instituição..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-[#34394a] bg-[#0f1117] px-3 py-2 text-sm text-[#d3d8e4] placeholder-[#566575] focus:border-[#2f61ff] focus:outline-none"
              autoFocus
            />
            {searchQuery && (
              <p className="mt-2 text-xs text-[#8f96a8]">
                {filteredParticipants.length} participante(s) encontrado(s)
              </p>
            )}
          </div>
        )}

        {loading ? <p className="text-xs text-[#b8bfd1]">Carregando...</p> : null}
        {error ? <p className="text-xs text-[#f5a5a5]">{error}</p> : null}

        {!loading && !error && event ? (
          <>
            <section className="mb-4 rounded-lg border border-[#2c313d] bg-[#1a1d24] p-4">
              <h1 className="text-2xl font-bold mb-3">{event.title}</h1>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-[#8f96a8] uppercase tracking-wide text-xs mb-1">Descrição</p>
                  <p className="text-[#d3d8e4]">{event.description || "-"}</p>
                </div>
                <div>
                  <p className="text-[#8f96a8] uppercase tracking-wide text-xs mb-1">Organização</p>
                  <p className="text-[#d3d8e4]">{event.organizer || "-"}</p>
                </div>
                <div>
                  <p className="text-[#8f96a8] uppercase tracking-wide text-xs mb-1">Data</p>
                  <p className="text-[#d3d8e4]">{event.date}</p>
                </div>
                <div>
                  <p className="text-[#8f96a8] uppercase tracking-wide text-xs mb-1">Horário</p>
                  <p className="text-[#d3d8e4]">{event.eventStart || "-"} até {event.eventEnd || "-"}</p>
                </div>
              </div>
            </section>

            <section className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-lg border border-[#2c313d] bg-[#1a1d24] p-4">
                <p className="text-[#8f96a8] uppercase tracking-wide text-xs mb-2">Total de Participantes</p>
                <p className="text-4xl font-bold text-[#dbe6ff]">{totalParticipants}</p>
              </div>
              <div className="rounded-lg border border-[#2c313d] bg-[#1a1d24] p-4">
                <p className="text-[#8f96a8] uppercase tracking-wide text-xs mb-2">Check-ins Realizados</p>
                <p className="text-4xl font-bold text-[#ddf7e7]">{checkInCount}</p>
              </div>
              <div className="rounded-lg border border-[#2c313d] bg-[#1a1d24] p-4">
                <p className="text-[#8f96a8] uppercase tracking-wide text-xs mb-2">Taxa de Presença</p>
                <p className="text-4xl font-bold text-[#dbe6ff]">{percentualCheckIn}%</p>
              </div>
            </section>

            <section className="mb-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-lg border border-[#2c313d] bg-[#1a1d24] p-4">
                <h3 className="mb-3 text-sm font-semibold uppercase">Timeline de Inscrições</h3>
                <div className="w-full overflow-x-auto">
                  <LineChart data={timelineData} />
                </div>
              </div>

              <div className="rounded-lg border border-[#2c313d] bg-[#1a1d24] p-4">
                <h3 className="mb-3 text-sm font-semibold uppercase">Distribuição por Categoria</h3>
                <div className="w-full overflow-x-auto">
                  <PieChart data={categoryData} />
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-[#2c313d] bg-[#1a1d24] p-4">
              <h2 className="mb-4 text-lg font-semibold uppercase">Participantes ({filteredParticipants.length}/{totalParticipants})</h2>
              {filteredParticipants.length === 0 ? (
                <p className="text-sm text-[#b8bfd1]">
                  {searchQuery ? "Nenhum participante encontrado com esses critérios." : "Nenhum participante cadastrado."}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-[#2f61ff] bg-[#0f1117]">
                        <th className="px-4 py-3 text-left text-[#2f61ff] font-bold uppercase tracking-wide">Nome</th>
                        <th className="px-4 py-3 text-left text-[#2f61ff] font-bold uppercase tracking-wide">Categoria</th>
                        <th className="px-4 py-3 text-left text-[#2f61ff] font-bold uppercase tracking-wide hidden sm:table-cell">Inscrito em</th>
                        <th className="px-4 py-3 text-left text-[#2f61ff] font-bold uppercase tracking-wide">Status</th>
                        <th className="px-4 py-3 text-center text-[#2f61ff] font-bold uppercase tracking-wide">Check-in</th>
                        <th className="px-4 py-3 text-center text-[#2f61ff] font-bold uppercase tracking-wide">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredParticipants.map((participant, index) => (
                        <tr
                          key={participant.id}
                          className={`border-b border-[#34394a] ${
                            index % 2 === 0 ? "bg-[#0f1117]" : "bg-[#1a1d24]"
                          } hover:bg-[#212634] transition-colors`}
                        >
                          <td className="px-4 py-3 text-[#d3d8e4] font-semibold text-sm">{participant.name}</td>
                          <td className="px-4 py-3 text-[#9ba2b3] text-sm">
                            {participant.category ? participant.category.replace(/_/g, ' ') : "-"}
                          </td>
                          <td className="px-4 py-3 text-[#9ba2b3] text-sm hidden sm:table-cell">
                            {participant.createdAt ? new Date(participant.createdAt).toLocaleDateString('pt-BR') : "-"}
                          </td>
                          <td className="px-4 py-3 text-[#9ba2b3] text-sm">{participant.institution || "-"}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold ${
                              participant.checkIn
                                ? "bg-[#1d6a3f] text-[#ddf7e7]"
                                : "bg-[#6a3f1d] text-[#ffc9a3]"
                            }`}>
                              {participant.checkIn ? "✓ Sim" : "✗ Não"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => router.push(`/eventos/${eventId}/participantes/${participant.id}/editar`)}
                              className="inline-flex items-center gap-1 rounded px-3 py-1.5 text-xs bg-[#1b2f7a] text-[#dbe6ff] hover:bg-[#203a95] font-semibold"
                              title="Editar participante"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                <path d="M3 17.25V21h3.75L17.81 9.94m-4.51-4.51l2.83-2.83c.39-.39 1.02-.39 1.41 0l2.83 2.83c.39.39.39 1.02 0 1.41l-2.83 2.83" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              Editar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
