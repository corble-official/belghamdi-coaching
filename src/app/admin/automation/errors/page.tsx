import { AlertTriangle } from "lucide-react";

import {
  AutomationErrorsView,
  type AutomationErrorGroupVM,
  type ErrorResolutionVM,
} from "@/components/admin/automation-errors-view";
import {
  demoAutomationErrors,
  demoErrorResolutions,
} from "@/lib/demo/admin-crm";
import { n8nBaseUrl } from "@/lib/integrations/n8n-client";
import { getAdminContext } from "@/lib/supabase/admin-context";
import { tryCreateServiceClient } from "@/lib/supabase/supabase-service";

export const dynamic = "force-dynamic";

/**
 * BC-99 view (Task 10) — deduped automation error list, ADMIN-ONLY.
 *
 * READ-ONLY BINDING: this page never mutates `automation_errors`
 * (no update/delete/resolve-state write exists anywhere in the app —
 * `status`/`resolved_at` on that table are owned by the BC-99 n8n
 * workflow). The "Resolve" affordance in the view POSTs to
 * /api/admin/automation-resolutions, which inserts into
 * `automation_error_resolutions` only.
 *
 * Live reads run on the SERVICE client strictly after the admin gate
 * (RLS: bc_automation_errors_select_admin / bc_aer_select_admin are
 * admin-only — the service read mirrors exactly that scope).
 * Resolutions are fetched in ONE batched `.in("error_id", ids)` query.
 *
 * Demo: rows come from the in-memory demo ledger (zero network), every
 * row flagged `demo: true`.
 */

type RawErrorRow = {
  id: string;
  dedupe_key: string | null;
  workflow: string;
  execution_id: string | null;
  node_name: string | null;
  stage: string | null;
  error_message: string;
  severity: string;
  status: string;
  occurrences: number | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  resolved_at: string | null;
};

/** Group rows by dedupe_key (fallback: row id) — sum occurrences, latest wins. */
function groupErrors(
  errors: RawErrorRow[],
  resolutions: ErrorResolutionVM[]
): AutomationErrorGroupVM[] {
  const base = n8nBaseUrl().replace(/\/+$/, "");
  const byKey = new Map<string, RawErrorRow[]>();
  for (const row of errors) {
    const key = row.dedupe_key ?? row.id;
    const list = byKey.get(key);
    if (list) list.push(row);
    else byKey.set(key, [row]);
  }

  const groups: AutomationErrorGroupVM[] = [];
  for (const entry of Array.from(byKey.entries())) {
    const key = entry[0];
    const rows = entry[1];
    // Representative row = latest by last_seen_at (desc sort already
    // applied on read; keep it deterministic regardless).
    const rep = [...rows].sort((a, b) =>
      (b.last_seen_at ?? "").localeCompare(a.last_seen_at ?? "")
    )[0];
    const ids = rows.map((r) => r.id);
    const execId = rep.execution_id;
    groups.push({
      key,
      dedupe_key: rep.dedupe_key,
      latest_error_id: rep.id,
      workflow: rep.workflow,
      node_name: rep.node_name,
      stage: rep.stage,
      error_message: rep.error_message,
      severity: rep.severity,
      status: rep.status,
      occurrences: rows.reduce((sum, r) => sum + (r.occurrences ?? 1), 0),
      first_seen_at:
        rows
          .map((r) => r.first_seen_at)
          .filter((v): v is string => Boolean(v))
          .sort()[0] ?? null,
      last_seen_at: rep.last_seen_at,
      resolved_at: rep.resolved_at,
      execution_id: execId,
      execution_url:
        base && execId ? `${base}/execution/${execId}` : null,
      resolutions: resolutions
        .filter((r) => ids.includes(r.error_id))
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
      demo: false,
    });
  }

  // Latest activity first.
  return groups.sort((a, b) =>
    (b.last_seen_at ?? "").localeCompare(a.last_seen_at ?? "")
  );
}

