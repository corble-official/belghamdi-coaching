"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ExternalLink, ShieldCheck } from "lucide-react";

export type ErrorResolutionVM = {
  id: string;
  error_id: string;
  resolved_by: string | null;
  /** Profile full_name for `resolved_by` (server-resolved; null = fallback). */
  resolved_by_name: string | null;
  resolution_note: string | null;
  created_at: string;
  demo: boolean;
};

/**
 * One deduped group (grouped by `dedupe_key` server-side). `occurrences`
 * sums every underlying row; the representative row is the latest by
 * last_seen_at. Resolutions aggregate every row in the group.
 */
export type AutomationErrorGroupVM = {
  key: string;
  dedupe_key: string | null;
  latest_error_id: string;
  workflow: string;
  node_name: string | null;
  stage: string | null;
  error_message: string;
  severity: string;
  status: string;
  occurrences: number;
  first_seen_at: string | null;
  last_seen_at: string | null;
  resolved_at: string | null;
  execution_id: string | null;
  execution_url: string | null;
  resolutions: ErrorResolutionVM[];
  demo: boolean;
};

const severityChip = (severity: string) => {
  const s = severity.toLowerCase();
  if (s === "critical")
    return "bg-red-500/10 border-red-400/30 text-red-300";
  if (s === "error" || s === "critical_error")
    return "bg-orange-500/10 border-orange-400/30 text-orange-300";
  if (s === "warning")
    return "bg-amber-500/10 border-amber-400/30 text-amber-300";
  return "bg-surface border-wgray-dim/50 text-wgray";
};

const fmt = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleString() : "—";

