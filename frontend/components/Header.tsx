"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { TOKEN_STORAGE_KEY } from "@/app/constants/auth";

export default function Header() {
  const router = useRouter();

  const logout = () => {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[#2c313d] bg-[#111318]">
      <div className="mx-auto max-w-6xl px-4 py-3 md:px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span className="text-2xl">🏷️</span>
          <span className="text-lg font-bold text-[#dbe6ff]">Ticket Hub</span>
        </Link>

        <button
          onClick={logout}
          className="rounded-md border border-[#3f4658] bg-[#232834] px-3 py-1.5 text-xs text-[#d3d8e4] hover:bg-[#2a3040]"
        >
          Sair
        </button>
      </div>
    </header>
  );
}
