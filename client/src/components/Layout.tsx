import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../api";

export default function Layout() {
  const [stats, setStats] = useState<{ reviewedToday: number; target: number } | null>(null);

  useEffect(() => {
    api.getApplicationsDailyStats().then(setStats).catch(() => {});
  }, []);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-md text-sm font-medium ${
      isActive ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"
    }`;

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-slate-800">Job Application Assistant</span>
            <nav className="flex gap-1">
              <NavLink to="/" end className={linkClass}>
                Review Queue
              </NavLink>
              <NavLink to="/tracker" className={linkClass}>
                Tracker
              </NavLink>
            </nav>
          </div>
          {stats && (
            <div className="text-sm text-slate-600">
              <span className="font-semibold text-brand-700">{stats.reviewedToday}</span> /{" "}
              {stats.target} reviewed today
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
