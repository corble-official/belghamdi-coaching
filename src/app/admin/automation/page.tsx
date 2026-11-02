"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Workflow,
  Activity,
  RefreshCcw,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { readOutbox, retryDelivery } from "@/lib/integrations/outbox";
import type { DeliveryRecord } from "@/lib/integrations/contracts";

/* ============================================================
   Automation Center — admin-only.
   Distinguishes: n8n connection health vs delivery status vs
   business-operation completion. Secrets are never displayed.
   ============================================================ */

const WORKFLOWS = [
  { id: "bc02", name: "BC-02 — Website Lead Intake", path: "/webhook/bc02-lead", note: "New — receives qualified website leads" },
  { id: "bc01", name: "BC-01 — AI Sales Assistant v2", path: "Telegram Trigger", note: "Telegram testing integration (kept intact)" },
  { id: "bc03", name: "BC-03 — Client Onboarding", path: "/webhook/bc03-order-event", note: "Verified order → onboarding" },
  { id: "bc04", name: "BC-04 — Weekly Check-in", path: "Schedule 09:00", note: "Check-in requests + forms" },
  { id: "bc05", name: "BC-05 — Missed Check-in Follow-up", path: "Schedule", note: "24h/48h reminders, 72h escalation" },
  { id: "bc06", name: "BC-06 — Coach Tasks", path: "/webhook/bc06-task-event", note: "Task upsert/complete" },
  { id: "bc07", name: "BC-07 — Renewals", path: "/webhook/bc07-renewal-event", note: "Renewal sweep + renewal events" },
  { id: "bc08", name: "BC-08 — Daily Report", path: "Schedule 09:00", note: "Daily KPI report" },
  { id: "bc99", name: "BC-99 — Error Handler", path: "errorWorkflow", note: "Central automation error log" },
];

interface N8nStatus {
  n8n: {
    configured: boolean;
    connected: boolean;
    baseUrl: string;
    error: string | null;
    secretConfigured: boolean;
  };
  checkedAt: string;
}

