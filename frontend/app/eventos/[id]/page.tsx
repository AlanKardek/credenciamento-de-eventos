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

  // Cores para o gráfico de pizza
  const colors = ['#2f9e5f', '#2f61ff', '#ff6b6b', '#ffd93d', '#6bcf7f', '#4ecdc4', '#ff8c42', '#a78bfa'];

  // Função para desenhar gráfico de linha SVG
  const LineChart = ({ data }: { data: typeof timelineData }) => {
    if (data.length === 0) return null;

    const width = 400;
    const height = 180;
    const padding = 35;
    const maxValue = Math.max(...data.map(d => d.accumulated), 1);

    const points = data.map((d, i) => {
      const x = padding + (i / Math.max(data.length - 1, 1)) * (width - padding * 2);
      const y = height - padding - (d.accumulated / maxValue) * (height - padding * 2);
      return { x, y, ...d };
    });

    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="w-full">
        {/* Grid */}
        {[0, 1, 2, 3].map(i => (
          <line
            key={`grid-${i}`}
            x1={padding}
            y1={padding + (i * (height - padding * 2)) / 3}
            x2={width - padding}
            y2={padding + (i * (height - padding * 2)) / 3}
            stroke="#34394a"
            strokeWidth="1"
            strokeDasharray="3"
          />
        ))}

        {/* Eixos */}
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#566575" strokeWidth="1.5" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#566575" strokeWidth="1.5" />

        {/* Linha */}
        <polyline
          points={points.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#2f61ff"
          strokeWidth="1.5"
        />

        {/* Pontos */}
        {points.map((p, i) => (
          <circle key={`point-${i}`} cx={p.x} cy={p.y} r="3" fill="#2f61ff" />
        ))}

        {/* Labels */}
        {points.map((p, i) => (
          i % Math.max(Math.ceil(points.length / 3), 1) === 0 && (
            <text
              key={`label-${i}`}
              x={p.x}
              y={height - padding + 15}
              textAnchor="middle"
              fontSize="10"
              fill="#8f96a8"
            >
              {p.date}
            </text>
          )
        ))}
      </svg>
    );
  };

  // Função para desenhar gráfico de pizza SVG
  const PieChart = ({ data }: { data: Array<{ name: string; value: number }> }) => {
    if (data.length === 0) return null;

    const total = data.reduce((sum, item) => sum + item.value, 0);
    const radius = 60;
    const cx = 90;
    const cy = 75;

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
      <div className="flex items-center gap-4">
        <svg width="180" height="150" viewBox="0 0 180 150" className="flex-shrink-0">
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
              <span className="text-[#b8bfd1] flex-1">{slice.name}</span>
              <span className="text-[#8f96a8]">
                {slice.value} ({Math.round((slice.value / total) * 100)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-[#111318] text-white">
      <div className="mx-auto max-w-6xl px-3 py-3 md:px-4">
        <div className="mb-3 flex justify-between items-center gap-2">
          <Link href="/" className="rounded-md border border-[#3f4658] bg-[#232834] px-2.5 py-1 text-xs text-[#d3d8e4] hover:bg-[#2a3040] whitespace-nowrap">
            ← Voltar
          </Link>
          <div className="flex gap-1.5">
            {!loading && !error && event && (
              <button
                onClick={() => router.push(`/eventos/${eventId}/editar`)}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#2f61ff] bg-[#1b2f7a] px-2.5 py-1 text-xs font-semibold text-[#dbe6ff] hover:bg-[#203a95]"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M3 17.25V21h3.75L17.81 9.94m-4.51-4.51l2.83-2.83c.39-.39 1.02-.39 1.41 0l2.83 2.83c.39.39.39 1.02 0 1.41l-2.83 2.83" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Editar</span>
              </button>
            )}
          </div>
        </div>

        {loading ? <p className="text-xs text-[#b8bfd1]">Carregando...</p> : null}
        {error ? <p className="text-xs text-[#f5a5a5]">{error}</p> : null}

        {!loading && !error && event ? (
          <>
            <section className="mb-3 rounded-lg border border-[#2c313d] bg-[#1a1d24] p-3">
              <h1 className="text-lg font-semibold mb-2">{event.title}</h1>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div>
                  <p className="text-[#8f96a8] uppercase tracking-wide">Desc</p>
                  <p className="text-[#d3d8e4] truncate">{event.description || "-"}</p>
                </div>
                <div>
                  <p className="text-[#8f96a8] uppercase tracking-wide">Org</p>
                  <p className="text-[#d3d8e4] truncate">{event.organizer || "-"}</p>
                </div>
                <div>
                  <p className="text-[#8f96a8] uppercase tracking-wide">Data</p>
                  <p className="text-[#d3d8e4]">{event.date}</p>
                </div>
                <div>
                  <p className="text-[#8f96a8] uppercase tracking-wide">Hora</p>
                  <p className="text-[#d3d8e4] text-xs">{event.eventStart || "-"}</p>
                </div>
              </div>
            </section>

            <section className="mb-3 grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-[#2c313d] bg-[#1a1d24] p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-6 h-6 rounded bg-[#1b2f7a] flex items-center justify-center flex-shrink-0">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-[#2f61ff]">
                      <path d="M17 21H7a2 2 0 0 1-2-2V9.414a1 1 0 0 1 .293-.707l5-5a1 1 0 0 1 1.414 0l5 5A1 1 0 0 1 17 9.414V19a2 2 0 0 1-2 2z"/>
                    </svg>
                  </div>
                  <p className="text-xs text-[#8f96a8] uppercase">Total</p>
                </div>
                <p className="text-xl font-bold text-[#dbe6ff]">{totalParticipants}</p>
              </div>
              <div className="rounded-lg border border-[#2c313d] bg-[#1a1d24] p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-6 h-6 rounded bg-[#1d6a3f] flex items-center justify-center flex-shrink-0">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-[#2f9e5f]">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                    </svg>
                  </div>
                  <p className="text-xs text-[#8f96a8] uppercase">Check-in</p>
                </div>
                <p className="text-xl font-bold text-[#ddf7e7]">{checkInCount}</p>
              </div>
              <div className="rounded-lg border border-[#2c313d] bg-[#1a1d24] p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-6 h-6 rounded bg-[#6a5f1d] flex items-center justify-center flex-shrink-0">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-[#ffc9a3]">
                      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                    </svg>
                  </div>
                  <p className="text-xs text-[#8f96a8] uppercase">Presença</p>
                </div>
                <p className="text-xl font-bold text-[#dbe6ff]">{percentualCheckIn}%</p>
              </div>
            </section>

            <section className="mb-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="rounded-lg border border-[#2c313d] bg-[#1a1d24] p-3">
                <h3 className="mb-2 text-xs font-semibold uppercase">Timeline</h3>
                <div className="w-full overflow-x-auto">
                  <LineChart data={timelineData} />
                </div>
              </div>

              <div className="rounded-lg border border-[#2c313d] bg-[#1a1d24] p-3">
                <h3 className="mb-2 text-xs font-semibold uppercase">Categorias</h3>
                <div className="w-full overflow-x-auto">
                  <PieChart data={categoryData} />
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-[#2c313d] bg-[#1a1d24] p-3">
              <h2 className="mb-2 text-xs font-semibold uppercase">Participantes ({totalParticipants})</h2>
              {participants.length === 0 ? (
                <p className="text-xs text-[#b8bfd1]">Nenhum participante cadastrado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#34394a]">
                        <th className="px-2 py-1 text-left text-[#8f96a8] uppercase">Nome</th>
                        <th className="px-2 py-1 text-left text-[#8f96a8] uppercase">Categoria</th>
                        <th className="px-2 py-1 text-left text-[#8f96a8] uppercase hidden sm:table-cell">Inscrito em</th>
                        <th className="px-2 py-1 text-left text-[#8f96a8] uppercase">Status</th>
                        <th className="px-2 py-1 text-center text-[#8f96a8] uppercase">Check-in</th>
                        <th className="px-2 py-1 text-center text-[#8f96a8] uppercase">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {participants.map((participant) => (
                        <tr key={participant.id} className="border-b border-[#34394a] hover:bg-[#212634]">
                          <td className="px-2 py-1 text-[#d3d8e4] truncate font-medium">{participant.name}</td>
                          <td className="px-2 py-1 text-[#9ba2b3] truncate">
                            {participant.category ? participant.category.replace(/_/g, ' ') : "-"}
                          </td>
                          <td className="px-2 py-1 text-[#9ba2b3] hidden sm:table-cell text-xs">
                            {participant.createdAt ? new Date(participant.createdAt).toLocaleDateString('pt-BR') : "-"}
                          </td>
                          <td className="px-2 py-1 text-[#9ba2b3] text-xs truncate">{participant.institution || "-"}</td>
                          <td className="px-2 py-1 text-center">
                            <span className={`inline-flex text-xs px-1.5 py-0.5 rounded font-medium ${
                              participant.checkIn
                                ? "bg-[#1d6a3f] text-[#ddf7e7]"
                                : "bg-[#6a3f1d] text-[#ffc9a3]"
                            }`}>
                              {participant.checkIn ? "✓ Sim" : "✗ Não"}
                            </span>
                          </td>
                          <td className="px-2 py-1 text-center">
                            <button
                              onClick={() => router.push(`/eventos/${eventId}/participantes/${participant.id}/editar`)}
                              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs bg-[#1b2f7a] text-[#dbe6ff] hover:bg-[#203a95]"
                              title="Editar participante"
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
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
