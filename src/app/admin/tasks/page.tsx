"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardCheck } from "lucide-react";

import type { CheckinColumnRow } from "@/lib/admin/types";
import {
  demoPendingReviews,
  demoReviewUpsert,
  demoReviewStates,
} from "@/lib/demo/admin-crm";
import { useAdminStore } from "@/lib/demo/admin-store";
import { isDemoMode } from "@/lib/mode";

/**
 * Check-in review workbench (Task 7 #5).
 *
 * Demo mode: pending reviews simulated FROM the demo store progress rows
 * (every row flagged demo:true); approve/needs-work verdicts are recorded
 * in the in-memory demo module. Zero network.
 *
 * Live mode: GET /api/admin/tasks/review lists open work (weekly/monthly
 * cadence via checkin_requests.period_label, submissions without a
 * checkin_reviews verdict); POST submits an approve/needs_work verdict —
 * coach-assistants are blocked by the route (403), admin+coach only.
 */
export default function AdminTasksPage() {
  const demo = useMemo(() => isDemoMode(), []);
  const progress = useAdminStore((s) => s.progress);

  const [role, setRole] = useState<"admin" | "coach" | "coach_assistant" | null>(
    demo ? "admin" : null
  );
  const [open, setOpen] = useState<CheckinColumnRow[]>([]);
  const [locked, setLocked] = useState<CheckinColumnRow[]>([]);
  const [clients, setClients] = useState<Map<string, string>>(new Map());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const demoRows = useMemo(
    () => (demo ? [...demoPendingReviews(progress), ...([] as CheckinColumnRow[])] : []),
    [demo, progress]
  );

  const load = useCallback(async () => {
    setError(null);
    if (demo) {
      const results = demoReviewStates();
      const openRows = demoRows.filter(
        (r) => !results.some((a) => a.submission_id === r.submission_id)
      );
      setOpen(openRows);
      setLocked(
        demoRows
          .map((r) => {
            const verdict = results.find((a) => a.submission_id === r.submission_id);
            return verdict
              ? { ...r, review_status: verdict.status as CheckinColumnRow["review_status"] }
              : null;
          })
          .filter((x): x is CheckinColumnRow => x !== null)
      );
      setClients(
        new Map(
          progress
            .filter((p) => Boolean(p.clientId))
            .map((p) => [p.clientId as string, p.clientName])
        )
      );
      return;
    }
    const res = await fetch("/api/admin/tasks/review");
    const data = (await res.json()) as {
      ok?: boolean;
      role?: "admin" | "coach" | "coach_assistant" | null;
      columns?: CheckinColumnRow[];
      all?: CheckinColumnRow[];
      clients?: { id: string; client_code: string | null; full_name: string }[];
      error?: string;
    };
    if (!res.ok || !data.ok) {
      setError(data.error ?? `HTTP ${res.status}`);
      return;
    }
    setRole(data.role ?? null);
    setOpen(data.columns ?? []);
    setLocked(data.all ?? []);
    setClients(
      new Map((data.clients ?? []).map((c) => [c.id, c.full_name || c.client_code || "—"]))
    );
  }, [demo, demoRows, progress]);

  useEffect(() => {
    void load();
  }, [load, reload]);

  const submit = async (
    submissionId: string,
    status: "approved" | "needs_work"
  ) => {
    if (busyId) return;
    setBusyId(submissionId);
    setError(null);
    if (demo) {
      demoReviewUpsert({ submission_id: submissionId, status, feedback });
      setFeedback("");
      setBusyId(null);
      setReload((n) => n + 1);
      return;
    }
    const res = await fetch("/api/admin/tasks/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submission_id: submissionId,
        status,
        feedback: feedback || undefined,
      }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      role?: string;
      detail?: string;
    };
    setBusyId(null);
    if (!res.ok || !data.ok) {
      setError(
        data.detail ??
          data.error ??
          `HTTP ${res.status}${data.role ? ` (${data.role})` : ""}`
      );
      return;
    }
    setFeedback("");
    setReload((n) => n + 1);
  };

  const label = (id: string) => clients.get(id) ?? id;

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <ClipboardCheck className="h-5 w-5 text-copper" />
        <h1 className="font-display font-bold text-3xl text-bone">
          Check-in Reviews
        </h1>
      </div>
      <p className="text-sm text-wgray mt-1 mb-6">
        Weekly/monthly cadence follow-up {demo ? "— demo rows only" : ""}
      </p>

      {error && (
        <p className="text-sm text-red-300 border border-red-400/30 bg-red-500/10 px-4 py-3 mb-4">
          {error}
        </p>
      )}

      {role === "coach_assistant" && liveGate(demo) && (
        <p className="text-xs text-wgray border border-wgray-dim/40 bg-surface px-4 py-3 mb-4">
          Assistants inherit VIEW access — review verdicts are admin/coach only
          (route-enforced).
        </p>
      )}

      {/* Open work */}
      <h2 className="font-display font-semibold text-lg text-bone mb-3">
        Pending review ({open.length})
      </h2>
      {open.length === 0 ? (
        <p className="text-sm text-wgray-dim py-10 text-center card-surface">
          Nothing pending — every submitted check-in has a verdict.
        </p>
      ) : (
        <div className="space-y-4">
          {open.map((r) => (
            <div key={r.submission_id} className="card-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-bone font-medium">
                    {label(labelKey(r))} · {r.period_label ?? "custom"}{" "}
                    {r.period_start ? `(${r.period_start})` : ""}
                  </p>
                  <p className="text-xs text-wgray mt-0.5">
                    submitted {r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "—"}
                    {" · "}
                    {r.weight_kg ?? "?"} kg · workouts {r.workout_pct ?? "?"}% ·
                    nutrition {r.nutrition_pct ?? "?"}%
                  </p>
                  {r.feedback && (
                    <p className="text-xs text-wgray-dim mt-1">{r.feedback}</p>
                  )}
                </div>
                {r.demo && (
                  <span className="text-[10px] font-display uppercase tracking-widest bg-copper/15 text-copper border border-copper/40 px-2 py-0.5 rounded-full">
                    Demo
                  </span>
                )}
              </div>
              <div className="mt-4 flex items-stretch gap-2">
                <input
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Feedback (optional)..."
                  disabled={busyId === r.submission_id}
                  className="input-dark flex-1"
                  aria-label={`Feedback for submission ${r.submission_id}`}
                />
                <button
                  onClick={() => void submit(r.submission_id, "approved")}
                  disabled={busyId === r.submission_id}
                  className="btn-primary !px-4 !py-2 disabled:opacity-40"
                >
                  Approve
                </button>
                <button
                  onClick={() => void submit(r.submission_id, "needs_work")}
                  disabled={busyId === r.submission_id}
                  className="border border-wgray-dim text-wgray hover:text-red-300 hover:border-red-400/40 px-4 py-2 text-sm font-display uppercase tracking-widest transition-colors disabled:opacity-40"
                >
                  Needs work
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Already reviewed this window */}
      {locked.length > 0 && (
        <>
          <h2 className="font-display font-semibold text-lg text-bone mt-10 mb-3">
            Reviewed ({locked.length})
          </h2>
          <div className="card-surface overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr>
                  <th className="table-head">Client</th>
                  <th className="table-head">Cadence</th>
                  <th className="table-head">Verdict</th>
                  <th className="table-head">Feedback</th>
                </tr>
              </thead>
              <tbody>
                {locked.map((r) => (
                  <tr key={r.submission_id} className="hover:bg-surface/40 transition-colors">
                    <td className="table-cell">{label(labelKey(r))}</td>
                    <td className="table-cell text-wgray">{r.period_label ?? "—"}</td>
                    <td className="table-cell">
                      <span
                        className={
                          r.review_status === "approved"
                            ? "text-emerald-300"
                            : "text-orange-300"
                        }
                      >
                        {r.review_status}
                      </span>
                    </td>
                    <td className="table-cell text-xs text-wgray">
                      {r.feedback ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const labelKey = (r: CheckinColumnRow) => r.client_id ?? r.submission_id;

/* Live-only gating helper keeps the notice logic in one place. */
function liveGate(demo: boolean): boolean {
  return !demo;
}
