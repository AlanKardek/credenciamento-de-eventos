import Link from "next/link";

export default function Sidebar() {
  return (
    <aside className="h-screen w-64 border-r border-slate-200 bg-white p-5 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
      <h2 className="text-xl font-bold mb-6">Ticket Dashboard</h2>

      <ul className="space-y-3">
        <li className="cursor-pointer text-slate-600 hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-400">
          <Link href="/">Dashboard</Link>
        </li>
        <li className="cursor-pointer text-slate-600 hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-400">Eventos</li>
        <li className="cursor-pointer text-slate-600 hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-400">
          <Link href="/participantes">Participantes</Link>
        </li>
        <li className="cursor-pointer text-slate-600 hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-400">Ingressos</li>
        <li className="cursor-pointer text-slate-600 hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-400">Relatorios</li>
      </ul>
    </aside>
  );
}