export default function AdminAutomationPage() {
  const [status, setStatus] = useState<N8nStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useMemo(
    () => () => {
      setDeliveries(readOutbox());
    },
    []
  );

  useEffect(() => {
    refresh();
    const onUpdated = () => refresh();
    window.addEventListener("bc:outbox-updated", onUpdated);
    window.addEventListener("bc:integration-events", onUpdated);
    return () => {
      window.removeEventListener("bc:outbox-updated", onUpdated);
      window.removeEventListener("bc:integration-events", onUpdated);
    };
  }, [refresh]);

  const checkStatus = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/automation/status", { cache: "no-store" });
      setStatus(res.ok ? ((await res.json()) as N8nStatus) : null);
    } catch {
      setStatus(null);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const onRetry = async (rec: DeliveryRecord) => {
    setBusyId(rec.id);
    try {
      await retryDelivery(rec);
      refresh();
    } finally {
      setBusyId(null);
    }
  };

  const retryable = (r: DeliveryRecord) => r.status === "failed" && r.attempts < 3;

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-3xl text-bone">Automation Center</h1>
          <p className="text-sm text-wgray mt-1">
            n8n workflows, webhook deliveries, and automation failures — secrets are never shown here.
          </p>
        </div>
        <button onClick={checkStatus} disabled={checking} className="btn-secondary !py-2 !px-4 text-xs">
          <RefreshCcw className={`h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`} /> Check connection
        </button>
      </div>

      {/* connection status */}
      <div className="grid md:grid-cols-3 gap-4 mt-8">
        <div className="card-surface p-6">
          <p className="text-xs font-display uppercase tracking-widest text-wgray flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-copper" /> n8n connection
          </p>
          <p
            className={`font-display font-bold text-xl mt-2 ${
              status?.n8n.connected ? "text-green-300" : status?.n8n.configured ? "text-red-300" : "text-wgray"
            }`}
          >
            {status ? (status.n8n.connected ? "Connected" : status.n8n.configured ? "Unreachable" : "Not configured") : "—"}
          </p>
          {status?.n8n.baseUrl && <p className="text-[11px] text-wgray mt-1 break-all">{status.n8n.baseUrl}</p>}
          {status?.n8n.error && <p className="text-[11px] text-red-300/80 mt-1">{status.n8n.error}</p>}
        </div>
        <div className="card-surface p-6">
          <p className="text-xs font-display uppercase tracking-widest text-wgray flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-copper" /> Delivery auth
          </p>
          <p className="font-display font-bold text-xl mt-2 text-bone">
            {status ? (status.n8n.secretConfigured ? "HMAC signed" : "Unsigned (demo)") : "—"}
          </p>
          <p className="text-[11px] text-wgray mt-1 leading-relaxed">
            {status?.n8n.secretConfigured
              ? "Events are signed server-side with the shared webhook secret."
              : "Set N8N_BASE_URL + N8N_WEBHOOK_SECRET to enable signed delivery."}
          </p>
        </div>
        <div className="card-surface p-6">
          <p className="text-xs font-display uppercase tracking-widest text-wgray flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-copper" /> Pending / failed
          </p>
          <p className="font-display font-bold text-xl mt-2 text-bone">
            {deliveries.filter((d) => d.status === "pending").length} /{" "}
            <span className="text-red-300">{deliveries.filter((d) => d.status === "failed").length}</span>
          </p>
          <p className="text-[11px] text-wgray mt-1">Outbox records in this environment.</p>
        </div>
      </div>

      <div className="border-t border-wgray-dim/50 my-10" />

      {/* workflow inventory */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-display font-semibold text-xl text-bone flex items-center gap-2">
            <Workflow className="h-5 w-5 text-copper" /> Workflows ({WORKFLOWS.length})
          </h2>
          <p className="text-xs text-wgray mt-1">Live instance: n8n.corble.net — all workflows currently active.</p>
        </div>
        <a
          href="https://n8n.corble.net/home/workflows"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-xs text-copper hover:underline"
        >
          Open n8n <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">
        {WORKFLOWS.map((w) => (
          <div key={w.id} className="card-surface p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display font-semibold text-sm text-bone leading-snug">{w.name}</p>
              <span className="shrink-0 text-[10px] font-display uppercase tracking-widest text-green-300 border border-green-300/30 px-2 py-0.5 rounded-full">
                Active
              </span>
            </div>
            <p className="text-xs text-wgray mt-3 leading-relaxed">{w.note}</p>
            <p className="text-[10px] text-wgray-dim mt-3 font-latin truncate">{w.path}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-wgray-dim/50 my-10" />

      {/* outbox deliveries */}
      <h2 className="font-display font-semibold text-xl text-bone">Webhook deliveries</h2>
      <p className="text-xs text-wgray mt-1 mb-6 leading-relaxed">
        First incoming item = business event created. Delivery status only proves the webhook call; the responding
        workflow JSON decides whether the automation completed.
      </p>
      <div className="card-surface divide-y divide-wgray-dim/40">
        {deliveries.length === 0 && (
          <div className="p-8 text-center">
            <AlertTriangle className="h-6 w-6 text-wgray-dim mx-auto" />
            <p className="text-xs text-wgray mt-3">
              No webhook deliveries yet — events will appear here after leads/orders/renewals are dispatched.
            </p>
          </div>
        )}
        {deliveries.map((d) => (
          <div key={d.id} className="p-5 flex flex-wrap items-center gap-3">
            <span className="shrink-0">
              {d.status === "delivered" ? (
                <CheckCircle2 className="h-5 w-5 text-green-300" />
              ) : d.status === "failed" ? (
                <XCircle className="h-5 w-5 text-red-300" />
              ) : d.status === "skipped" ? (
                <Clock className="h-5 w-5 text-wgray" />
              ) : (
                <RefreshCcw className="h-5 w-5 animate-spin text-copper" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display font-semibold text-sm text-bone truncate">
                {d.endpoint} · {d.eventType}
              </p>
              <p className="text-[11px] text-wgray truncate">
                {d.id} · {d.eventRef || "no ref"} · attempts {d.attempts}/3 · {d.createdAt}
              </p>
              {d.error && <p className="text-[11px] text-red-300/80 truncate">Sanitized error: {d.error}</p>}
              {d.response?.body && (
                <p className="text-[10px] text-wgray-dim truncate max-w-md">
                  Workflow reply: {d.response.body.slice(0, 200)}
                </p>
              )}
            </div>
            {retryable(d) && (
              <button onClick={() => onRetry(d)} disabled={busyId === d.id} className="btn-secondary !py-1.5 !px-3 text-xs shrink-0">
                {busyId === d.id ? "Retrying…" : "Retry"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