export default async function AdminAutomationErrorsPage() {
  const ctx = await getAdminContext();

  // Admin-ONLY page: coaches/assistants and anonymous callers get the
  // same inline forbidden box used by the notifications page.
  if (ctx.role !== "admin") {
    return (
      <div className="p-6 lg:p-10 max-w-7xl mx-auto">
        <h1 className="font-display font-bold text-3xl text-bone">
          Automation errors
        </h1>
        <p className="text-sm text-red-300 border border-red-400/30 bg-red-500/10 px-4 py-3 mt-6">
          Forbidden — admin scope required.
        </p>
      </div>
    );
  }

  let groups: AutomationErrorGroupVM[] = [];

  if (ctx.demo) {
    const demoResolutions: ErrorResolutionVM[] = demoErrorResolutions().map(
      (r) => ({
        id: r.id,
        error_id: r.error_id,
        resolved_by: r.resolved_by,
        // Demo resolvers are the legacy-cookie admin (no profile id) — the
        // view falls back to "admin".
        resolved_by_name: null,
        resolution_note: r.resolution_note,
        created_at: r.created_at,
        demo: true,
      })
    );
    groups = groupErrors(
      demoAutomationErrors().map((e) => ({
        id: e.id,
        dedupe_key: e.dedupe_key,
        workflow: e.workflow,
        execution_id: e.execution_id,
        node_name: e.node_name,
        stage: e.stage,
        error_message: e.error_message,
        severity: e.severity,
        status: e.status,
        occurrences: e.occurrences,
        first_seen_at: e.first_seen_at,
        last_seen_at: e.last_seen_at,
        resolved_at: e.resolved_at,
      })),
      demoResolutions.map((r) => ({ ...r }))
    );
    groups = groups.map((g) => ({ ...g, demo: true }));
  } else {
    const service = tryCreateServiceClient();
    if (!service) {
      return (
        <div className="p-6 lg:p-10 max-w-7xl mx-auto">
          <h1 className="font-display font-bold text-3xl text-bone">
            Automation errors
          </h1>
          <p className="text-sm text-red-300 border border-red-400/30 bg-red-500/10 px-4 py-3 mt-6">
            Database unavailable (db_down) — retry once the service connection
            is configured.
          </p>
        </div>
      );
    }

    const errorsRes = await service
      .from("automation_errors")
      .select(
        "id, dedupe_key, workflow, execution_id, node_name, stage, error_message, severity, status, occurrences, first_seen_at, last_seen_at, resolved_at"
      )
      .order("last_seen_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (errorsRes.error) {
      console.error(
        "[admin/automation-errors] errors read failed",
        errorsRes.error.message
      );
      return (
        <div className="p-6 lg:p-10 max-w-7xl mx-auto">
          <h1 className="font-display font-bold text-3xl text-bone">
            Automation errors
          </h1>
          <p className="text-sm text-red-300 border border-red-400/30 bg-red-500/10 px-4 py-3 mt-6">
            Could not read automation errors (db_read_failed).
          </p>
        </div>
      );
    }

    const rows = (errorsRes.data ?? []) as unknown as RawErrorRow[];
    const ids = rows.map((r) => r.id);

    let resolutions: ErrorResolutionVM[] = [];
    if (ids.length > 0) {
      const resRes = await service
        .from("automation_error_resolutions")
        .select("id, error_id, resolved_by, resolution_note, created_at")
        .in("error_id", ids)
        .order("created_at", { ascending: false });
      if (resRes.error) {
        // Degraded UX: show errors without their annotations.
        console.error(
          "[admin/automation-errors] resolutions read failed",
          resRes.error.message
        );
      } else {
        resolutions = ((resRes.data ?? []) as Record<string, unknown>[]).map(
          (r) => ({
            id: String(r.id),
            error_id: String(r.error_id),
            resolved_by:
              typeof r.resolved_by === "string" ? r.resolved_by : null,
            resolved_by_name: null,
            resolution_note:
              typeof r.resolution_note === "string" ? r.resolution_note : null,
            created_at: String(r.created_at),
            demo: false,
          })
        );

        // Human-readable resolver names: ONE batched profiles read for every
        // distinct resolved_by uuid (nulls stay null → view falls back).
        const resolverIds = Array.from(
          new Set(
            resolutions
              .map((r) => r.resolved_by)
              .filter((v): v is string => Boolean(v))
          )
        );
        if (resolverIds.length > 0) {
          const profRes = await service
            .from("profiles")
            .select("id, full_name")
            .in("id", resolverIds);
          if (profRes.error) {
            // Degraded UX: keep the truncated-uuid fallback.
            console.error(
              "[admin/automation-errors] resolver names read failed",
              profRes.error.message
            );
          } else {
            const nameById = new Map<string, string>();
            for (const p of (profRes.data ?? []) as Record<string, unknown>[]) {
              if (typeof p.id === "string" && typeof p.full_name === "string") {
                nameById.set(p.id, p.full_name);
              }
            }
            resolutions = resolutions.map((r) => ({
              ...r,
              resolved_by_name:
                (r.resolved_by && nameById.get(r.resolved_by)) || null,
            }));
          }
        }
      }
    }

    groups = groupErrors(rows, resolutions);
  }

  const openCount = groups.filter((g) => g.resolved_at === null).length;

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-copper" />
        <h1 className="font-display font-bold text-3xl text-bone">
          Automation errors
        </h1>
      </div>
      <p className="text-sm text-wgray mt-1 mb-8">
        BC-99 error log, deduplicated by key — {groups.length} group
        {groups.length === 1 ? "" : "s"}, {openCount} unresolved
        {ctx.demo ? " · demo rows, simulated only" : ""}. Error rows are
        read-only here; resolving records an annotation in the resolutions
        ledger.
      </p>
      <AutomationErrorsView groups={groups} />
    </div>
  );
}
