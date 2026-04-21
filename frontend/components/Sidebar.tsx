import Link from "next/link";

export default function Sidebar() {
  return (
    <aside className="w-64 bg-gray-900 text-white h-screen p-5">
      <h2 className="text-xl font-bold mb-6">Ticket Dashboard</h2>

      <ul className="space-y-3">
        <li className="hover:text-gray-300 cursor-pointer">
          <Link href="/">Dashboard</Link>
        </li>
        <li className="hover:text-gray-300 cursor-pointer">Eventos</li>
        <li className="hover:text-gray-300 cursor-pointer">
          <Link href="/participantes">Participantes</Link>
        </li>
        <li className="hover:text-gray-300 cursor-pointer">Ingressos</li>
        <li className="hover:text-gray-300 cursor-pointer">Relatorios</li>
      </ul>
    </aside>
  );
}
