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

      <main className="flex-1 p-6 bg-gray-100 min-h-screen">
        <h1 className="text-2xl font-bold mb-4">Cadastro e Edicao de Participante</h1>

        <form className="bg-white p-4 rounded shadow max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label htmlFor="nome" className="block text-sm font-medium mb-1">
              Nome
            </label>
            <input
              id="nome"
              value={formData.nome}
              onChange={(e) => updateField("nome", e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => updateField("email", e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="cpf" className="block text-sm font-medium mb-1">
              CPF
            </label>
            <input
              id="cpf"
              value={formData.cpf}
              onChange={(e) => updateField("cpf", e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="uf" className="block text-sm font-medium mb-1">
              UF
            </label>
            <select
              id="uf"
              value={formData.uf}
              onChange={(e) => updateField("uf", e.target.value)}
              className="w-full border rounded px-3 py-2"
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


