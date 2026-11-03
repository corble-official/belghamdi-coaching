"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Trash2, Pencil, ArrowUpRight } from "lucide-react";
import { useAdminStore } from "@/lib/demo/admin-store";
import { Drawer, ConfirmDialog, StatusBadge } from "@/components/admin/ui";
import { AreaChart } from "@/components/admin/Charts";
import type { AdminClientRow, AdminSegment } from "@/lib/admin/types";
import { toRowBase } from "@/lib/admin/segments";
import { isDemoMode } from "@/lib/mode";
import type { Client } from "@/lib/types";
import { formatDate, formatMoney } from "@/lib/utils";

/**
 * Admin client list (Task 7 #1) — REAL Supabase rows when live, existing
 * demo store rows when isDemoMode() (zero-network seam kept intact: demo
 * rows are flagged `demo: true`, simulated data comes only from the demo
 * store / admin-crm module).
 *
 * Segments: all / active / inactive / expired — classified through
 * toRowBase() (deriveAccess + client status) so the chips stay in
 * lockstep with the portal entitlement gates. Live rows link into the
 * drawer page /admin/clients/[id]; demo keeps the existing in-page drawer.
 */

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  age: "",
  fitnessGoal: "Build muscle",
  experienceLevel: "beginner" as Client["experienceLevel"],
  assignedProgram: "",
  coachingPackage: "none" as Client["coachingPackage"],
  subscriptionStatus: "pending" as Client["subscriptionStatus"],
  assignedCoach: "Coach Belghamdi",
  notes: "",
};

const SEGMENTS: { key: AdminSegment; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
  { key: "expired", label: "Expired" },
];

