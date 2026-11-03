"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Activity,
  CreditCard,
  MessageSquare,
} from "lucide-react";

import { StatusBadge } from "@/components/admin/ui";
import type {
  AdminClientBundle,
  CheckinColumnRow,
} from "@/lib/admin/types";
import {
  demoConversationFor,
  demoPaymentsFor,
  demoTimelineFor,
} from "@/lib/demo/admin-crm";
import { useAdminStore } from "@/lib/demo/admin-store";
import { isDemoMode } from "@/lib/mode";

/**
 * Profile drawer page (Task 7 #2) — the full per-client bundle:
 * personal info, onboarding, subscriptions + events timeline, weekly /
 * monthly check-in columns, measurements, signed photos, unified
 * conversations (telegram + web), coach feedback, payment history and
 * integration activity.
 *
 * Demo path: zero network — the bundle is composed from the demo store +
 * the admin-crm demo module (rows flagged demo:true).
 * Live path: GET /api/admin/clients/[id] (role-checked service bundle).
 * Consolidation of the unified thread lives server-side there; the Task-6
 * reconciliation note is surfaced in the conversations section.
 */

const fmt = (v: string | null | undefined): string =>
  v ? new Date(v).toLocaleString() : "—";

function Section({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="card-surface p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-semibold text-lg text-bone">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

const KV = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div>
    <p className="text-[10px] uppercase tracking-widest text-wgray-dim">{k}</p>
    <p className="text-sm text-bone mt-1 break-words">{v ?? "—"}</p>
  </div>
);

function CheckinTable({ rows }: { rows: CheckinColumnRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-wgray-dim">No submissions for this cadence yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px]">
        <thead>
          <tr>
            <th className="table-head">Period</th>
            <th className="table-head">Submitted</th>
            <th className="table-head">Weight</th>
            <th className="table-head">Training</th>
            <th className="table-head">Workout</th>
            <th className="table-head">Nutrition</th>
            <th className="table-head">Review</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.submission_id} className="hover:bg-surface/40 transition-colors">
              <td className="table-cell text-xs text-wgray">
                {r.period_start ?? "—"}
                {r.period_end ? ` → ${r.period_end}` : ""}
              </td>
              <td className="table-cell text-xs text-wgray">{fmt(r.submitted_at)}</td>
              <td className="table-cell">{r.weight_kg ?? "—"}</td>
              <td className="table-cell">{r.training_days_made ?? "—"}</td>
              <td className="table-cell">{r.workout_pct == null ? "—" : `${r.workout_pct}%`}</td>
              <td className="table-cell">{r.nutrition_pct == null ? "—" : `${r.nutrition_pct}%`}</td>
              <td className="table-cell">
                <span
                  className={
                    r.review_status === "approved"
                      ? "text-emerald-300"
                      : r.review_status === "needs_work"
                        ? "text-orange-300"
                        : "text-wgray"
                  }
                >
                  {r.review_status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminClientDrawerPage() {
  const params = useParams<{ id: string }>();
  const clientId = typeof params?.id === "string" ? params.id : "";
  const demo = useMemo(() => isDemoMode(), []);
  const store = useAdminStore();

  const [bundle, setBundle] = useState<AdminClientBundle | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* ---------- demo bundle from the store + demo module ---------- */
  const demoBundle = useMemo<AdminClientBundle | null>(() => {
    if (!demo || !clientId) return null;
    const c = store.clients.find((x) => x.id === clientId);
    if (!c) return null;
    const order = store.orders.find(
      (o) => o.customerId === c.id || o.customer === c.name
    );
    const sub = store.subscriptions.find((s) => s.clientId === c.id);
    const progress = store.progress.filter((p) => p.clientId === c.id);
    const demoColumns: CheckinColumnRow[] = progress.map((p, i) => ({
      submission_id: p.id,
      request_id: `demo-req-${p.id}`,
      client_id: p.clientId ?? null,
      period_label: i % 2 === 0 ? "weekly" : "monthly",
      period_start: p.date.slice(0, 10),
      period_end: p.date.slice(0, 10),
      request_status: "sent",
      submitted_at: p.date,
      weight_kg: p.weightKg,
      training_days_made: Math.round(p.workoutCompletionPct / 25),
      workout_pct: p.workoutCompletionPct,
      nutrition_pct: p.nutritionAdherencePct,
      energy: null,
      sleep: null,
      difficulties: null,
      feedback: p.notes,
      review_status: "none",
      demo: true,
    }));
    return {
      ok: true,
      demo: true,
      role: "admin",
      client: {
        id: c.id,
        client_code: c.id,
        full_name: c.name,
        email: c.email,
        phone: c.phone,
        telegram_user_id: null,
        telegram_chat_id: null,
        fitness_goal: c.fitnessGoal,
        training_location: null,
        training_days: null,
        experience_level: c.experienceLevel,
        notes: c.notes,
        package_id: c.coachingPackage === "none" ? null : c.coachingPackage,
        status: c.subscriptionStatus,
        onboarding_completed: c.subscriptionStatus === "active",
        created_at: c.createdAt,
        demo: true,
      },
      onboarding: { request: null, submission: null, demo: true },
      subscriptions: sub
        ? [
            {
              id: sub.id,
              subscription_code: sub.id,
              package_id: sub.package,
              status: sub.status,
              start_date: sub.startDate,
              end_date: sub.renewalDate,
              demo: true,
            },
          ]
        : [],
      timeline: demoTimelineFor(c.id, sub?.startDate),
      weekly: demoColumns.filter((c) => c.period_label === "weekly"),
      monthly: demoColumns.filter((c) => c.period_label === "monthly"),
      measurements: [],
      photos: [],
      messages: demoConversationFor(c.id),
      web_conversation_id: `web-${c.id}`,
      feedback: [],
      payments: order
        ? [
            {
              id: order.id,
              event_type: "order.paid",
              order_ref: order.shopifyOrderId ?? null,
              status: order.paymentStatus,
              created_at: order.date,
              summary: `${order.productTitle} — ${order.total} EGP (demo)`,
              demo: true,
            },
            ...demoPaymentsFor(c.name).slice(0, 0),
          ]
        : demoPaymentsFor(c.name),
      activity: [],
      reconciliation: null,
    };
  }, [demo, clientId, store.clients, store.orders, store.subscriptions, store.progress]);

  useEffect(() => {
    if (demo) {
      setBundle(demoBundle);
      setError(demoBundle ? null : "Demo client not found");
      return;
    }
    let alive = true;
    fetch(`/api/admin/clients/${clientId}`)
      .then(async (res) => {
        const data = (await res.json()) as AdminClientBundle | { ok?: boolean; error?: string };
        if (!alive) return;
        if (!res.ok || !("ok" in data && data.ok)) {
          setError(("error" in data && data.error) || `HTTP ${res.status}`);
          return;
        }
        setBundle(data as AdminClientBundle);
      })
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, [demo, demoBundle, clientId]);

  if (error) {
    return (
      <div className="p-6 lg:p-10 max-w-7xl mx-auto">
        <Link href="/admin/clients" className="text-copper text-sm inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to clients
        </Link>
        <p className="text-sm text-red-300 border border-red-400/30 bg-red-500/10 px-4 py-3 mt-6">
          {error}
        </p>
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="p-6 lg:p-10 max-w-7xl mx-auto">
        <p className="text-sm text-wgray-dim">Loading client profile…</p>
      </div>
    );
  }

  const b = bundle;

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      {/* Drawer-style header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-wgray-dim/50">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/clients"
            className="p-2 border border-wgray-dim text-wgray hover:text-bone transition-colors"
            aria-label="Back to clients"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="font-display font-bold text-2xl text-bone">
              {b.client.full_name}
            </h1>
            <p className="text-xs text-wgray mt-1 font-mono">
              {b.client.client_code || b.client.id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={b.client.status} />
          {b.client.package_id && (
            <span className="text-[10px] font-display uppercase tracking-widest text-copper border border-copper/40 px-2.5 py-1">
              {b.client.package_id}
            </span>
          )}
          {b.demo && (
            <span className="text-[10px] font-display uppercase tracking-widest bg-copper/15 text-copper border border-copper/40 px-2 py-0.5 rounded-full">
              Demo
            </span>
          )}
        </div>
      </div>

      <div className="mt-8 space-y-8">
        {/* Personal info */}
        <Section title="Personal info">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            <KV k="Name" v={b.client.full_name} />
            <KV k="Email" v={b.client.email ?? "—"} />
            <KV k="Phone" v={b.client.phone ?? "—"} />
            <KV k="Client status" v={b.client.status} />
            <KV k="Fitness goal" v={b.client.fitness_goal ?? "—"} />
            <KV k="Experience" v={b.client.experience_level ?? "—"} />
            <KV k="Training days" v={b.client.training_days ?? "—"} />
            <KV k="Location" v={b.client.training_location ?? "—"} />
            <KV k="Telegram chat" v={b.client.telegram_chat_id ?? "—"} />
            <KV k="Onboarding done" v={b.client.onboarding_completed ? "yes" : "no"} />
            <KV k="Created" v={fmt(b.client.created_at)} />
          </div>
          {b.client.notes && (
            <p className="text-sm text-wgray mt-5 border-t border-wgray-dim/40 pt-4 whitespace-pre-wrap">
              {b.client.notes}
            </p>
          )}
        </Section>

        {/* Onboarding */}
        <Section title="Onboarding">
          {b.onboarding.request || b.onboarding.submission ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              <KV k="Request status" v={b.onboarding.request?.status ?? "—"} />
              <KV k="Channel" v={b.onboarding.request?.channel ?? "—"} />
              <KV k="Sent / completed" v={`${fmt(b.onboarding.request?.sent_at ?? null)} / ${fmt(b.onboarding.request?.completed_at ?? null)}`} />
              {b.onboarding.submission && (
                <>
                  <KV k="Submitted" v={fmt(b.onboarding.submission.submitted_at)} />
                  <KV
                    k="Submission data"
                    v={
                      b.onboarding.submission.data
                        ? `${Object.keys(b.onboarding.submission.data).length} fields (jsonb)`
                        : "—"
                    }
                  />
                </>
              )}
            </div>
          ) : (
            <p className="text-sm text-wgray-dim">
              No onboarding request recorded
              {b.demo ? " (demo client seeds none)" : " yet."}
            </p>
          )}
        </Section>

        {/* Subscriptions + timeline */}
        <Section title="Subscriptions & lifecycle timeline">
          <div className="space-y-2 mb-6">
            {b.subscriptions.length === 0 ? (
              <p className="text-sm text-wgray-dim">No client_subscriptions rows.</p>
            ) : (
              b.subscriptions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between bg-surface border border-wgray-dim/40 p-4"
                >
                  <div>
                    <p className="text-sm text-bone capitalize">
                      {s.package_id} package · {s.subscription_code}
                    </p>
                    <p className="text-xs text-wgray-dim mt-0.5">
                      {s.start_date} → {s.end_date}
                      {s.demo ? " · demo" : ""}
                    </p>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
              ))
            )}
          </div>
          {b.timeline.length > 0 && (
            <ol className="border-l border-wgray-dim ml-2 space-y-3">
              {b.timeline.map((e) => (
                <li key={e.id} className="pl-5 relative">
                  <span className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-copper" />
                  <p className="text-sm text-bone">
                    {e.event_type}{" "}
                    <span className="text-wgray-dim text-xs">· {e.source}</span>
                  </p>
                  <p className="text-xs text-wgray-dim">
                    {fmt(e.occurred_at)}
                    {e.payload_reference ? ` · ${e.payload_reference.slice(0, 120)}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Section>

        {/* Weekly columns */}
        <Section title="Weekly check-ins">
          <CheckinTable rows={b.weekly} />
        </Section>

        {/* Monthly columns */}
        <Section title="Monthly reviews">
          <CheckinTable rows={b.monthly} />
        </Section>

        {/* Measurements photos side by side */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Section title="Measurements history">
            {b.measurements.length === 0 ? (
              <p className="text-sm text-wgray-dim">No measurements recorded.</p>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {b.measurements.map((m) => (
                  <div key={m.submission_id} className="bg-surface border border-wgray-dim/40 p-3">
                    <p className="text-xs text-wgray-dim">{fmt(m.submitted_at)}</p>
                    <p className="text-sm text-bone font-mono mt-1 break-all">
                      {m.measurements
                        ? Object.entries(m.measurements)
                            .map(([k, v]) => `${k}: ${String(v)}`)
                            .join(" · ")
                        : "—"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Photos (signed URLs · 10 min)">
            {b.photos.length === 0 ? (
              <p className="text-sm text-wgray-dim">
                No check-in photos{" "}
                {b.demo ? "(demo rows carry no real bucket objects)" : "in the bucket path for this client."}
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {b.photos.map((p) => (
                  <a
                    key={`${p.submission_id}-${p.path}`}
                    href={p.url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className={`text-xs break-all border p-2 ${
                      p.url
                        ? "border-wgray-dim/40 hover:border-copper text-wgray hover:text-copper transition-colors"
                        : "border-wgray-dim/20 text-wgray-dim"
                    }`}
                  >
                    {p.url ? "view photo" : `sign failed: ${p.path ?? "?"}`}
                  </a>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Conversations */}
        <Section
          title="Conversations (telegram + web unified)"
          right={
            <span className="text-[10px] uppercase tracking-widest text-wgray-dim">
              {b.web_conversation_id}
            </span>
          }
        >
          {b.reconciliation && b.reconciliation.action !== "left_alone" && (
            <p className="text-xs text-copper border border-copper/30 bg-copper/5 px-3 py-2 mb-4">
              reconciliation: {b.reconciliation.detail}
            </p>
          )}
          {b.messages.length === 0 ? (
            <p className="text-sm text-wgray-dim flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> No chat messages for this client yet.
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {b.messages.map((m) => (
                <div
                  key={`${m.id}-${m.message_ts ?? ""}`}
                  className={`flex ${m.role === "coach" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] px-3 py-2 text-sm border ${
                      m.role === "coach"
                        ? "bg-copper/10 border-copper/30 text-bone"
                        : "bg-surface border-wgray-dim/40 text-bone"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    <p className="text-[10px] text-wgray-dim mt-1 uppercase tracking-widest">
                      {m.source}
                      {m.message_ts ? ` · ${fmt(m.message_ts)}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-wgray-dim mt-4">
            Full reply console lives in the Conversations page (role pinned server-side).
          </p>
        </Section>

        {/* Coach feedback */}
        <Section title="Coach feedback (checkin_reviews)">
          {b.feedback.length === 0 ? (
            <p className="text-sm text-wgray-dim">No review verdicts recorded.</p>
          ) : (
            <div className="space-y-2">
              {b.feedback.map((f) => (
                <div key={f.submission_id} className="bg-surface border border-wgray-dim/40 p-3 flex items-center justify-between">
                  <p className="text-sm text-bone">{f.feedback ?? "(no text)"}</p>
                  <span
                    className={
                      f.status === "approved" ? "text-emerald-300 text-xs" : "text-orange-300 text-xs"
                    }
                  >
                    {f.status} · {fmt(f.updated_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Payments + activity */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Section
            title="Payment history"
            right={<CreditCard className="h-4 w-4 text-wgray-dim" />}
          >
            {b.payments.length === 0 ? (
              <p className="text-sm text-wgray-dim">
                No order-linked integration events {b.demo ? "(demo outbox rows shown above)" : "yet"}.
              </p>
            ) : (
              <div className="space-y-2">
                {b.payments.map((p) => (
                  <div key={p.id} className="bg-surface border border-wgray-dim/40 p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-bone">{p.event_type}</p>
                      <p className="text-xs text-wgray-dim">
                        {p.order_ref ?? p.summary ?? "—"} · {fmt(p.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-wgray-dim mt-4">
              Live Shopify orders surface here via the verify-route events in integration_events.
            </p>
          </Section>

          <Section title="Activity" right={<Activity className="h-4 w-4 text-wgray-dim" />}>
            {b.activity.length === 0 ? (
              <p className="text-sm text-wgray-dim">No integration events linked to this client.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {b.activity.map((p) => (
                  <div key={p.id} className="bg-surface border border-wgray-dim/40 p-2.5 text-xs text-wgray">
                    <span className="text-bone">{p.event_type}</span> · {p.status} · {fmt(p.created_at)}
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
