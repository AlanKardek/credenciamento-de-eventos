"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { API_BASE_URL, TOKEN_STORAGE_KEY } from "@/app/constants/auth";
import { UF_OPTIONS } from "@/app/constants/uf-options";

type ParticipantFormData = {
  id?: number;
  eventId?: number;
  name?: string | null;
  email?: string | null;
  cpf?: string | null;
  phone?: string | null;
  checkIn?: boolean;
  checkedInAt?: string | null;
  institution?: string | null;
  jobTitle?: string | null;
  city?: string | null;
  uf?: string | null;
  category?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ParticipantLog = {
  id: string;
  action: string;
  message?: string | null;
  createdAt: string;
  actor?: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
};

// Funções de máscara
const maskPhone = (value: string): string => {
  const numbers = value.replace(/\D/g, "");
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 7) return `(${numbers.slice(0, 2)})${numbers.slice(2)}`;
  return `(${numbers.slice(0, 2)})${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
};

const maskCPF = (value: string): string => {
  const numbers = value.replace(/\D/g, "");
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
  if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
  return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
};

type CategoryOption = {
  key: string;
  label: string;
};

const BASE_CATEGORY_OPTIONS: CategoryOption[] = [
  { key: "PUBLICO_GERAL", label: "Publico Geral" },
  { key: "ESTUDANTE", label: "Estudante" },
  { key: "EXPOSITOR", label: "Expositor" },
  { key: "STAFF", label: "Staff" },
];

export default function EditParticipantPage() {
  const params = useParams<{ id: string; participantId: string }>();
  const router = useRouter();
  const eventId = Number(params.id);
  const participantId = Number(params.participantId);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [customCategories, setCustomCategories] = useState<CategoryOption[]>([]);
  const [participant, setParticipant] = useState<ParticipantFormData | null>(null);
  const [activityLogs, setActivityLogs] = useState<ParticipantLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [printingBadge, setPrintingBadge] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    cpf: "",
    phone: "",
    institution: "",
    jobTitle: "",
    city: "",
    uf: "",
    category: "PUBLICO_GERAL",
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
    if (!Number.isInteger(eventId) || eventId <= 0) {
      return;
    }

    const stored = window.localStorage.getItem(`event_categories_${eventId}`);
    if (!stored) {
      setCustomCategories([]);
      return;
    }

    try {
      const parsed = JSON.parse(stored) as CategoryOption[];
      setCustomCategories(Array.isArray(parsed) ? parsed : []);
    } catch {
      setCustomCategories([]);
    }
  }, [eventId]);

  const categoryOptions = [
    ...BASE_CATEGORY_OPTIONS,
    ...customCategories.filter(
      (category) => !BASE_CATEGORY_OPTIONS.some((base) => base.key === category.key)
    ),
    ...(formData.category &&
    !BASE_CATEGORY_OPTIONS.some((base) => base.key === formData.category) &&
    !customCategories.some((category) => category.key === formData.category)
      ? [{ key: formData.category, label: formData.category.replace(/_/g, " ") }]
      : []),
  ];

  async function loadActivityLogs(participantIdToLoad: number, authToken = token) {
    if (!authToken || !Number.isInteger(participantIdToLoad) || participantIdToLoad <= 0) {
      return;
    }

    setLogsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/participants/${participantIdToLoad}/activity-logs`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (response.status === 401 || response.status === 403) {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        throw new Error("Não foi possível carregar os logs.");
      }

      const data = (await response.json()) as { participant: ParticipantFormData; logs: ParticipantLog[] };
      setParticipant(data.participant);
      setActivityLogs(data.logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar logs.");
    } finally {
      setLogsLoading(false);
    }
  }

  useEffect(() => {
    if (!token) {
      return;
    }

    let active = true;

    async function loadParticipant() {
      setLoading(true);
      setError("");

      try {
        // Se o parâmetro for um ID numérico válido, buscar todos participantes e localizar por id
        if (Number.isInteger(participantId) && participantId > 0) {
          const response = await fetch(`${API_BASE_URL}/events/${eventId}/participants`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (response.status === 401 || response.status === 403) {
            window.localStorage.removeItem(TOKEN_STORAGE_KEY);
            router.replace("/login");
            return;
          }

          if (!response.ok) {
            throw new Error("Não foi possível carregar os dados do participante.");
          }

          const participants = (await response.json()) as ParticipantFormData[];
          const participant = participants.find(p => p.id === participantId);

          if (!participant) {
            throw new Error("Participante não encontrado.");
          }

          if (active) {
            setParticipant(participant);
            setFormData({
              name: participant.name || "",
              email: participant.email || "",
              cpf: participant.cpf || "",
              phone: participant.phone || "",
              institution: participant.institution || "",
              jobTitle: participant.jobTitle || "",
              city: participant.city || "",
              uf: participant.uf || "",
              category: participant.category || "PUBLICO_GERAL",
            });
            void loadActivityLogs(participant.id!, token);
          }

          return;
        }

        // Caso não seja um ID numérico, tratar como busca por nome/cpf
        const queryStr = String(params.participantId || "").trim();
        if (!queryStr || queryStr.length < 2) {
          throw new Error("Informe nome ou CPF com ao menos 2 caracteres para busca.");
        }

        const response = await fetch(`${API_BASE_URL}/events/${eventId}/participants/search?q=${encodeURIComponent(queryStr)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 401 || response.status === 403) {
          window.localStorage.removeItem(TOKEN_STORAGE_KEY);
          router.replace("/login");
          return;
        }

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || "Não foi possível carregar os dados do participante.");
        }

        const participants = (await response.json()) as ParticipantFormData[];

        // Primeiro tentar CPF (apenas dígitos)
        const digitsQuery = queryStr.replace(/\D/g, "");
        let participant = digitsQuery ? participants.find(p => (p.cpf || "").replace(/\D/g, "") === digitsQuery) : undefined;

        // Depois tentar por nome (contains, case-insensitive)
        if (!participant) {
          const qLower = queryStr.toLowerCase();
          participant = participants.find(p => (p.name || "").toLowerCase().includes(qLower) || (p.email || "").toLowerCase().includes(qLower));
        }

        if (!participant) {
          throw new Error("Participante não encontrado.");
        }

        if (active) {
          setParticipant(participant);
          setFormData({
            name: participant.name || "",
            email: participant.email || "",
            cpf: participant.cpf || "",
            phone: participant.phone || "",
            institution: participant.institution || "",
            jobTitle: participant.jobTitle || "",
            city: participant.city || "",
            uf: participant.uf || "",
            category: participant.category || "PUBLICO_GERAL",
          });
          if (participant.id) {
            void loadActivityLogs(participant.id, token);
          }
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Erro ao carregar participante.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadParticipant();

    return () => {
      active = false;
    };
  }, [eventId, participantId, token]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    let finalValue = value;

    // Aplicar máscaras
    if (name === "phone") {
      finalValue = maskPhone(value);
    } else if (name === "cpf") {
      finalValue = maskCPF(value);
    } else if (name === "uf") {
      finalValue = value.toUpperCase();
    }

    setFormData((prev) => ({
      ...prev,
      [name]: finalValue,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/admin/participants/${participantId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.status === 401 || response.status === 403) {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao atualizar participante");
      }

      const updatedParticipant = (await response.json()) as ParticipantFormData;
      setSuccessMessage("Participante atualizado com sucesso!");
      setParticipant(updatedParticipant);
      await loadActivityLogs(participantId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar participante");
    } finally {
      setSaving(false);
    }
  };

  async function handlePrintBadge() {
    setPrintingBadge(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/admin/participants/${participantId}/print-badge`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401 || response.status === 403) {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        throw new Error("Não foi possível registrar a impressão do crachá.");
      }

      openBadgePrintWindow();
      await loadActivityLogs(participantId);
      setSuccessMessage("Crachá enviado para impressão.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao imprimir crachá.");
    } finally {
      setPrintingBadge(false);
    }
  }

  function openBadgePrintWindow() {
    const windowRef = window.open("", "_blank", "width=620,height=520");
    if (!windowRef) return;

    const categoryLabel =
      categoryOptions.find((category) => category.key === formData.category)?.label ||
      formData.category.replace(/_/g, " ");

    windowRef.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Crachá - ${formData.name}</title>
          <style>
            body { margin: 0; padding: 24px; font-family: Arial, sans-serif; background: #f8fafc; color: #0f172a; }
            .badge { width: 360px; min-height: 230px; margin: 0 auto; border: 2px solid #0f172a; border-radius: 18px; background: white; padding: 22px; display: grid; grid-template-columns: 1fr 86px; gap: 16px; box-shadow: 0 18px 40px rgba(15,23,42,.16); }
            .eyebrow { margin: 0 0 18px; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: .12em; }
            h1 { margin: 0; font-size: 26px; line-height: 1.05; }
            p { margin: 8px 0 0; font-size: 13px; color: #334155; }
            .qr { width: 86px; height: 86px; border: 2px solid #0f172a; display: grid; place-items: center; font-weight: 800; font-size: 13px; align-self: start; }
            .footer { grid-column: 1 / -1; border-top: 1px solid #cbd5e1; padding-top: 12px; display: flex; justify-content: space-between; font-size: 12px; color: #475569; }
            @media print { body { background: white; } .badge { box-shadow: none; } }
          </style>
        </head>
        <body>
          <section class="badge">
            <div>
              <p class="eyebrow">Credenciamento</p>
              <h1>${formData.name}</h1>
              <p>${categoryLabel}</p>
              <p>${formData.institution || formData.email}</p>
            </div>
            <div class="qr">ID ${participantId}</div>
            <div class="footer">
              <span>${formData.city || "Evento"}${formData.uf ? ` / ${formData.uf}` : ""}</span>
              <span>${formData.cpf || "CPF pendente"}</span>
            </div>
          </section>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    windowRef.document.close();
  }

  function formatDateTime(value?: string | null) {
    if (!value) return "-";
    return new Date(value).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getLogLabel(action: string) {
    const labels: Record<string, string> = {
      CREATED: "Cadastro criado",
      UPDATED: "Cadastro editado",
      BADGE_PRINTED: "Crachá impresso",
      CHECK_IN: "Check-in via QR Code",
      UNDO_CHECK_IN: "Check-in removido",
    };
    return labels[action] || action;
  }

  function getLogDotClass(action: string) {
    if (action === "CHECK_IN") return "bg-green-500";
    if (action === "BADGE_PRINTED") return "bg-blue-500";
    if (action === "UPDATED") return "bg-amber-500";
    if (action === "UNDO_CHECK_IN") return "bg-red-500";
    return "bg-slate-500";
  }

  if (loading) {
    return (
      <main className="theme-page">
        <div className="mx-auto max-w-2xl px-4 py-4 md:px-6">
          <p className="text-sm theme-muted">Carregando...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="theme-page">
      <div className="mx-auto max-w-7xl px-4 py-4 md:px-6">
        <div className="mb-4">
          <Link
            href={`/eventos/${eventId}`}
            className="theme-secondary-button rounded-md px-3 py-1.5 text-xs"
          >
            ← Voltar para Evento
          </Link>
        </div>

        {error && <p className="theme-error-message mb-4 rounded-lg p-3 text-sm">{error}</p>}
        {successMessage && <p className="theme-success-message mb-4 rounded-lg p-3 text-sm">{successMessage}</p>}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
        <section className="theme-panel rounded-lg p-6">
          <div className="mb-6 border-b border-slate-200 pb-4 dark:border-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="h-6 w-6 rounded-full border-4 border-slate-700 bg-black dark:border-slate-600" />
                <h1 className="border-b border-current text-2xl font-semibold">Participante</h1>
              </div>
              <span className={`rounded-full px-4 py-1 text-sm font-semibold ${
                participant?.checkIn
                  ? "border border-green-700 bg-green-950/30 text-green-600 dark:text-green-300"
                  : "border border-amber-700 bg-amber-950/20 text-amber-600 dark:text-amber-300"
              }`}>
                {participant?.checkIn ? "CONFIRMADO" : "PENDENTE"}
              </span>
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-5">
              <div>
                <p className="theme-muted text-xs">Check-in</p>
                <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                  participant?.checkIn ? "bg-green-600 text-white" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                }`}>
                  {participant?.checkIn ? "SIM" : "NÃO"}
                </span>
              </div>
              <InfoMetric label="Código" value={participant?.id ? String(participant.id).padStart(6, "0").toUpperCase() : "-"} />
              <InfoMetric label="Tipo" value="IMPORTADO" />
              <InfoMetric label="Criado em" value={formatDateTime(participant?.createdAt)} />
              <InfoMetric label="Atualizado em" value={formatDateTime(participant?.updatedAt)} />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="theme-label mb-2 block text-sm font-medium">
                  Nome *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="theme-input w-full rounded-lg px-4 py-2 text-sm"
                  placeholder="Nome completo"
                />
              </div>

              <div>
                <label htmlFor="email" className="theme-label mb-2 block text-sm font-medium">
                  Email *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="theme-input w-full rounded-lg px-4 py-2 text-sm"
                  placeholder="email@exemplo.com"
                />
              </div>

              <div>
                <label htmlFor="cpf" className="theme-label mb-2 block text-sm font-medium">
                  CPF *
                </label>
                <input
                  type="text"
                  id="cpf"
                  name="cpf"
                  value={formData.cpf}
                  onChange={handleChange}
                  required
                  maxLength={14}
                  className="theme-input w-full rounded-lg px-4 py-2 text-sm"
                  placeholder="000.000.000-00"
                />
              </div>

              <div>
                <label htmlFor="phone" className="theme-label mb-2 block text-sm font-medium">
                  Telefone
                </label>
                <input
                  type="text"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  maxLength={14}
                  className="theme-input w-full rounded-lg px-4 py-2 text-sm"
                  placeholder="(00)00000-0000"
                />
              </div>

              <div>
                <label htmlFor="institution" className="theme-label mb-2 block text-sm font-medium">
                  Instituição
                </label>
                <input
                  type="text"
                  id="institution"
                  name="institution"
                  value={formData.institution}
                  onChange={handleChange}
                  className="theme-input w-full rounded-lg px-4 py-2 text-sm"
                  placeholder="Empresa/Universidade"
                />
              </div>

              <div>
                <label htmlFor="jobTitle" className="theme-label mb-2 block text-sm font-medium">
                  Cargo
                </label>
                <input
                  type="text"
                  id="jobTitle"
                  name="jobTitle"
                  value={formData.jobTitle}
                  onChange={handleChange}
                  className="theme-input w-full rounded-lg px-4 py-2 text-sm"
                  placeholder="Cargo/Função"
                />
              </div>

              <div>
                <label htmlFor="city" className="theme-label mb-2 block text-sm font-medium">
                  Cidade
                </label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="theme-input w-full rounded-lg px-4 py-2 text-sm"
                  placeholder="Cidade"
                />
              </div>

              <div>
                <label htmlFor="uf" className="theme-label mb-2 block text-sm font-medium">
                  Estado (UF)
                </label>
                <select
                  id="uf"
                  name="uf"
                  value={formData.uf}
                  onChange={handleChange}
                  className="theme-input w-full rounded-lg px-4 py-2 text-sm"
                >
                  <option value="">Selecione um estado...</option>
                  {UF_OPTIONS.map((uf) => (
                    <option key={uf.value} value={uf.value}>
                      {uf.label} ({uf.value})
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label htmlFor="category" className="theme-label mb-2 block text-sm font-medium">
                  Categoria
                </label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="theme-input w-full rounded-lg px-4 py-2 text-sm"
                >
                  {categoryOptions.map((category) => (
                    <option key={category.key} value={category.key}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-lg border border-green-700 bg-green-600 px-6 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Atualizando..." : "Atualizar Participante"}
              </button>
              <button
                type="button"
                onClick={() => router.push(`/eventos/${eventId}`)}
                className="theme-secondary-button flex-1 rounded-lg px-6 py-2 text-sm font-semibold"
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
        <aside className="space-y-6">
          <section className="theme-panel rounded-lg p-6">
            <h2 className="text-lg font-semibold">Imprimir</h2>
            <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
              <button
                type="button"
                onClick={handlePrintBadge}
                disabled={printingBadge}
                className="w-full rounded-md border border-blue-500 px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-blue-300 dark:hover:bg-blue-950"
              >
                {printingBadge ? "Enviando..." : "▣ Reimprimir Crachá"}
              </button>
            </div>
          </section>

          <section className="theme-panel rounded-lg p-6">
            <h2 className="text-lg font-semibold">Logs</h2>
            <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
              {logsLoading ? (
                <p className="text-sm theme-muted">Carregando logs...</p>
              ) : activityLogs.length === 0 ? (
                <p className="text-sm theme-muted">Nenhum log registrado.</p>
              ) : (
                <div className="space-y-4">
                  {activityLogs.map((log) => (
                    <article key={log.id} className="flex gap-3">
                      <span className={`mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ${getLogDotClass(log.action)}`} />
                      <div>
                        <p className="text-sm font-semibold">{getLogLabel(log.action)}</p>
                        <p className="text-xs theme-muted">{log.message || "Registro operacional do participante."}</p>
                        <p className="mt-1 text-xs theme-muted">
                          {formatDateTime(log.createdAt)}
                          {log.actor?.name ? ` · ${log.actor.name}` : ""}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        </aside>
        </div>
      </div>
    </main>
  );
}

function InfoMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="theme-muted text-xs">{label}</p>
      <p className="mt-1 truncate text-sm font-medium">{value}</p>
    </div>
  );
}