export default function AdminClientsPage() {
  const demo = useMemo(() => isDemoMode(), []);
  const store = useAdminStore();

  const [segment, setSegment] = useState<AdminSegment>("all");
  const [rows, setRows] = useState<AdminClientRow[] | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ---------- demo path: map the store into the normalized rows ---------- */
  const demoRows = useMemo<AdminClientRow[]>(() => {
    if (!demo) return [];
    const subByClient = new Map(
      store.subscriptions.map((s) => [s.clientId, s])
    );
    const lastCheckin = new Map<string, string>();
    for (const p of store.progress) {
      if (p.clientId && !lastCheckin.has(p.clientId)) {
        lastCheckin.set(p.clientId, p.date);
      }
    }
    return store.clients.map((c) => {
      const sub = subByClient.get(c.id);
      return toRowBase({
        id: c.id,
        client_code: c.id,
        full_name: c.name,
        email: c.email,
        phone: c.phone,
        package_id: c.coachingPackage === "none" ? null : c.coachingPackage,
        client_status: c.subscriptionStatus === "active" ? "active" : c.subscriptionStatus,
        sub_id: sub?.id ?? null,
        sub_status: sub?.status ?? c.subscriptionStatus,
        sub_start_date: sub?.startDate ?? null,
        sub_end_date: sub?.renewalDate ?? null,
        last_checkin_at: lastCheckin.get(c.id) ?? null,
        demo: true,
      });
    });
  }, [demo, store.clients, store.subscriptions, store.progress]);

  /* ---------- live path: staff API ---------- */
  useEffect(() => {
    if (demo) {
      setRows(demoRows);
      return;
    }
    let alive = true;
    setFetching(true);
    fetch(`/api/admin/clients?segment=${segment}`)
      .then(async (res) => {
        const data = (await res.json()) as { ok?: boolean; rows?: AdminClientRow[]; error?: string };
        if (!alive) return;
        if (!res.ok || !data.ok) {
          setError(data.error ?? `HTTP ${res.status}`);
          setRows([]);
          return;
        }
        setError(null);
        setRows(data.rows ?? []);
      })
      .catch((e) => alive && setError(String(e)))
      .finally(() => alive && setFetching(false));
    return () => {
      alive = false;
    };
  }, [demo, segment, demoRows]);

  /* ---------- shared state ---------- */
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [profile, setProfile] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [noteText, setNoteText] = useState("");

  const list = useMemo(() => {
    const base = rows ?? [];
    const q = query.toLowerCase();
    return base.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q) ||
        (r.client_code ?? "").toLowerCase().includes(q)
    );
  }, [rows, query]);

  const counts = useMemo(() => {
    const base = rows ?? [];
    return {
      all: base.length,
      active: base.filter((r) => r.segment === "active").length,
      inactive: base.filter((r) => r.segment === "inactive").length,
      expired: base.filter((r) => r.segment === "expired").length,
    };
  }, [rows]);

  const save = () => {
    if (!form.name || !form.email) return;
    const payload = {
      ...form,
      age: form.age ? Number(form.age) : undefined,
      startDate: editing?.startDate ?? new Date().toISOString(),
    };
    if (editing) {
      store.updateClient(editing.id, { ...payload, startDate: editing.startDate });
    } else {
      store.addClient(payload);
    }
    setCreating(false);
    setEditing(null);
  };

  const profileClient = profile ? store.clients.find((c) => c.id === profile.id) ?? profile : null;
  const profileOrders = profileClient
    ? store.orders.filter(
        (o) => o.customerId === profileClient.id || o.customer === profileClient.name
      )
    : [];
  const profileSubs = profileClient
    ? store.subscriptions.filter((s) => s.clientId === profileClient.id)
    : [];
  const profileProgress = profileClient
    ? store.progress.filter((p) => p.clientId === profileClient.id).sort((a, b) => a.date.localeCompare(b.date))
    : [];
  const profileNotes = profileClient ? store.notesFor("client", profileClient.id) : [];

  const weightTrend = profileProgress.map((p) => ({
    x: formatDate(p.date),
    y: p.weightKg,
  }));

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-3xl text-bone">Clients</h1>
          <p className="text-sm text-wgray mt-1">
            {list.length} clients in view
            {demo ? " — demo data, simulated only" : ""}
          </p>
        </div>
        {demo && (
          <button
            onClick={() => {
              setForm(emptyForm);
              setCreating(true);
            }}
            className="btn-primary !px-5 !py-3"
          >
            <Plus className="h-4 w-4" /> New Client
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 mt-6">
        <div className="relative max-w-md flex-1 min-w-[240px]">
          <Search className="h-4 w-4 text-wgray-dim absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients..."
            className="input-dark pl-9"
            aria-label="Search clients"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {SEGMENTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSegment(s.key)}
              className={`px-3 py-1.5 text-xs font-display uppercase tracking-widest border transition-colors ${
                segment === s.key
                  ? "border-copper text-copper bg-copper/10"
                  : "border-wgray-dim text-wgray hover:text-bone"
              }`}
            >
              {s.label} ({counts[s.key]})
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-300 border border-red-400/30 bg-red-500/10 px-4 py-3 mt-6">
          {error}
        </p>
      )}
      {fetching && (
        <p className="text-sm text-wgray-dim mt-6">Loading clients…</p>
      )}

      {!fetching && list.length === 0 ? (
        <p className="text-sm text-wgray-dim py-20 text-center">
          {demo
            ? "No demo clients match. Reset demo data in Settings to restore the seeded rows."
            : "No clients for this segment yet — new signups appear here from Supabase."}
        </p>
      ) : (
        !fetching && (
          <div className="card-surface mt-6 overflow-x-auto">
            <table className="w-full min-w-[920px]">
              <thead>
                <tr>
                  <th className="table-head">Code</th>
                  <th className="table-head">Name</th>
                  <th className="table-head">Package</th>
                  <th className="table-head">Sub end</th>
                  <th className="table-head">Status</th>
                  <th className="table-head">Last check-in</th>
                  <th className="table-head text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className="hover:bg-surface/40 transition-colors">
                    <td className="table-cell font-mono text-xs text-wgray">
                      {r.client_code ?? "—"}
                    </td>
                    <td className="table-cell">
                      {demo ? (
                        <button
                          onClick={() =>
                            setProfile(store.clients.find((c) => c.id === r.id) ?? null)
                          }
                          className="text-bone hover:text-copper transition-colors"
                        >
                          {r.full_name}
                        </button>
                      ) : (
                        <Link
                          href={`/admin/clients/${r.id}`}
                          className="text-bone hover:text-copper transition-colors inline-flex items-center gap-1"
                        >
                          {r.full_name}
                          <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
                        </Link>
                      )}
                      {r.demo && (
                        <span className="ml-2 text-[10px] font-display uppercase tracking-widest bg-copper/15 text-copper border border-copper/40 px-1.5 py-0.5 rounded-full">
                          demo
                        </span>
                      )}
                    </td>
                    <td className="table-cell text-xs uppercase tracking-widest text-copper">
                      {r.package_id ?? "none"}
                    </td>
                    <td className="table-cell text-xs text-wgray">
                      {r.sub_end_date ? formatDate(r.sub_end_date) : "—"}
                    </td>
                    <td className="table-cell">
                      <StatusBadge
                        status={
                          r.sub_status ??
                          /* no sub yet → the onboarding lifecycle status */
                          r.client_status
                        }
                      />
                    </td>
                    <td className="table-cell text-xs text-wgray" data-col="last-checkin">
                      {r.last_checkin_at ? formatDate(r.last_checkin_at) : "—"}
                    </td>
                    <td className="table-cell">
                      <div className="flex justify-end gap-2">
                        {demo && (
                          <>
                            <button
                              onClick={() => {
                                const c = store.clients.find((x) => x.id === r.id);
                                if (!c) return;
                                setForm({
                                  name: c.name,
                                  email: c.email,
                                  phone: c.phone,
                                  age: c.age ? String(c.age) : "",
                                  fitnessGoal: c.fitnessGoal,
                                  experienceLevel: c.experienceLevel,
                                  assignedProgram: c.assignedProgram,
                                  coachingPackage: c.coachingPackage,
                                  subscriptionStatus: c.subscriptionStatus,
                                  assignedCoach: c.assignedCoach,
                                  notes: c.notes,
                                });
                                setEditing(c);
                              }}
                              className="p-2 text-wgray hover:text-copper transition-colors"
                              aria-label={`Edit client ${r.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() =>
                                setDeleting(store.clients.find((c) => c.id === r.id) ?? null)
                              }
                              className="p-2 text-wgray hover:text-red-400 transition-colors"
                              aria-label={`Delete client ${r.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {!demo && (
                          <Link
                            href={`/admin/clients/${r.id}`}
                            className="text-xs font-display uppercase tracking-widest text-copper border border-copper/40 px-3 py-1.5 hover:bg-copper/10 transition-colors"
                          >
                            Open
                          </Link>
                        )}
                        {demo && (
                          <Link
                            href={`/admin/clients/${r.id}`}
                            className="text-xs font-display uppercase tracking-widest text-copper border border-copper/40 px-3 py-1.5 hover:bg-copper/10 transition-colors"
                            aria-label={`Open profile ${r.id}`}
                          >
                            Profile
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {demo && (
        <>
          <Drawer
            open={creating || editing !== null}
            onClose={() => {
              setCreating(false);
              setEditing(null);
            }}
            title={editing ? `Edit client — ${editing.id}` : "New client"}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-dark">Name</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-dark" />
                </div>
                <div>
                  <label className="label-dark">Age (optional)</label>
                  <input
                    value={form.age}
                    onChange={(e) => setForm({ ...form, age: e.target.value.replace(/\D/g, "") })}
                    className="input-dark"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-dark">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-dark" />
                </div>
                <div>
                  <label className="label-dark">Phone</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-dark" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-dark">Fitness goal</label>
                  <input value={form.fitnessGoal} onChange={(e) => setForm({ ...form, fitnessGoal: e.target.value })} className="input-dark" />
                </div>
                <div>
                  <label className="label-dark">Experience</label>
                  <select
                    value={form.experienceLevel}
                    onChange={(e) => setForm({ ...form, experienceLevel: e.target.value as Client["experienceLevel"] })}
                    className="input-dark"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-dark">Assigned program</label>
                  <input value={form.assignedProgram} onChange={(e) => setForm({ ...form, assignedProgram: e.target.value })} className="input-dark" />
                </div>
                <div>
                  <label className="label-dark">Coaching package</label>
                  <select
                    value={form.coachingPackage}
                    onChange={(e) => setForm({ ...form, coachingPackage: e.target.value as Client["coachingPackage"] })}
                    className="input-dark"
                  >
                    <option value="none">None (program-only)</option>
                    <option value="silver">Silver</option>
                    <option value="gold">Gold</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-dark">Subscription status</label>
                  <select
                    value={form.subscriptionStatus}
                    onChange={(e) => setForm({ ...form, subscriptionStatus: e.target.value as Client["subscriptionStatus"] })}
                    className="input-dark"
                  >
                    {["active", "pending", "expired", "cancelled", "on-hold"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-dark">Assigned coach</label>
                  <input value={form.assignedCoach} onChange={(e) => setForm({ ...form, assignedCoach: e.target.value })} className="input-dark" />
                </div>
              </div>
              <div>
                <label className="label-dark">Notes</label>
                <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input-dark" />
              </div>
              <button onClick={save} className="btn-primary w-full">
                {editing ? "Save Changes" : "Create Client"}
              </button>
            </div>
          </Drawer>

          <Drawer
            wide
            open={profileClient !== null}
            onClose={() => setProfile(null)}
            title={profileClient ? profileClient.name : ""}
          >
            {profileClient && (
              <div className="space-y-8">
                <div className="grid grid-cols-3 gap-4">
                  <div className="card-surface p-4">
                    <p className="text-xs text-wgray uppercase tracking-widest">Purchases</p>
                    <p className="font-display text-2xl text-bone mt-2">{profileOrders.length}</p>
                  </div>
                  <div className="card-surface p-4">
                    <p className="text-xs text-wgray uppercase tracking-widest">Check-ins</p>
                    <p className="font-display text-2xl text-bone mt-2">{profileProgress.length}</p>
                  </div>
                  <div className="card-surface p-4">
                    <p className="text-xs text-wgray uppercase tracking-widest">Package</p>
                    <p className="font-display text-2xl text-bone mt-2 capitalize">{profileClient.coachingPackage}</p>
                  </div>
                </div>

                <div>
                  <h3 className="font-display font-semibold text-bone mb-3">Purchase history</h3>
                  {profileOrders.length === 0 ? (
                    <p className="text-sm text-wgray-dim">No purchases recorded.</p>
                  ) : (
                    <div className="space-y-2">
                      {profileOrders.map((o) => (
                        <div key={o.id} className="flex items-center justify-between bg-surface border border-wgray-dim/40 p-4">
                          <div>
                            <p className="text-sm text-bone">{o.productTitle}</p>
                            <p className="text-xs text-wgray-dim mt-0.5">{formatDate(o.date)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-display text-bone">{formatMoney(o.total, store.currency)}</p>
                            <StatusBadge status={o.paymentStatus} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="font-display font-semibold text-bone mb-3">Coaching history</h3>
                  {profileSubs.length === 0 ? (
                    <p className="text-sm text-wgray-dim">No coaching subscriptions.</p>
                  ) : (
                    <div className="space-y-2">
                      {profileSubs.map((s) => (
                        <div key={s.id} className="flex items-center justify-between bg-surface border border-wgray-dim/40 p-4">
                          <div>
                            <p className="text-sm text-bone capitalize">{s.package} package</p>
                            <p className="text-xs text-wgray-dim mt-0.5">
                              {formatDate(s.startDate)} → {formatDate(s.renewalDate)}
                            </p>
                          </div>
                          <StatusBadge status={s.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="font-display font-semibold text-bone mb-3">Weight trend</h3>
                  <AreaChart data={weightTrend} height={140} label="Weight trend" />
                </div>

                <div>
                  <h3 className="font-display font-semibold text-bone mb-3">Progress records</h3>
                  {profileProgress.length === 0 ? (
                    <p className="text-sm text-wgray-dim">No check-ins recorded.</p>
                  ) : (
                    <ol className="border-l border-wgray-dim ml-2 space-y-4">
                      {[...profileProgress].reverse().map((p) => (
                        <li key={p.id} className="pl-5 relative">
                          <span className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-copper" />
                          <p className="text-sm text-bone">{formatDate(p.date)} — {p.weightKg} kg</p>
                          <p className="text-xs text-wgray mt-0.5">
                            Workouts {p.workoutCompletionPct}% · Nutrition {p.nutritionAdherencePct}%
                          </p>
                          {p.notes && <p className="text-xs text-wgray-dim mt-1">{p.notes}</p>}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                <div>
                  <h3 className="font-display font-semibold text-bone mb-3">Internal notes</h3>
                  {profileNotes.length > 0 && (
                    <div className="space-y-3 mb-4">
                      {profileNotes.map((n) => (
                        <div key={n.id} className="bg-surface p-4 border border-wgray-dim/40">
                          <p className="text-sm text-bone">{n.note}</p>
                          <p className="text-xs text-wgray-dim mt-1">{n.author} — {formatDate(n.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Add an internal note..."
                      className="input-dark flex-1"
                    />
                    <button
                      onClick={() => {
                        if (!noteText.trim()) return;
                        store.addNote({ entityType: "client", entityId: profileClient.id, note: noteText.trim() });
                        setNoteText("");
                      }}
                      className="btn-primary !px-4 !py-2"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            )}
          </Drawer>

          <ConfirmDialog
            open={deleting !== null}
            title="Delete client"
            message={`This permanently removes ${deleting?.name} (${deleting?.id}).`}
            onCancel={() => setDeleting(null)}
            onConfirm={() => {
              if (deleting) store.deleteClient(deleting.id);
              setDeleting(null);
            }}
          />
        </>
      )}
    </div>
  );
}
