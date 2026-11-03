"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, ShieldAlert } from "lucide-react";

import { Drawer, ConfirmDialog, StatusBadge } from "@/components/admin/ui";
import type { AdminClientRow, OverrideAction } from "@/lib/admin/types";
import {
  demoOverrideOutbox,
  demoOverrideSimulate,
  demoRequestOverride,
} from "@/lib/demo/admin-crm";
import { useAdminStore } from "@/lib/demo/admin-store";
import { isDemoMode } from "@/lib/mode";
import type { Subscription } from "@/lib/types";
import { logEvent } from "@/lib/integrations/dispatcher";
import { formatDate } from "@/lib/utils";

/**
 * Subscriptions workspace (Task 7 #3) — role-aware manual overrides.
 *
 * ADMIN-ONLY by server enforcement: override POSTs hit
 * /api/admin/subscriptions/override which re-checks the role server-side
 * (coach POST → 403 regardless of what the UI renders). Buttons below are
 * rendered ONLY when role==='admin' (demo always admin).
 *
 * coach: read-only rows + "Request override" (routes a kind='override_request'
 * notification — approved extension: POST action='request_override').
 * coach_assistant: read-only.
 *
 * DEMO: simulated + in-memory outbox record (admin-crm module), the store
 * row itself is patched so the lifecycle chip visibly changes, never network.
 */

const STATUSES: Subscription["status"][] = ["active", "pending", "expired", "cancelled", "on-hold"];

type OverrideResult = {
  simulated: boolean;
  status?: string;
  end_date?: string;
  access?: string;
  event_type?: string;
  kind?: string;
};

