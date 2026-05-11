"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { API_BASE_URL, TOKEN_STORAGE_KEY } from "@/app/constants/auth";
import { UF_OPTIONS } from "@/app/constants/uf-options";

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

export default function AddParticipantPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const eventId = Number(params.id);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [customCategories, setCustomCategories] = useState<CategoryOption[]>([]);

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
  ];

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
    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/admin/participants`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          eventId,
        }),
      });

      if (response.status === 401 || response.status === 403) {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao adicionar participante");
      }

      setSuccessMessage("Participante adicionado com sucesso!");
      setFormData({
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

      setTimeout(() => {
        router.push(`/eventos/${eventId}`);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar participante");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="theme-page">
      <div className="mx-auto max-w-2xl px-4 py-4 md:px-6">
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

        <section className="theme-panel rounded-lg p-6">
          <h1 className="mb-6 text-2xl font-semibold">Adicionar Participante</h1>

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
                disabled={loading}
                className="flex-1 rounded-lg border border-green-700 bg-green-600 px-6 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Adicionando..." : "Adicionar Participante"}
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
      </div>
    </main>
  );
}

