"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import { UF_OPTIONS } from "@/app/constants/uf-options";

export default function ParticipantesPage() {
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    cpf: "",
    uf: "",
  });

  function updateField(field: keyof typeof formData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="flex">
      <Sidebar />

      <main className="theme-page flex-1 p-6">
        <h1 className="mb-4 text-2xl font-bold">Cadastro e Edicao de Participante</h1>

        <form className="theme-panel grid max-w-2xl grid-cols-1 gap-4 rounded-lg p-4 shadow-sm md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="nome" className="theme-label mb-1 block text-sm font-medium">
              Nome
            </label>
            <input
              id="nome"
              value={formData.nome}
              onChange={(e) => updateField("nome", e.target.value)}
              className="theme-input w-full rounded px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="email" className="theme-label mb-1 block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => updateField("email", e.target.value)}
              className="theme-input w-full rounded px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="cpf" className="theme-label mb-1 block text-sm font-medium">
              CPF
            </label>
            <input
              id="cpf"
              value={formData.cpf}
              onChange={(e) => updateField("cpf", e.target.value)}
              className="theme-input w-full rounded px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="uf" className="theme-label mb-1 block text-sm font-medium">
              UF
            </label>
            <select
              id="uf"
              value={formData.uf}
              onChange={(e) => updateField("uf", e.target.value)}
              className="theme-input w-full rounded px-3 py-2"
            >
              <option value="">Selecione a UF</option>
              {UF_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </form>
      </main>
    </div>
  );
}


