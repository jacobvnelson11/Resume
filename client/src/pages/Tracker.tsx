import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { Application, ApplicationStatus } from "../types";

const COLUMNS: { status: ApplicationStatus; label: string }[] = [
  { status: "saved", label: "New" },
  { status: "drafted", label: "Ready to Send" },
  { status: "submitted", label: "Applied" },
  { status: "response", label: "Heard Back" },
  { status: "interview", label: "Interview" },
  { status: "closed", label: "Closed" },
];

export default function Tracker() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getApplications()
      .then(setApplications)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-500">Loading…</p>;

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 mb-4">My Applications</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {COLUMNS.map((col) => {
          const items = applications.filter((a) => a.status === col.status);
          return (
            <div key={col.status} className="bg-slate-100 rounded-lg p-3 min-h-[200px]">
              <h2 className="text-sm font-semibold text-slate-700 mb-2">
                {col.label} <span className="text-slate-400 font-normal">({items.length})</span>
              </h2>
              <div className="space-y-2">
                {items.map((app) => (
                  <Link
                    key={app.id}
                    to={`/applications/${app.id}`}
                    className="block bg-white rounded-md border p-3 hover:shadow-sm"
                  >
                    <p className="text-sm font-medium text-slate-800 line-clamp-2">{app.job.title}</p>
                    <p className="text-xs text-slate-500">{app.job.company}</p>
                    {app.nextFollowUpAt && (
                      <p className="text-xs text-amber-600 mt-1">
                        Follow up {new Date(app.nextFollowUpAt).toLocaleDateString()}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
