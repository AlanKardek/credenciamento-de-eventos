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

    const width = 500;
    const height = 250;
    const padding = 40;
    const maxValue = Math.max(...data.map(d => d.accumulated), 1);

    const points = data.map((d, i) => {
      const x = padding + (i / Math.max(data.length - 1, 1)) * (width - padding * 2);
      const y = height - padding - (d.accumulated / maxValue) * (height - padding * 2);
      return { x, y, ...d };
    });

    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="w-full">
        {/* Grid */}
        {[0, 1, 2, 3, 4].map(i => (
          <line
            key={`grid-${i}`}
            x1={padding}
            y1={padding + (i * (height - padding * 2)) / 4}
            x2={width - padding}
            y2={padding + (i * (height - padding * 2)) / 4}
            stroke="#34394a"
            strokeWidth="1"
            strokeDasharray="4"
          />
        ))}

        {/* Eixos */}
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#566575" strokeWidth="2" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#566575" strokeWidth="2" />

        {/* Linha */}
        <polyline
          points={points.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#2f61ff"
          strokeWidth="2"
        />

        {/* Pontos */}
        {points.map((p, i) => (
          <circle key={`point-${i}`} cx={p.x} cy={p.y} r="4" fill="#2f61ff" />
        ))}

        {/* Labels do eixo X */}
        {points.map((p, i) => (
          i % Math.ceil(points.length / 5) === 0 && (
            <text
              key={`label-${i}`}
              x={p.x}
              y={height - padding + 20}
              textAnchor="middle"
              fontSize="12"
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
    const radius = 80;
    const cx = 120;
    const cy = 100;

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
      <div className="flex items-center gap-6">
        <svg width="250" height="200" viewBox="0 0 250 200" className="flex-shrink-0">
          {slices.map((slice, i) => (
            <path
              key={`slice-${i}`}
              d={slice.path}
              fill={slice.color}
              stroke="#111318"
              strokeWidth="2"
            />
          ))}
        </svg>
        <div className="flex flex-col gap-2">
          {slices.map((slice, i) => (
            <div key={`legend-${i}`} className="flex items-center gap-2 text-sm">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: slice.color }}
              />
              <span className="text-[#b8bfd1]">{slice.name}</span>
              <span className="text-[#8f96a8] ml-auto">
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
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        <div className="mb-6 flex justify-between items-center">
          <Link href="/" className="rounded-md border border-[#3f4658] bg-[#232834] px-4 py-2 text-sm text-[#d3d8e4] hover:bg-[#2a3040]">
            Voltar para dashboard
          </Link>
          {!loading && !error && event && (
            <button
              onClick={() => router.push(`/eventos/${eventId}/editar`)}
              className="inline-flex items-center gap-2 rounded-md border border-[#2f61ff] bg-[#1b2f7a] px-4 py-2 text-sm font-semibold text-[#dbe6ff] hover:bg-[#203a95]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 17.25V21h3.75L17.81 9.94m-4.51-4.51l2.83-2.83c.39-.39 1.02-.39 1.41 0l2.83 2.83c.39.39.39 1.02 0 1.41l-2.83 2.83" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Editar evento</span>
            </button>
          )}
        </div>

        {loading ? <p className="text-sm text-[#b8bfd1]">Carregando...</p> : null}
        {error ? <p className="text-sm text-[#f5a5a5]">{error}</p> : null}

        {!loading && !error && event ? (
          <>
            <section className="mb-6 rounded-2xl border border-[#2c313d] bg-[#1a1d24] p-5">
              <h1 className="text-3xl font-semibold mb-4">{event.title}</h1>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[#8f96a8] uppercase tracking-wide">Descricao</p>
                  <p className="text-sm text-[#d3d8e4]">{event.description || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-[#8f96a8] uppercase tracking-wide">Organizacao</p>
                  <p className="text-sm text-[#d3d8e4]">{event.organizer || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-[#8f96a8] uppercase tracking-wide">Data</p>
                  <p className="text-sm text-[#d3d8e4]">{event.date}</p>
                </div>
                <div>
                  <p className="text-xs text-[#8f96a8] uppercase tracking-wide">Horario</p>
                  <p className="text-sm text-[#d3d8e4]">{event.eventStart || "-"} a {event.eventEnd || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-[#8f96a8] uppercase tracking-wide">Local</p>
                  <p className="text-sm text-[#d3d8e4]">{event.location || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-[#8f96a8] uppercase tracking-wide">Status</p>
                  <p className="text-sm text-[#d3d8e4]">{event.status || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-[#8f96a8] uppercase tracking-wide">Limite de Participantes</p>
                  <p className="text-sm text-[#d3d8e4]">{event.participantLimit ? `${event.participantLimit} pessoas` : "Ilimitado"}</p>
                </div>
              </div>
            </section>

            <section className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-[#2c313d] bg-[#1a1d24] p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-[#1b2f7a] flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-[#2f61ff]">
                      <path d="M17 21H7a2 2 0 0 1-2-2V9.414a1 1 0 0 1 .293-.707l5-5a1 1 0 0 1 1.414 0l5 5A1 1 0 0 1 17 9.414V19a2 2 0 0 1-2 2z" fill="currentColor"/>
                      <path d="M9 11h6v6H9z" fill="#111318"/>
                    </svg>
                  </div>
                  <p className="text-xs text-[#8f96a8] uppercase tracking-wide">Total de Participantes</p>
                </div>
                <p className="text-3xl font-bold text-[#dbe6ff]">{totalParticipants}</p>
              </div>
              <div className="rounded-2xl border border-[#2c313d] bg-[#1a1d24] p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-[#1d6a3f] flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-[#2f9e5f]">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor"/>
                    </svg>
                  </div>
                  <p className="text-xs text-[#8f96a8] uppercase tracking-wide">Check-ins Realizados</p>
                </div>
                <p className="text-3xl font-bold text-[#ddf7e7]">{checkInCount}</p>
              </div>
              <div className="rounded-2xl border border-[#2c313d] bg-[#1a1d24] p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-[#6a5f1d] flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-[#ffc9a3]">
                      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" fill="none" stroke="currentColor" strokeWidth="2"/>
                      <path d="M13 2v7h7" fill="none" stroke="currentColor" strokeWidth="2"/>
                      <path d="M9 14h6M9 18h6" fill="none" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                  </div>
                  <p className="text-xs text-[#8f96a8] uppercase tracking-wide">Taxa de Presença</p>
                </div>
                <p className="text-3xl font-bold text-[#dbe6ff]">{percentualCheckIn}%</p>
              </div>
            </section>

            <section className="mb-6 rounded-2xl border border-[#2c313d] bg-[#1a1d24] p-5">
              <h3 className="mb-4 text-xl font-semibold">Status de Presença</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-[#b8bfd1]">Presentes</span>
                    <span className="text-sm font-semibold text-[#ddf7e7]">{checkInCount}/{totalParticipants}</span>
                  </div>
                  <div className="w-full bg-[#34394a] rounded-full h-2">
                    <div
                      className="bg-[#2f9e5f] h-2 rounded-full transition-all"
                      style={{ width: `${percentualCheckIn}%` }}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-6 rounded-2xl border border-[#2c313d] bg-[#1a1d24] p-5">
              <h3 className="mb-6 text-xl font-semibold">Timeline de Inscrições</h3>
              <div className="w-full overflow-x-auto">
                <LineChart data={timelineData} />
              </div>
            </section>

            <section className="mb-6 rounded-2xl border border-[#2c313d] bg-[#1a1d24] p-5">
              <h3 className="mb-6 text-xl font-semibold">Distribuição por Categoria</h3>
              <div className="w-full overflow-x-auto">
                <PieChart data={categoryData} />
              </div>
            </section>

            <section className="rounded-2xl border border-[#2c313d] bg-[#1a1d24] p-5">
              <h2 className="mb-4 text-xl font-semibold">Participantes ({totalParticipants})</h2>
              {participants.length === 0 ? (
                <p className="text-sm text-[#b8bfd1]">Nenhum participante cadastrado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#34394a]">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-[#8f96a8] uppercase">Nome</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-[#8f96a8] uppercase">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-[#8f96a8] uppercase">Instituicao</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-[#8f96a8] uppercase">Cargo</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-[#8f96a8] uppercase">Cidade</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-[#8f96a8] uppercase">Check-in</th>
                      </tr>
                    </thead>
                    <tbody>
                      {participants.map((participant) => (
                        <tr key={participant.id} className="border-b border-[#34394a] hover:bg-[#212634] transition-colors">
                          <td className="px-4 py-3 font-medium text-[#d3d8e4]">{participant.name}</td>
                          <td className="px-4 py-3 text-[#9ba2b3]">{participant.email}</td>
                          <td className="px-4 py-3 text-[#9ba2b3]">{participant.institution || "-"}</td>
                          <td className="px-4 py-3 text-[#9ba2b3]">{participant.jobTitle || "-"}</td>
                          <td className="px-4 py-3 text-[#9ba2b3]">{participant.city ? `${participant.city}, ${participant.uf}` : "-"}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                              participant.checkIn
                                ? "bg-[#1d6a3f] text-[#ddf7e7]"
                                : "bg-[#6a3f1d] text-[#ffc9a3]"
                            }`}>
                              {participant.checkIn ? "✓ Presente" : "Ausente"}
                            </span>
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
