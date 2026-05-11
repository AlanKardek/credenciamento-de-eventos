"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { TOKEN_STORAGE_KEY, API_BASE_URL } from "@/app/constants/auth";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState(() =>
    typeof window === "undefined" ? "" : window.localStorage.getItem(TOKEN_STORAGE_KEY) || ""
  );
  const [isDarkMode, setIsDarkMode] = useState(() =>
    typeof window === "undefined" ? false : window.localStorage.getItem("darkMode") === "true"
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const effectiveToken =
    token || (typeof window === "undefined" ? "" : window.localStorage.getItem(TOKEN_STORAGE_KEY) || "");

  // Verificar se está na página de login
  const isLoginPage = pathname === "/login";

  useEffect(() => {
    if (!effectiveToken) {
      return;
    }

    let active = true;

    async function loadMe() {
      try {
        const res = await fetch(`${API_BASE_URL}/me`, {
          headers: { Authorization: `Bearer ${effectiveToken}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (active) {
          setUserName(data.name || "");
          setUserRole(data.role || "");
        }
      } catch {
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
  }, [effectiveToken]);

  // Carregar modo noturno do localStorage
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    window.localStorage.setItem("darkMode", String(newMode));
    if (newMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const logout = () => {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken("");
    router.push("/login");
  };

  // Não mostrar header na página de login
  if (isLoginPage) {
    return null;
  }

  // Não mostrar header se não estiver autenticado
  if (!effectiveToken) {
    return null;
  }

  const isActive = (href: string) => pathname === href;
  const isAdmin = userRole === "ADMIN";

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
      <div className="mx-auto max-w-7xl px-4 py-3 md:px-6 flex items-center justify-between gap-4">
        {/* Logo à esquerda */}
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-shrink-0">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center relative">
            {/* Logo Ticket */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="6" width="18" height="12" rx="1" stroke="white" strokeWidth="1.5"/>
              <path d="M9 6v12" stroke="white" strokeWidth="1.5" strokeDasharray="2"/>
              <circle cx="6" cy="12" r="1.5" fill="white"/>
              <circle cx="18" cy="12" r="1.5" fill="white"/>
            </svg>
          </div>
          <span className="text-lg font-bold text-slate-900 dark:text-white">Ticket Hub</span>
        </Link>

        {/* Navegação à esquerda */}
        <nav className="hidden sm:flex items-center gap-1">
          <Link
            href="/"
            className={`text-sm font-medium px-3 py-2 rounded-md transition-colors ${
              (isActive("/") || (pathname.includes("/eventos") && !pathname.includes("/arquivados")))
                ? "bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-400"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            Eventos
          </Link>
          <Link
            href="/arquivados"
            className={`text-sm font-medium px-3 py-2 rounded-md transition-colors ${
              pathname.includes("/arquivados")
                ? "bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-400"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            Arquivados
          </Link>
        </nav>

        {/* Menu do usuário à direita */}
        <div className="ml-auto flex items-center gap-2">
          {isAdmin ? (
            <>
              <Link
                href="/usuarios"
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="hidden sm:inline">Usuarios</span>
              </Link>
              <Link
                href="/contas/nova"
                className="inline-flex items-center gap-2 rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 5v14m7-7H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="hidden sm:inline">Criar conta</span>
              </Link>
            </>
          ) : null}

        <div ref={containerRef} className="relative">
          <button
            onClick={() => setOpen(v => !v)}
            aria-haspopup="true"
            aria-expanded={open}
            className="flex items-center gap-2 px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title="Menu do usuário"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M20 21c0-2.761-4.03-5-8-5s-8 2.239-8 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-sm text-slate-700 dark:text-slate-200 font-medium hidden sm:inline">{userName || "Perfil"}</span>
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
              <button
                onClick={() => {
                  setOpen(false);
                  router.push('/');
                }}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-blue-700 dark:hover:text-blue-400 transition-colors rounded-t-lg"
              >
                Eventos
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  router.push('/arquivados');
                }}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-blue-700 dark:hover:text-blue-400 transition-colors"
              >
                Arquivados
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  router.push('/perfil');
                }}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-blue-700 dark:hover:text-blue-400 transition-colors"
              >
                Editar Perfil
              </button>
              {isAdmin ? (
                <button
                  onClick={() => {
                    setOpen(false);
                    router.push('/usuarios');
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-blue-700 dark:hover:text-blue-400 transition-colors"
                >
                  Usuarios
                </button>
              ) : null}
              <div className="border-t border-slate-200 dark:border-slate-700"></div>
              <button
                onClick={toggleDarkMode}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-blue-700 dark:hover:text-blue-400 transition-colors flex items-center gap-2"
              >
                {isDarkMode ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    Modo Claro
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Modo Escuro
                  </>
                )}
              </button>
              <div className="border-t border-slate-200 dark:border-slate-700"></div>
              <button
                onClick={logout}
                className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-slate-700 transition-colors rounded-b-lg"
              >
                Sair
              </button>
            </div>
          )}
        </div>
        </div>
      </div>
    </header>
  );
}