export default function AdminSubscriptionsPage() {
  const demo = useMemo(() => isDemoMode(), []);
  const store = useAdminStore();

  const [role, setRole] = useState<"admin" | "coach" | "coach_assistant" | null>(
    demo ? "admin" : null
  );
  const [rows, setRows] = useState<AdminClientRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [result, setResult] = useState<OverrideResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outboxCount, setOutboxCount] = useState(demoOverrideOutbox().length);

  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Subscription | null>(null);
  const [form, setForm] = useState({
    clientId: "",
    package: "silver" as Subscription["package"],
    startDate: new Date().toISOString().slice(0, 10),
    renewalDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    status: "pending" as Subscription["status"],
    paymentStatus: "pending" as Subscription["paymentStatus"],
    assignedCoach: "Coach Belghamdi",
  });

  useEffect(() => {
    if (demo) {
      setRows(null);
      return;
    }
    let alive = true;
    fetch("/api/admin/clients?segment=all")
      .then(async (res) => {
        const data = (await res.json()) as { ok?: boolean; role?: "admin" | "coach" | "coach_assistant" | null; rows?: AdminClientRow[]; error?: string };
        if (!alive) return;
        if (res.ok && data.ok) {
          setRole(data.role ?? null);
          setRows(data.rows ?? []);
        } else {
          setError(data.error ?? `HTTP ${res.status}`);
        }
      })
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, [demo]);

  const demoTable = useMemo(() => {
    if (!demo) return [];
    return store.subscriptions.map((s) => {
      const client = store.clients.find((c) => c.id === s.clientId);
      const row: AdminClientRow = {
        id: s.clientId ?? s.id, // table acts on the CLIENT id (route contract)
        client_code: s.clientId ?? "—",
        full_name: s.clientName ?? client?.name ?? s.clientId ?? "—",
        email: null,
        phone: null,
        package_id: s.package,
        client_status: "active",
        sub_id: s.id,
        sub_status: s.status,
        sub_start_date: s.startDate,
        sub_end_date: s.renewalDate,
        access: "full",
        segment: "active",
        last_checkin_at: null,
        demo: true,
      };
      return row;
    });
  }, [demo, store.subscriptions, store.clients]);

  const table = demo ? demoTable : rows ?? [];

  const applyOverride = async (
    clientId: string,
    rowName: string,
    action: OverrideAction | "request_override",
    extendDays?: number
  ) => {
    setBusyId(clientId);
    setError(null);
    setResult(null);
    if (demo) {
      if (action === "request_override") {
        const notification = demoRequestOverride({
          client_id: clientId,
          client_name: rowName,
          payload: { extend_days: extendDays ?? 30 },
        });
        setResult({ simulated: true, kind: notification.kind });
        setBusyId(null);
        return;
      }
      const { notification } = demoOverrideSimulate({
        client_id: clientId,
        client_name: rowName,
        action: action as OverrideAction,
        payload: action === "extend" ? { extend_days: extendDays ?? 30 } : undefined,
      });
      // optimistic store patch reflecting the demo override
      const sub = store.subscriptions.find((s) => s.clientId === clientId);
      if (sub) {
        const today = new Date();
        const base = new Date(sub.renewalDate).getTime() < today.getTime() ? today : new Date(sub.renewalDate);
        const nextEnd =
          action === "extend"
            ? new Date(base.getTime() + (extendDays ?? 30) * 86400000).toISOString()
            : sub.renewalDate;
        const nextStatus: Subscription["status"] = action === "activate" ? "active" : action === "revoke" ? "cancelled" : action === "suspend" ? "on-hold" : sub.status;
        store.updateSubscription(sub.id, { status: nextStatus, renewalDate: nextEnd });
      }
      setOutboxCount(demoOverrideOutbox().length);
      setResult({
        simulated: true,
        kind: notification.kind,
        status: action === "activate" ? "active" : action === "suspend" ? "on-hold" : action === "revoke" ? "cancelled" : undefined,
      });
      setBusyId(null);
      return;
    }

    const res = await fetch("/api/admin/subscriptions/override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        action,
        payload: action === "extend" ? { extend_days: extendDays ?? 30 } : undefined,
      }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      role?: string;
      simulated?: boolean;
      status?: string;
      end_date?: string;
      access?: string;
      event_type?: string;
      kind?: string;
    };
    setBusyId(null);
    if (res.status === 403) {
      setError(`forbidden (role: ${data.role ?? "unknown"}) — overrides are admin-only`);
      return;
    }
    if (!res.ok || !data.ok) {
      setError(data.error ?? `HTTP ${res.status}`);
      return;
    }
    setResult(data as OverrideResult);
    // refetch quietly
    const fresh = await fetch("/api/admin/clients?segment=all");
    const fd = (await fresh.json()) as { rows?: AdminClientRow[] };
    if (aliveRowsGuard()) setRows(fd.rows ?? []);
  };

  const aliveRowsGuard = () => true;

  const selectedClient = store.clients.find((c) => c.id === form.clientId);

  const create = () => {
    if (!selectedClient) return;
    store.addSubscription({
      clientId: selectedClient.id,
      clientName: selectedClient.name,
      package: form.package,
      startDate: new Date(form.startDate).toISOString(),
      renewalDate: new Date(form.renewalDate).toISOString(),
      status: form.status,
      paymentStatus: form.paymentStatus,
      assignedCoach: form.assignedCoach,
    });
    logEvent("subscription.created", selectedClient.id);
    setCreating(false);
  };

  const isAdmin = role === "admin";

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-3xl text-bone">Subscriptions</h1>
          <p className="text-sm text-wgray mt-1">
            {role === "coach"
              ? "From the client_subscriptions ledger — view-only for coaches"
              : "From the client_subscriptions ledger (Supabase)"}
            {demo ? " — demo rows, simulated only" : ""}
          </p>
        </div>
        {demo && (
          <button onClick={() => setCreating(true)} className="btn-primary !px-5 !py-3">
            <Plus className="h-4 w-4" /> New Subscription
          </button>
        )}
      </div>

      {role === "coach" && (
        <p className="text-xs text-wgray border border-wgray-dim/40 bg-surface px-4 py-3 mt-4">
          Coaches are VIEW-ONLY for subscription status — use Request Override
          to ask the admin for a extension instead.
        </p>
      )}

      {error && (
        <p className="text-sm text-red-300 border border-red-400/30 bg-red-500/10 px-4 py-3 mt-4">
          {error}
        </p>
      )}

      {result && (
        <p className="text-xs text-emerald-300 border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 mt-4">
          {result.kind === "override_request"
            ? "Override request routed to the admin notifications center."
            : `Override applied (${result.event_type ?? "simulated"}) → ${result.status ?? ""}${
                result.end_date ? `, end ${result.end_date}` : ""
              }${result.access ? `, access ${result.access}` : ""}`}
        </p>
      )}

      {rows === null && !demo ? (
        <p className="text-sm text-wgray-dim mt-8">Loading subscriptions…</p>
      ) : table.length === 0 ? (
        <p className="text-sm text-wgray-dim py-20 text-center">
          No subscriptions {demo ? "yet." : "visible for your scope — zero assigned clients give an empty table."}
        </p>
      ) : (
        <div className="card-surface mt-8 overflow-x-auto">
          <table className="w-full min-w-[960px]">
            <thead>
              <tr>
                <th className="table-head">Client</th>
                <th className="table-head">Package</th>
                <th className="table-head">Start</th>
                <th className="table-head">End</th>
                <th className="table-head">Status</th>
                <th className="table-head text-right">Manage (admin only)</th>
              </tr>
            </thead>
            <tbody>
              {table.map((s) => {
                const overdue =
                  s.sub_end_date &&
                  new Date(s.sub_end_date).getTime() < Date.now() &&
                  s.sub_status === "active";
                return (
                  <tr key={`${s.id}-${s.sub_id ?? ""}`} className="hover:bg-surface/40 transition-colors">
                    <td className="table-cell">
                      {s.full_name}
                      {s.demo && (
                        <span className="ml-2 text-[10px] font-display uppercase tracking-widest bg-copper/15 text-copper border border-copper/40 px-1.5 py-0.5 rounded-full">
                          demo
                        </span>
                      )}
                    </td>
                    <td className="table-cell text-xs uppercase tracking-widest text-copper">
                      {s.package_id ?? "—"}
                    </td>
                    <td className="table-cell text-xs text-wgray">
                      {s.sub_start_date ? formatDate(s.sub_start_date) : "—"}
                    </td>
                    <td className="table-cell text-xs text-wgray">
                      {s.sub_end_date ? formatDate(s.sub_end_date) : "—"}
                      {overdue ? <span className="text-red-300 ml-1">overdue</span> : null}
                    </td>
                    <td className="table-cell">
                      <StatusBadge status={s.sub_status ?? "none"} />
                    </td>
                    <td className="table-cell">
                      <div className="flex justify-end gap-2 flex-wrap">
                        {isAdmin ? (
                          <>
                            <button
                              onClick={() => void applyOverride(s.id, s.full_name, "activate")}
                              disabled={busyId === s.id}
                              className="text-[10px] font-display uppercase tracking-widest border border-emerald-400/40 text-emerald-300 px-2.5 py-1.5 hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
                            >
                              Activate
                            </button>
                            <button
                              onClick={() => void applyOverride(s.id, s.full_name, "suspend")}
                              disabled={busyId === s.id}
                              className="text-[10px] font-display uppercase tracking-widest border border-orange-400/40 text-orange-300 px-2.5 py-1.5 hover:bg-orange-500/10 transition-colors disabled:opacity-40"
                            >
                              Suspend
                            </button>
                            <button
                              onClick={() => void applyOverride(s.id, s.full_name, "extend", 30)}
                              disabled={busyId === s.id}
                              className="text-[10px] font-display uppercase tracking-widest border border-copper/40 text-copper px-2.5 py-1.5 hover:bg-copper/10 transition-colors disabled:opacity-40"
                            >
                              +30d
                            </button>
                            <button
                              onClick={() => void applyOverride(s.id, s.full_name, "revoke")}
                              disabled={busyId === s.id}
                              className="text-[10px] font-display uppercase tracking-widest border border-red-400/40 text-red-300 px-2.5 py-1.5 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                            >
                              Revoke
                            </button>
                          </>
                        ) : role === "coach" ? (
                          <button
                            onClick={() => void applyOverride(s.id, s.full_name, "request_override")}
                            disabled={busyId === s.id}
                            className="text-[10px] font-display uppercase tracking-widest border border-copper/40 text-copper px-2.5 py-1.5 hover:bg-copper/10 transition-colors disabled:opacity-40"
                          >
                            Request override
                          </button>
                        ) : (
                          <span className="text-[10px] text-wgray-dim inline-flex items-center gap-1">
                            <ShieldAlert className="h-3 w-3" /> view-only
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {demo && outboxCount > 0 && (
        <p className="text-xs text-wgray-dim mt-4">
          Demo override outbox: {outboxCount} simulated events recorded (never networked).
        </p>
      )}

      {demo && (
        <>
          <Drawer open={creating} onClose={() => setCreating(false)} title="New subscription (demo)">
            <div className="space-y-4">
              <div>
                <label className="label-dark">Client</label>
                <select
                  value={form.clientId}
                  onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                  className="input-dark"
                >
                  <option value="">Select client…</option>
                  {store.clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-dark">Package</label>
                  <select
                    value={form.package}
                    onChange={(e) => setForm({ ...form, package: e.target.value as Subscription["package"] })}
                    className="input-dark"
                  >
                    <option value="silver">Silver</option>
                    <option value="gold">Gold</option>
                  </select>
                </div>
                <div>
                  <label className="label-dark">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as Subscription["status"] })}
                    className="input-dark"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-dark">Start date</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="input-dark"
                  />
                </div>
                <div>
                  <label className="label-dark">Renewal date</label>
                  <input
                    type="date"
                    value={form.renewalDate}
                    onChange={(e) => setForm({ ...form, renewalDate: e.target.value })}
                    className="input-dark"
                  />
                </div>
              </div>
              <button onClick={create} className="btn-primary w-full">Create</button>
            </div>
          </Drawer>

          <ConfirmDialog
            open={deleting !== null}
            title="Delete subscription"
            message={`This permanently removes ${deleting?.id}.`}
            onCancel={() => setDeleting(null)}
            onConfirm={() => {
              if (deleting) store.deleteSubscription(deleting.id);
              setDeleting(null);
            }}
          />
        </>
      )}
    </div>
  );
}
