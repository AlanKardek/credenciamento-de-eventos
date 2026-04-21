"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  const navItems = [
    { label: "Home", href: "/", path: "/" },
    { label: "Eventos", href: "/eventos", path: "/eventos" },
    { label: "Perfil", href: "/perfil", path: "/perfil" },
  ];

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-4xl">🎫</span>
          <h1 className="text-2xl font-bold text-gray-900">ticket hub</h1>
        </div>

        <nav className="flex items-center gap-8">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`transition-colors font-medium ${
                isActive(item.path)
                  ? "text-blue-600 border-b-2 border-blue-600 pb-1"
                  : "text-gray-700 hover:text-blue-600"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
