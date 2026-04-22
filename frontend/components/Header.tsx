"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { TOKEN_STORAGE_KEY, API_BASE_URL } from "@/app/constants/auth";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState("");
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Verificar se está na página de login
  const isLoginPage = pathname === "/login";

  useEffect(() => {
    const savedToken = window.localStorage.getItem(TOKEN_STORAGE_KEY) || "";
    setToken(savedToken);

    if (!savedToken) {
      return;
    }

    let active = true;

    async function loadMe() {
      try {
        const res = await fetch(`${API_BASE_URL}/me`, {
          headers: { Authorization: `Bearer ${savedToken}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (active) setUserName(data.name || "");
      } catch (e) {
        // ignorar
      }
    }

    loadMe();

    function handleDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener("click", handleDocClick);
    return () => {
      active = false;
      window.removeEventListener("click", handleDocClick);
    };
  }, []);

  const logout = () => {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    router.push("/login");
  };

  // Não mostrar header na página de login
  if (isLoginPage) {
    return null;
  }

  // Não mostrar header se não estiver autenticado
  if (!token) {
    return null;
  }

  const isActive = (href: string) => pathname === href;

  return (
    <header className="sticky top-0 z-50 border-b border-[#2c313d] bg-[#111318]">
      <div className="mx-auto max-w-6xl px-4 py-3 md:px-6 flex items-center justify-between gap-4">
        {/* Logo à esquerda */}
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-shrink-0">
          <span className="text-2xl">🏷️</span>
          <span className="text-lg font-bold text-[#dbe6ff]">Ticket Hub</span>
        </Link>

        {/* Navegação à esquerda */}
        <nav className="hidden sm:flex items-center gap-2">
          <Link
            href="/"
            className={`text-sm font-medium px-3 py-2 rounded-md transition-colors ${
              isActive("/")
                ? "bg-[#1b2f7a] text-[#dbe6ff]"
                : "text-[#d3d8e4] hover:bg-[#232834]"
            }`}
          >
            🏠 Home
          </Link>
          <Link
            href="/"
            className={`text-sm font-medium px-3 py-2 rounded-md transition-colors ${
              pathname.includes("/eventos")
                ? "bg-[#1b2f7a] text-[#dbe6ff]"
                : "text-[#d3d8e4] hover:bg-[#232834]"
            }`}
          >
            📅 Eventos
          </Link>
        </nav>

        {/* Menu do usuário à direita */}
        <div ref={containerRef} className="relative ml-auto">
          <button
            onClick={() => setOpen(v => !v)}
            aria-haspopup="true"
            aria-expanded={open}
            className="flex items-center gap-2 px-3 py-2 rounded-md border border-[#3f4658] bg-[#232834] hover:bg-[#2a3040] transition-colors"
            title="Menu do usuário"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5z" stroke="#d3d8e4" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M20 21c0-2.761-4.03-5-8-5s-8 2.239-8 5" stroke="#d3d8e4" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-sm text-[#d3d8e4] font-medium hidden sm:inline">{userName || "Perfil"}</span>
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-44 bg-[#1a1d24] border border-[#2c313d] rounded-lg shadow-lg z-50">
              <button
                onClick={() => {
                  setOpen(false);
                  router.push('/');
                }}
                className="w-full text-left px-4 py-2 text-sm text-[#d3d8e4] hover:bg-[#232834] hover:text-[#dbe6ff] transition-colors rounded-t-lg"
              >
                🏠 Home
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  router.push('/');
                }}
                className="w-full text-left px-4 py-2 text-sm text-[#d3d8e4] hover:bg-[#232834] hover:text-[#dbe6ff] transition-colors"
              >
                📅 Eventos
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  router.push('/perfil');
                }}
                className="w-full text-left px-4 py-2 text-sm text-[#d3d8e4] hover:bg-[#232834] hover:text-[#dbe6ff] transition-colors"
              >
                👤 Editar Perfil
              </button>
              <div className="border-t border-[#34394a]"></div>
              <button
                onClick={logout}
                className="w-full text-left px-4 py-2 text-sm text-[#f5a5a5] hover:bg-[#232834] transition-colors rounded-b-lg"
              >
                🚪 Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
