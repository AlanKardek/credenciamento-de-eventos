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
  phone?: string | null;
  checkIn: boolean;
  institution?: string | null;
  jobTitle?: string | null;
  city?: string | null;
  uf?: string | null;
  category?: string | null;
  createdAt?: string | null;
};

type EventTab = "participants" | "category" | "document" | "import-export";

type CustomCategory = {
  key: string;
  label: string;
};

function normalizeCategoryKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

export default function EventDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const eventId = Number(params.id);
  const [token, setToken] = useState("");
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredParticipants, setFilteredParticipants] = useState<Participant[]>([]);
  const [archiving, setArchiving] = useState(false);
  const [activeTab, setActiveTab] = useState<EventTab>("participants");
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategoryKey, setEditingCategoryKey] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

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

  useEffect(() => {
    if (!Number.isInteger(eventId) || eventId <= 0) {
      return;
    }

    const stored = window.localStorage.getItem(`event_categories_${eventId}`);
    if (!stored) {
      setCustomCategories([]);
      return;
    }

    try {
      const parsed = JSON.parse(stored) as CustomCategory[];
      setCustomCategories(Array.isArray(parsed) ? parsed : []);
    } catch {
      setCustomCategories([]);
    }
  }, [eventId]);

  const formatCategoryLabel = (value?: string | null) =>
    value ? value.replace(/_/g, " ") : "Nao informado";

  const formatDateBr = (value?: string | null) => {
    if (!value) {
      return "-";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString("pt-BR");
  };

  const persistCustomCategories = (items: CustomCategory[]) => {
    setCustomCategories(items);
    window.localStorage.setItem(`event_categories_${eventId}`, JSON.stringify(items));
  };

  const archiveEvent = async () => {
    if (!event) return;

    setArchiving(true);
    const nextStatus = event.status === "ARCHIVED" ? "DRAFT" : "ARCHIVED";
    const nextRoute = nextStatus === "ARCHIVED" ? "/arquivados" : "/";

    try {
      const response = await fetch(`${API_BASE_URL}/admin/events/${eventId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...event,
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
        throw new Error("Erro ao arquivar evento");
      }

      // Atualizar o evento localmente
      setEvent((prev) =>
        prev ? { ...prev, status: nextStatus } : null
      );

      // Redirecionar para home após arquivar
      setTimeout(() => {
        router.push(nextRoute);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao arquivar evento");
    } finally {
      setArchiving(false);
    }
  };

  const downloadReport = async () => {
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
  };

  const downloadImportTemplate = () => {
    const headers = ["name", "email", "cpf", "phone", "institution", "jobTitle", "city", "uf", "category"];
    const example = ["Maria da Silva", "maria@email.com", "12345678901", "85999999999", "Faculdade X", "Coordenadora", "Fortaleza", "CE", "PUBLICO_GERAL"];
    const csv = [headers.join(","), example.join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `modelo_importacao_evento_${eventId}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
  };

  const startEditingCategory = (categoryKey: string, label: string) => {
    setEditingCategoryKey(categoryKey);
    setEditingCategoryName(label);
    setError("");
    setSuccessMessage("");
  };

  const cancelEditingCategory = () => {
    setEditingCategoryKey(null);
    setEditingCategoryName("");
  };

  const createCategory = () => {
    const trimmed = newCategoryName.trim();
    const nextKey = normalizeCategoryKey(trimmed);

    setError("");
    setSuccessMessage("");

    if (!trimmed) {
      setError("Informe um nome para a categoria.");
      return;
    }

    if (!nextKey) {
      setError("Informe um nome de categoria valido.");
      return;
    }

    const alreadyExists =
      customCategories.some((category) => category.key === nextKey) ||
      participants.some((participant) => normalizeCategoryKey(participant.category || "") === nextKey);

    if (alreadyExists) {
      setError("Essa categoria ja existe.");
      return;
    }

    persistCustomCategories([...customCategories, { key: nextKey, label: trimmed }]);
    setNewCategoryName("");
    setShowCreateCategory(false);
    setSuccessMessage("Categoria criada com sucesso.");
  };

  const saveCategoryEdition = async () => {
    if (!editingCategoryKey) {
      return;
    }

    const trimmed = editingCategoryName.trim();
    const nextKey = normalizeCategoryKey(trimmed);

    setError("");
    setSuccessMessage("");

    if (!trimmed || !nextKey) {
      setError("Informe um nome valido para a categoria.");
      return;
    }

    const duplicatedKey =
      nextKey !== editingCategoryKey &&
      (
        customCategories.some((category) => category.key === nextKey) ||
        participants.some((participant) => normalizeCategoryKey(participant.category || "") === nextKey)
      );

    if (duplicatedKey) {
      setError("Ja existe outra categoria com esse nome.");
      return;
    }

    setSavingCategory(true);

    try {
      const affectedParticipants = participants.filter(
        (participant) => normalizeCategoryKey(participant.category || "") === editingCategoryKey
      );

      if (affectedParticipants.length > 0) {
        const responses = await Promise.all(
          affectedParticipants.map((participant) =>
            fetch(`${API_BASE_URL}/admin/participants/${participant.id}`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                name: participant.name,
                email: participant.email,
                cpf: participant.cpf || "",
                phone: participant.phone || null,
                institution: participant.institution || null,
                jobTitle: participant.jobTitle || null,
                city: participant.city || null,
                uf: participant.uf || null,
                category: trimmed,
              }),
            })
          )
        );

        const unauthorized = responses.some((response) => response.status === 401);
        if (unauthorized) {
          window.localStorage.removeItem(TOKEN_STORAGE_KEY);
          router.replace("/login");
          return;
        }

        const forbidden = responses.some((response) => response.status === 403);
        if (forbidden) {
          throw new Error("Somente administradores podem editar categorias.");
        }

        const failedResponse = responses.find((response) => !response.ok);
        if (failedResponse) {
          let message = "Nao foi possivel atualizar a categoria.";
          try {
            const body = (await failedResponse.json()) as { error?: string };
            if (body?.error) {
              message = body.error;
            }
          } catch {}
          throw new Error(message);
        }

        setParticipants((current) =>
          current.map((participant) =>
            normalizeCategoryKey(participant.category || "") === editingCategoryKey
              ? { ...participant, category: nextKey, }
              : participant
          )
        );
      }

      const updatedCustomCategories = [
        ...customCategories.filter((category) => category.key !== editingCategoryKey && category.key !== nextKey),
        { key: nextKey, label: trimmed },
      ];

      persistCustomCategories(updatedCustomCategories);
      cancelEditingCategory();
      setSuccessMessage("Categoria atualizada com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao editar categoria.");
    } finally {
      setSavingCategory(false);
    }
  };

  const checkInCount = participants.filter(p => p.checkIn).length;
  const totalParticipants = participants.length;
  const percentualCheckIn = totalParticipants > 0 ? Math.round((checkInCount / totalParticipants) * 100) : 0;
  const participantsWithDocument = participants.filter((participant) => Boolean(participant.cpf)).length;
  const participantsWithoutDocument = totalParticipants - participantsWithDocument;
  const documentCompletion = totalParticipants > 0 ? Math.round((participantsWithDocument / totalParticipants) * 100) : 0;
  const eventTabs = [
    { id: "participants", label: "Participantes" },
    { id: "category", label: "Categoria" },
    { id: "document", label: "Documento" },
    { id: "import-export", label: "Import/Export" },
  ];

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

  const categorySummary = [...categoryData].sort((a, b) => b.value - a.value);
  const participantsMissingDocument = filteredParticipants.filter((participant) => !participant.cpf);
  const categoryCountMap = categoryData.reduce<Record<string, number>>((acc, item) => {
    acc[normalizeCategoryKey(item.name)] = item.value;
    return acc;
  }, {});
  const managedCategories = [
    ...categorySummary.map((item) => {
      const key = normalizeCategoryKey(item.name);
      const customMatch = customCategories.find((category) => category.key === key);

      return {
        key,
        label: customMatch?.label || formatCategoryLabel(item.name),
        count: item.value,
        hasParticipants: true,
      };
    }),
    ...customCategories
      .filter((category) => !(normalizeCategoryKey(category.key) in categoryCountMap))
      .map((category) => ({
        key: category.key,
        label: category.label,
        count: 0,
        hasParticipants: false,
      })),
  ];
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
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-4 md:px-6">
        <section className="mb-4 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
            <nav className="flex flex-wrap items-center gap-2">
              {eventTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as EventTab)}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? "bg-blue-50 dark:bg-slate-700 text-blue-700 dark:text-blue-400"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            <Link
              href="/"
              className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap transition-colors"
            >
              ← Voltar
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 px-4 py-3">
            {!loading && !error && event ? (
              <>
                <button
                  onClick={() => router.push(`/eventos/${eventId}/participantes/novo`)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900 hover:bg-green-100 dark:hover:bg-green-800 px-3 py-2 text-xs font-semibold text-green-700 dark:text-green-300 transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M12 5v14m7-7H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Adicionar Participante</span>
                </button>
                <button
                  onClick={() => setSearchOpen(!searchOpen)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                    <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <span>Buscar</span>
                </button>
                <button
                  onClick={() => router.push(`/eventos/${eventId}/editar`)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900 hover:bg-blue-100 dark:hover:bg-blue-800 px-3 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M3 17.25V21h3.75L17.81 9.94m-4.51-4.51l2.83-2.83c.39-.39 1.02-.39 1.41 0l2.83 2.83c.39.39.39 1.02 0 1.41l-2.83 2.83" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>Editar Evento</span>
                </button>
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
                  title="QR Code"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="8" height="8" stroke="currentColor" strokeWidth="1.5"/>
                    <rect x="13" y="3" width="8" height="8" stroke="currentColor" strokeWidth="1.5"/>
                    <rect x="3" y="13" width="8" height="8" stroke="currentColor" strokeWidth="1.5"/>
                    <rect x="15" y="15" width="4" height="4" stroke="currentColor" strokeWidth="1"/>
                  </svg>
                </button>
              </>
            ) : null}
          </div>
        </section>


        {searchOpen && activeTab === "participants" && (
          <div className="mb-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
            <input
              type="text"
              placeholder="Buscar por nome, email ou instituição..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 dark:focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            {searchQuery && (
              <p className="mt-2 text-xs text-[#8f96a8]">
                {filteredParticipants.length} participante(s) encontrado(s)
              </p>
            )}
          </div>
        )}

        {loading ? <p className="text-xs text-slate-500">Carregando...</p> : null}
        {error ? <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p> : null}
        {successMessage ? <p className="mt-1 text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg p-3">{successMessage}</p> : null}

        {!loading && !error && event ? (
          <>
            {activeTab === "participants" ? (
              <>
            <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
              <h1 className="text-2xl font-bold mb-3 text-slate-900">{event.title}</h1>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-slate-500 uppercase tracking-wide text-xs mb-1 font-semibold">Descrição</p>
                  <p className="text-slate-700">{event.description || "-"}</p>
                </div>
                <div>
                  <p className="text-slate-500 uppercase tracking-wide text-xs mb-1 font-semibold">Organização</p>
                  <p className="text-slate-700">{event.organizer || "-"}</p>
                </div>
                <div>
                  <p className="text-[#8f96a8] uppercase tracking-wide text-xs mb-1">Data</p>
                  <p className="text-[#d3d8e4]">{formatDateBr(event.date)}</p>
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

            {activeTab === "category" ? (
              <>
                <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                  <div className="rounded-lg border border-[#2c313d] bg-[#1a1d24] p-4">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold uppercase">Categorias</h2>
                        <p className="mt-1 text-sm text-[#9ba2b3]">
                          Gerencie os nomes das categorias do evento.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateCategory((current) => !current);
                          setNewCategoryName("");
                        }}
                        className="rounded-md border border-[#2f9e5f] bg-[#1d6a3f] px-4 py-2 text-sm font-semibold text-[#ddf7e7] hover:bg-[#247a4a]"
                      >
                        Criar categoria
                      </button>
                    </div>

                    {showCreateCategory ? (
                      <div className="mb-4 rounded-lg border border-[#34394a] bg-[#0f1117] p-4">
                        <label className="mb-2 block text-sm font-medium text-[#d3d8e4]" htmlFor="new-category">
                          Nova categoria
                        </label>
                        <input
                          id="new-category"
                          type="text"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="Ex: Imprensa"
                          className="w-full rounded-lg border border-[#34394a] bg-[#161b24] px-4 py-2 text-sm text-[#d3d8e4] placeholder-[#566575] focus:border-[#2f61ff] focus:outline-none"
                        />
                        <div className="mt-3 flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowCreateCategory(false);
                              setNewCategoryName("");
                            }}
                            className="rounded-md border border-[#3f4658] bg-[#232834] px-4 py-2 text-sm text-[#d3d8e4] hover:bg-[#2a3040]"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={createCategory}
                            className="rounded-md border border-[#2f9e5f] bg-[#1d6a3f] px-4 py-2 text-sm font-semibold text-[#ddf7e7] hover:bg-[#247a4a]"
                          >
                            Salvar categoria
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {managedCategories.length === 0 ? (
                      <p className="text-sm text-[#b8bfd1]">Ainda nao existem categorias cadastradas para este evento.</p>
                    ) : (
                      <div className="space-y-3">
                        {managedCategories.map((category) => (
                          <div
                            key={category.key}
                            className="rounded-lg border border-[#34394a] bg-[#0f1117] p-4"
                          >
                            {editingCategoryKey === category.key ? (
                              <>
                                <label className="mb-2 block text-sm font-medium text-[#d3d8e4]">
                                  Editar categoria
                                </label>
                                <input
                                  type="text"
                                  value={editingCategoryName}
                                  onChange={(e) => setEditingCategoryName(e.target.value)}
                                  className="w-full rounded-lg border border-[#34394a] bg-[#161b24] px-4 py-2 text-sm text-[#d3d8e4] placeholder-[#566575] focus:border-[#2f61ff] focus:outline-none"
                                />
                                <div className="mt-3 flex flex-wrap justify-between gap-3">
                                  <p className="text-xs text-[#8f96a8]">
                                    {category.hasParticipants
                                      ? `${category.count} participante(s) serao atualizados.`
                                      : "Categoria vazia, pronta para uso futuro."}
                                  </p>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={cancelEditingCategory}
                                      className="rounded-md border border-[#3f4658] bg-[#232834] px-3 py-1.5 text-xs text-[#d3d8e4] hover:bg-[#2a3040]"
                                    >
                                      Cancelar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={saveCategoryEdition}
                                      disabled={savingCategory}
                                      className="rounded-md border border-[#2f61ff] bg-[#1b2f7a] px-3 py-1.5 text-xs font-semibold text-[#dbe6ff] hover:bg-[#203a95] disabled:opacity-60"
                                    >
                                      {savingCategory ? "Salvando..." : "Salvar"}
                                    </button>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-[#dbe6ff]">{category.label}</p>
                                  <p className="mt-1 text-xs text-[#8f96a8]">
                                    {category.count} participante(s)
                                    {!category.hasParticipants ? " | categoria sem uso ainda" : ""}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => startEditingCategory(category.key, category.label)}
                                  className="rounded-md border border-[#3f4658] bg-[#232834] px-3 py-1.5 text-xs font-semibold text-[#d3d8e4] hover:bg-[#2a3040]"
                                >
                                  Editar
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-lg border border-[#2c313d] bg-[#1a1d24] p-4">
                      <h3 className="mb-4 text-sm font-semibold uppercase">Participantes por categoria</h3>
                      {categorySummary.length === 0 ? (
                        <p className="text-sm text-[#b8bfd1]">Sem dados de categoria para exibir.</p>
                      ) : (
                        <div className="space-y-3">
                          {categorySummary.map((category) => {
                            const percent = totalParticipants > 0 ? Math.round((category.value / totalParticipants) * 100) : 0;
                            return (
                              <div key={`${category.name}-bar`}>
                                <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                                  <span className="text-[#d3d8e4]">{formatCategoryLabel(category.name)}</span>
                                  <span className="text-[#8f96a8]">{category.value} participante(s)</span>
                                </div>
                                <div className="h-2 rounded-full bg-[#0f1117]">
                                  <div
                                    className="h-2 rounded-full bg-[#2f61ff]"
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg border border-[#2c313d] bg-[#1a1d24] p-4">
                      <h3 className="mb-4 text-sm font-semibold uppercase">Distribuicao visual</h3>
                      {categorySummary.length === 0 ? (
                        <p className="text-sm text-[#b8bfd1]">Sem categorias registradas.</p>
                      ) : (
                        <div className="w-full overflow-x-auto">
                          <PieChart data={categoryData} />
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </>
            ) : null}

            {activeTab === "document" ? (
              <>
                <section className="mb-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-[#2c313d] bg-[#1a1d24] p-4">
                    <p className="text-[#8f96a8] uppercase tracking-wide text-xs mb-2">Documentos preenchidos</p>
                    <p className="text-4xl font-bold text-[#ddf7e7]">{participantsWithDocument}</p>
                  </div>
                  <div className="rounded-lg border border-[#2c313d] bg-[#1a1d24] p-4">
                    <p className="text-[#8f96a8] uppercase tracking-wide text-xs mb-2">Pendentes</p>
                    <p className="text-4xl font-bold text-[#ffc9a3]">{participantsWithoutDocument}</p>
                  </div>
                  <div className="rounded-lg border border-[#2c313d] bg-[#1a1d24] p-4">
                    <p className="text-[#8f96a8] uppercase tracking-wide text-xs mb-2">Conclusao</p>
                    <p className="text-4xl font-bold text-[#dbe6ff]">{documentCompletion}%</p>
                  </div>
                </section>

                <section className="rounded-lg border border-[#2c313d] bg-[#1a1d24] p-4">
                  <h2 className="mb-4 text-lg font-semibold uppercase">Controle de documentos</h2>
                  <p className="mb-4 text-sm text-[#9ba2b3]">
                    Pendencias no filtro atual: {participantsMissingDocument.length}
                  </p>
                  {filteredParticipants.length === 0 ? (
                    <p className="text-sm text-[#b8bfd1]">Nenhum participante disponivel para conferência de documentos.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b-2 border-[#2f61ff] bg-[#0f1117]">
                            <th className="px-4 py-3 text-left text-[#2f61ff] font-bold uppercase tracking-wide">Nome</th>
                            <th className="px-4 py-3 text-left text-[#2f61ff] font-bold uppercase tracking-wide">CPF</th>
                            <th className="px-4 py-3 text-left text-[#2f61ff] font-bold uppercase tracking-wide hidden md:table-cell">Email</th>
                            <th className="px-4 py-3 text-left text-[#2f61ff] font-bold uppercase tracking-wide">Situacao</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredParticipants.map((participant, index) => (
                            <tr
                              key={`document-${participant.id}`}
                              className={`${index % 2 === 0 ? "bg-[#0f1117]" : "bg-[#1a1d24]"} border-b border-[#34394a]`}
                            >
                              <td className="px-4 py-3 text-sm font-semibold text-[#d3d8e4]">{participant.name}</td>
                              <td className="px-4 py-3 text-sm text-[#9ba2b3]">{participant.cpf || "-"}</td>
                              <td className="px-4 py-3 text-sm text-[#9ba2b3] hidden md:table-cell">{participant.email}</td>
                              <td className="px-4 py-3 text-sm">
                                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                  participant.cpf ? "bg-[#1d6a3f] text-[#ddf7e7]" : "bg-[#6a3f1d] text-[#ffc9a3]"
                                }`}>
                                  {participant.cpf ? "Completo" : "Pendente"}
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

            {activeTab === "import-export" ? (
              <>
                <section className="mb-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-[#2c313d] bg-[#1a1d24] p-5">
                    <h2 className="text-lg font-semibold text-[#dbe6ff]">Exportar participantes</h2>
                    <p className="mt-2 text-sm text-[#9ba2b3]">
                      Baixe o relatorio completo do evento em CSV com dados de cadastro e check-in.
                    </p>
                    <button
                      onClick={downloadReport}
                      className="mt-4 inline-flex items-center gap-2 rounded-md border border-[#2f61ff] bg-[#1b2f7a] px-4 py-2 text-sm font-semibold text-[#dbe6ff] hover:bg-[#203a95]"
                    >
                      <span>Exportar CSV</span>
                    </button>
                  </div>

                  <div className="rounded-lg border border-[#2c313d] bg-[#1a1d24] p-5">
                    <h2 className="text-lg font-semibold text-[#dbe6ff]">Modelo de importacao</h2>
                    <p className="mt-2 text-sm text-[#9ba2b3]">
                      Baixe um modelo base para preparar planilhas de importacao de participantes.
                    </p>
                    <button
                      onClick={downloadImportTemplate}
                      className="mt-4 inline-flex items-center gap-2 rounded-md border border-[#2f9e5f] bg-[#1d6a3f] px-4 py-2 text-sm font-semibold text-[#ddf7e7] hover:bg-[#247a4a]"
                    >
                      <span>Baixar modelo CSV</span>
                    </button>
                  </div>
                </section>

                <section className="rounded-lg border border-[#2c313d] bg-[#1a1d24] p-5">
                  <h3 className="text-sm font-semibold uppercase text-[#dbe6ff]">Importacao em lote</h3>
                  <p className="mt-3 text-sm text-[#9ba2b3]">
                    A importacao automatica pelo sistema ainda nao esta conectada ao backend, mas o modelo CSV ja
                    deixa a estrutura pronta para essa proxima etapa.
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-[#34394a] bg-[#0f1117] p-4">
                      <p className="text-xs uppercase tracking-wide text-[#8f96a8]">Total atual</p>
                      <p className="mt-2 text-3xl font-bold text-[#dbe6ff]">{totalParticipants}</p>
                    </div>
                    <div className="rounded-lg border border-[#34394a] bg-[#0f1117] p-4">
                      <p className="text-xs uppercase tracking-wide text-[#8f96a8]">Check-ins</p>
                      <p className="mt-2 text-3xl font-bold text-[#ddf7e7]">{checkInCount}</p>
                    </div>
                    <div className="rounded-lg border border-[#34394a] bg-[#0f1117] p-4">
                      <p className="text-xs uppercase tracking-wide text-[#8f96a8]">Documentos completos</p>
                      <p className="mt-2 text-3xl font-bold text-[#ffc9a3]">{participantsWithDocument}</p>
                    </div>
                  </div>
                </section>
              </>
            ) : null}

          </>
        ) : null}
      </div>
    </main>
  );
}
