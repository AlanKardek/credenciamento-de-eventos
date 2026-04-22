"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { API_BASE_URL, TOKEN_STORAGE_KEY } from "@/app/constants/auth";

export default function AddParticipantPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const eventId = Number(params.id);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
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
    <main className="min-h-screen bg-[#111318] text-white">
      <div className="mx-auto max-w-2xl px-4 py-4 md:px-6">
        <div className="mb-4">
          <Link
            href={`/eventos/${eventId}`}
            className="rounded-md border border-[#3f4658] bg-[#232834] px-3 py-1.5 text-xs text-[#d3d8e4] hover:bg-[#2a3040]"
          >
            ← Voltar para Evento
          </Link>
        </div>

        {error && <p className="mb-4 text-sm text-[#f5a5a5]">{error}</p>}
        {successMessage && <p className="mb-4 text-sm text-[#ddf7e7]">{successMessage}</p>}

        <section className="rounded-lg border border-[#2c313d] bg-[#1a1d24] p-6">
          <h1 className="mb-6 text-2xl font-semibold">Adicionar Participante</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-[#d3d8e4] mb-2">
                  Nome *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-[#34394a] bg-[#0f1117] px-4 py-2 text-sm text-[#d3d8e4] placeholder-[#566575] focus:border-[#2f61ff] focus:outline-none"
                  placeholder="Nome completo"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-[#d3d8e4] mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-[#34394a] bg-[#0f1117] px-4 py-2 text-sm text-[#d3d8e4] placeholder-[#566575] focus:border-[#2f61ff] focus:outline-none"
                  placeholder="email@exemplo.com"
                />
              </div>

              <div>
                <label htmlFor="cpf" className="block text-sm font-medium text-[#d3d8e4] mb-2">
                  CPF *
                </label>
                <input
                  type="text"
                  id="cpf"
                  name="cpf"
                  value={formData.cpf}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-[#34394a] bg-[#0f1117] px-4 py-2 text-sm text-[#d3d8e4] placeholder-[#566575] focus:border-[#2f61ff] focus:outline-none"
                  placeholder="000.000.000-00"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-[#d3d8e4] mb-2">
                  Telefone
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[#34394a] bg-[#0f1117] px-4 py-2 text-sm text-[#d3d8e4] placeholder-[#566575] focus:border-[#2f61ff] focus:outline-none"
                  placeholder="(00) 99999-9999"
                />
              </div>

              <div>
                <label htmlFor="institution" className="block text-sm font-medium text-[#d3d8e4] mb-2">
                  Instituição
                </label>
                <input
                  type="text"
                  id="institution"
                  name="institution"
                  value={formData.institution}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[#34394a] bg-[#0f1117] px-4 py-2 text-sm text-[#d3d8e4] placeholder-[#566575] focus:border-[#2f61ff] focus:outline-none"
                  placeholder="Empresa/Universidade"
                />
              </div>

              <div>
                <label htmlFor="jobTitle" className="block text-sm font-medium text-[#d3d8e4] mb-2">
                  Cargo
                </label>
                <input
                  type="text"
                  id="jobTitle"
                  name="jobTitle"
                  value={formData.jobTitle}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[#34394a] bg-[#0f1117] px-4 py-2 text-sm text-[#d3d8e4] placeholder-[#566575] focus:border-[#2f61ff] focus:outline-none"
                  placeholder="Cargo/Função"
                />
              </div>

              <div>
                <label htmlFor="city" className="block text-sm font-medium text-[#d3d8e4] mb-2">
                  Cidade
                </label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[#34394a] bg-[#0f1117] px-4 py-2 text-sm text-[#d3d8e4] placeholder-[#566575] focus:border-[#2f61ff] focus:outline-none"
                  placeholder="Cidade"
                />
              </div>

              <div>
                <label htmlFor="uf" className="block text-sm font-medium text-[#d3d8e4] mb-2">
                  UF
                </label>
                <input
                  type="text"
                  id="uf"
                  name="uf"
                  value={formData.uf}
                  onChange={handleChange}
                  maxLength={2}
                  className="w-full rounded-lg border border-[#34394a] bg-[#0f1117] px-4 py-2 text-sm text-[#d3d8e4] placeholder-[#566575] focus:border-[#2f61ff] focus:outline-none uppercase"
                  placeholder="SP"
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="category" className="block text-sm font-medium text-[#d3d8e4] mb-2">
                  Categoria
                </label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[#34394a] bg-[#0f1117] px-4 py-2 text-sm text-[#d3d8e4] focus:border-[#2f61ff] focus:outline-none"
                >
                  <option value="PUBLICO_GERAL">Público Geral</option>
                  <option value="ESTUDANTE">Estudante</option>
                  <option value="EXPOSITOR">Expositor</option>
                  <option value="STAFF">Staff</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-lg border border-[#2f9e5f] bg-[#1d6a3f] px-6 py-2 text-sm font-semibold text-[#ddf7e7] hover:bg-[#247a4a] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Adicionando..." : "Adicionar Participante"}
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
      </div>
    </main>
  );
}
