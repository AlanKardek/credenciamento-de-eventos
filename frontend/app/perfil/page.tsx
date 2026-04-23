"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_BASE_URL, TOKEN_STORAGE_KEY } from "@/app/constants/auth";

type ProfileResponse = {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt?: string;
  updatedAt?: string;
};

type UpdateProfileResponse = {
  token: string;
  user: ProfileResponse;
};

export default function ProfilePage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    currentPassword: "",
    password: "",
    confirmPassword: "",
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
    if (!token) {
      return;
    }

    let active = true;

    async function loadProfile() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE_URL}/me`, {
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
          throw new Error("Nao foi possivel carregar o perfil.");
        }

        const data = (await response.json()) as ProfileResponse;

        if (!active) {
          return;
        }

        setProfile(data);
        setFormData((current) => ({
          ...current,
          name: data.name || "",
          email: data.email || "",
        }));
      } catch (err) {
        if (!active) {
          return;
        }

        setError(err instanceof Error ? err.message : "Erro ao carregar perfil.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [router, token]);

  function updateField(field: keyof typeof formData, value: string) {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccessMessage("");

    const trimmedName = formData.name.trim();
    const trimmedEmail = formData.email.trim();
    const wantsPasswordChange = Boolean(formData.currentPassword || formData.password || formData.confirmPassword);

    if (!trimmedName || !trimmedEmail) {
      setError("Nome e email sao obrigatorios.");
      setSaving(false);
      return;
    }

    if (wantsPasswordChange) {
      if (!formData.currentPassword) {
        setError("Informe sua senha atual para alterar a senha.");
        setSaving(false);
        return;
      }

      if (!formData.password) {
        setError("Informe a nova senha.");
        setSaving(false);
        return;
      }

      if (formData.password.length < 6) {
        setError("A nova senha deve ter no minimo 6 caracteres.");
        setSaving(false);
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        setError("A confirmacao da senha nao confere.");
        setSaving(false);
        return;
      }
    }

    try {
      const response = await fetch(`${API_BASE_URL}/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          currentPassword: formData.currentPassword || null,
          password: formData.password || null,
        }),
      });

      if (response.status === 401 || response.status === 403) {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        let message = "Nao foi possivel atualizar o perfil.";

        try {
          const body = (await response.json()) as { error?: string };
          if (body?.error) {
            message = body.error;
          }
        } catch {}

        throw new Error(message);
      }

      const data = (await response.json()) as UpdateProfileResponse;
      window.localStorage.setItem(TOKEN_STORAGE_KEY, data.token);

      setProfile(data.user);
      setFormData({
        name: data.user.name || "",
        email: data.user.email || "",
        currentPassword: "",
        password: "",
        confirmPassword: "",
      });
      setSuccessMessage("Perfil atualizado com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar perfil.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#111318] text-white">
        <div className="mx-auto max-w-3xl px-4 py-6 md:px-6">
          <p className="text-sm text-[#b8bfd1]">Carregando perfil...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#111318] text-white">
      <div className="mx-auto max-w-3xl px-4 py-6 md:px-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Editar perfil</h1>
            <p className="mt-2 text-sm text-[#9ba2b3]">
              Atualize seus dados de acesso e mantenha sua conta segura.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-md border border-[#3f4658] bg-[#232834] px-4 py-2 text-sm text-[#d3d8e4] hover:bg-[#2a3040]"
          >
            Voltar
          </Link>
        </div>

        {error ? <p className="mb-4 text-sm text-[#f5a5a5]">{error}</p> : null}
        {successMessage ? <p className="mb-4 text-sm text-[#b8f0c8]">{successMessage}</p> : null}

        {profile ? (
          <section className="rounded-2xl border border-[#2c313d] bg-[#1a1d24] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
            <div className="mb-6 grid gap-3 rounded-xl border border-[#2c313d] bg-[#141821] p-4 md:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-[#8f96a8]">Perfil</p>
                <p className="mt-1 text-sm text-[#dbe6ff]">{profile.role}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[#8f96a8]">Criado em</p>
                <p className="mt-1 text-sm text-[#dbe6ff]">
                  {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString("pt-BR") : "-"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[#8f96a8]">Ultima atualizacao</p>
                <p className="mt-1 text-sm text-[#dbe6ff]">
                  {profile.updatedAt ? new Date(profile.updatedAt).toLocaleDateString("pt-BR") : "-"}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="name" className="mb-2 block text-sm font-medium text-[#d3d8e4]">
                  Nome
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  className="w-full rounded-lg border border-[#34394a] bg-[#0f1117] px-4 py-2 text-sm text-[#d3d8e4] placeholder-[#566575] focus:border-[#2f61ff] focus:outline-none"
                  placeholder="Seu nome"
                />
              </div>

              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-[#d3d8e4]">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  className="w-full rounded-lg border border-[#34394a] bg-[#0f1117] px-4 py-2 text-sm text-[#d3d8e4] placeholder-[#566575] focus:border-[#2f61ff] focus:outline-none"
                  placeholder="voce@empresa.com"
                />
              </div>

              <div className="rounded-xl border border-[#2c313d] bg-[#141821] p-4">
                <h2 className="text-lg font-semibold text-[#dbe6ff]">Alterar senha</h2>
                <p className="mt-1 text-sm text-[#9ba2b3]">
                  Preencha os campos abaixo somente se quiser trocar sua senha.
                </p>

                <div className="mt-4 grid gap-4">
                  <div>
                    <label htmlFor="currentPassword" className="mb-2 block text-sm font-medium text-[#d3d8e4]">
                      Senha atual
                    </label>
                    <input
                      id="currentPassword"
                      type="password"
                      value={formData.currentPassword}
                      onChange={(e) => updateField("currentPassword", e.target.value)}
                      className="w-full rounded-lg border border-[#34394a] bg-[#0f1117] px-4 py-2 text-sm text-[#d3d8e4] placeholder-[#566575] focus:border-[#2f61ff] focus:outline-none"
                      placeholder="Digite sua senha atual"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label htmlFor="password" className="mb-2 block text-sm font-medium text-[#d3d8e4]">
                        Nova senha
                      </label>
                      <input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => updateField("password", e.target.value)}
                        className="w-full rounded-lg border border-[#34394a] bg-[#0f1117] px-4 py-2 text-sm text-[#d3d8e4] placeholder-[#566575] focus:border-[#2f61ff] focus:outline-none"
                        placeholder="Minimo de 6 caracteres"
                      />
                    </div>

                    <div>
                      <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-[#d3d8e4]">
                        Confirmar nova senha
                      </label>
                      <input
                        id="confirmPassword"
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) => updateField("confirmPassword", e.target.value)}
                        className="w-full rounded-lg border border-[#34394a] bg-[#0f1117] px-4 py-2 text-sm text-[#d3d8e4] placeholder-[#566575] focus:border-[#2f61ff] focus:outline-none"
                        placeholder="Repita a nova senha"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-3 pt-2">
                <Link
                  href="/"
                  className="rounded-lg border border-[#3f4658] bg-[#232834] px-6 py-2 text-sm font-semibold text-[#d3d8e4] hover:bg-[#2a3040]"
                >
                  Cancelar
                </Link>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg border border-[#2f9e5f] bg-[#1d6a3f] px-6 py-2 text-sm font-semibold text-[#ddf7e7] hover:bg-[#247a4a] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Salvando..." : "Salvar perfil"}
                </button>
              </div>
            </form>
          </section>
        ) : null}
      </div>
    </main>
  );
}
