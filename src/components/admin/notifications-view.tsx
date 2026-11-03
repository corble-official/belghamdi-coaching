"use client";

import { useState } from "react";

import type { AdminRole } from "@/lib/admin/types";

export type PortalNotifRow = {
  id: string;
  audience_role: string;
  client_id: string | null;
  kind: string;
  title: string;
  body: string | null;
  created_at: string;
  read: boolean;
  demo: boolean;
};

export type SalesNotifRow = {
  id: string;
  lead_id: string | null;
  qualified: boolean;
  handoff: boolean;
  success: boolean;
  error: string | null;
  created_at: string;
  demo: boolean;
};

export function NotificationsView({
  portal,
  sales,
  role,
}: {
  portal: PortalNotifRow[];
  sales: SalesNotifRow[];
  role: AdminRole | null;
}) {
  const [tab, setTab] = useState<"portal" | "sales">("portal");

  const tabBtn = (key: "portal" | "sales", label: string, count: number) => (
    <button
      onClick={() => setTab(key)}
      className={`px-4 py-2 text-sm font-display uppercase tracking-widest border-b-2 transition-colors ${
        tab === key
          ? "border-copper text-copper"
          : "border-transparent text-wgray hover:text-bone"
      }`}
      aria-selected={tab === key}
      role="tab"
    >
      {label} ({count})
    </button>
  );

  return (
    <div>
      <div className="flex gap-2 border-b border-wgray-dim/50 mb-6" role="tablist">
        {tabBtn("portal", "Portal notifications", portal.length)}
        {/* sales_notifications is an admin-surface (no authenticated policies) */}
        {role === "admin" ? tabBtn("sales", "Sales notifications", sales.length) : null}
      </div>

      {tab === "portal" ? (
        <div className="space-y-3">
          {portal.length === 0 ? (
            <p className="text-sm text-wgray-dim py-16 text-center">
              No portal notifications yet.
            </p>
          ) : (
            portal.map((n) => (
              <div
                key={n.id}
                className={`card-surface p-4 border-l-2 ${
                  n.read ? "border-l-wgray/30" : "border-l-copper"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-bone font-medium">{n.title}</p>
                  <span className="text-[10px] uppercase tracking-widest font-display text-copper border border-copper/40 px-2 py-0.5 rounded-full">
                    {n.kind}
                  </span>
                </div>
                {n.body && <p className="text-xs text-wgray mt-1">{n.body}</p>}
                <p className="text-[10px] text-wgray-dim mt-2 uppercase tracking-widest">
                  {new Date(n.created_at).toLocaleString()} · audience: {n.audience_role}
                  {n.demo ? " · demo" : ""}
                </p>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="card-surface overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr>
                <th className="table-head">Lead</th>
                <th className="table-head">Qualified</th>
                <th className="table-head">Handoff</th>
                <th className="table-head">Success</th>
                <th className="table-head">When</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} className="hover:bg-surface/40 transition-colors">
                  <td className="table-cell font-mono text-xs text-wgray">
                    {s.lead_id ?? "—"}
                  </td>
                  <td className="table-cell">{s.qualified ? "✓" : "—"}</td>
                  <td className="table-cell">{s.handoff ? "✓" : "—"}</td>
                  <td className="table-cell">{s.success ? "✓" : s.error ?? "—"}</td>
                  <td className="table-cell text-xs text-wgray">
                    {new Date(s.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sales.length === 0 && (
            <p className="text-sm text-wgray-dim py-16 text-center">
              No sales notifications yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