export function AutomationErrorsView({
  groups,
}: {
  groups: AutomationErrorGroupVM[];
}) {
  const router = useRouter();
  const [panelFor, setPanelFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openResolve = (key: string) => {
    setPanelFor(key);
    setNote("");
    setFormError(null);
  };

  const closeResolve = () => {
    setPanelFor(null);
    setNote("");
    setFormError(null);
  };

  const submitResolve = async (group: AutomationErrorGroupVM) => {
    const trimmed = note.trim();
    if (!trimmed) {
      setFormError("A resolution note is required.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch("/api/admin/automation-resolutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error_id: group.latest_error_id,
          resolution_note: trimmed,
        }),
      });
      if (res.ok) {
        closeResolve();
        // Server data is the source of truth (demo ledger or live rows).
        router.refresh();
      } else {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setFormError(
          body?.error === "forbidden"
            ? "Forbidden — admin scope required."
            : body?.error === "missing_note"
              ? "A resolution note is required."
              : "Could not record the resolution — try again."
        );
      }
    } catch {
      setFormError("Network error — resolution not recorded.");
    } finally {
      setBusy(false);
    }
  };

  if (groups.length === 0) {
    return (
      <div className="card-surface p-10 text-center">
        <CheckCircle2 className="h-6 w-6 text-green-300 mx-auto" />
        <p className="text-sm text-wgray mt-3">
          No automation errors recorded — BC-99 has nothing open.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const resolved = g.resolved_at !== null;
        return (
          <div key={g.key} className="card-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-[10px] font-display uppercase tracking-widest border px-2 py-0.5 rounded-full ${severityChip(g.severity)}`}
                  >
                    {g.severity}
                  </span>
                  <span className="text-[10px] font-display uppercase tracking-widest border px-2 py-0.5 rounded-full border-wgray-dim/50 text-wgray">
                    {g.status}
                  </span>
                  {resolved ? (
                    <span className="text-[10px] font-display uppercase tracking-widest border border-green-300/30 bg-green-500/10 text-green-300 px-2 py-0.5 rounded-full">
                      Resolved {fmt(g.resolved_at)}
                    </span>
                  ) : null}
                  <span className="text-[10px] font-display uppercase tracking-widest border border-copper/40 text-copper px-2 py-0.5 rounded-full">
                    ×{g.occurrences} occurrence{g.occurrences === 1 ? "" : "s"}
                  </span>
                  {g.demo ? (
                    <span className="text-[10px] font-display uppercase tracking-widest bg-copper/15 text-copper border border-copper/40 px-2 py-0.5 rounded-full">
                      Demo
                    </span>
                  ) : null}
                </div>
                <p className="font-display font-semibold text-sm text-bone mt-3 leading-snug">
                  {g.workflow}
                </p>
                <p className="text-xs text-wgray mt-1">
                  {g.node_name ?? "unknown node"}
                  {g.stage ? ` · stage: ${g.stage}` : ""}
                </p>
              </div>
              <button
                onClick={() =>
                  panelFor === g.key ? closeResolve() : openResolve(g.key)
                }
                className="btn-secondary !py-1.5 !px-3 text-xs shrink-0"
                aria-expanded={panelFor === g.key}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {panelFor === g.key ? "Cancel" : "Resolve"}
              </button>
            </div>

            <p className="text-xs text-red-300/80 bg-red-500/5 border border-red-400/20 rounded p-3 mt-4 font-latin break-words whitespace-pre-wrap">
              {g.error_message}
            </p>

            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-[10px] uppercase tracking-widest text-wgray-dim">
              <span>First seen: {fmt(g.first_seen_at)}</span>
              <span>Last seen: {fmt(g.last_seen_at)}</span>
              {g.dedupe_key ? <span>Key: {g.dedupe_key}</span> : null}
              {g.execution_id ? (
                g.execution_url ? (
                  <a
                    href={g.execution_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-copper hover:underline normal-case"
                  >
                    Execution {g.execution_id}{" "}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span>Execution: {g.execution_id}</span>
                )
              ) : null}
            </div>

            {panelFor === g.key ? (
              <div className="mt-4 border border-wgray-dim/50 rounded p-4 bg-surface/40">
                <label
                  htmlFor={`resolve-note-${g.key}`}
                  className="label-dark text-xs"
                >
                  Resolution note (required)
                </label>
                <textarea
                  id={`resolve-note-${g.key}`}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="What was investigated / fixed for this failure?"
                  className="input-dark mt-2 w-full"
                />
                {formError ? (
                  <p className="flex items-center gap-2 text-xs text-red-300 mt-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />{" "}
                    {formError}
                  </p>
                ) : null}
                <p className="text-[10px] text-wgray-dim mt-2 leading-relaxed">
                  Records an annotation only — the error row itself stays
                  untouched (status/resolved state are owned by the BC-99
                  workflow).
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => submitResolve(g)}
                    disabled={busy || note.trim().length === 0}
                    className="btn-primary !py-1.5 !px-4 text-xs disabled:opacity-50"
                  >
                    {busy ? "Recording…" : "Record resolution"}
                  </button>
                  <button
                    onClick={closeResolve}
                    disabled={busy}
                    className="btn-secondary !py-1.5 !px-4 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {g.resolutions.length > 0 ? (
              <div className="mt-4 border-t border-wgray-dim/40 pt-3 space-y-2">
                <p className="text-[10px] font-display uppercase tracking-widest text-wgray">
                  Resolutions ({g.resolutions.length})
                </p>
                {g.resolutions.map((r) => (
                  <div key={r.id} className="text-xs leading-relaxed">
                    <p className="text-bone break-words">
                      <ShieldCheck className="inline h-3.5 w-3.5 text-green-300 mr-1 -mt-0.5" />
                      {r.resolution_note}
                    </p>
                    <p className="text-[10px] text-wgray-dim uppercase tracking-widest mt-0.5">
                      {new Date(r.created_at).toLocaleString()} · by{" "}
                      {r.resolved_by_name ??
                        (r.resolved_by ? `${r.resolved_by.slice(0, 8)}…` : "admin")}
                      {r.demo ? " · demo" : ""}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
