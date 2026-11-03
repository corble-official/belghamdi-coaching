import { NextResponse, type NextRequest } from "next/server";

import type {
  AdminClientBundle,
  CheckinColumnRow,
  ConversationMessageRow,
  ReviewFeedbackRow,
} from "@/lib/admin/types";
import {
  assertStaff,
  canAccessClient,
  scopeDenied,
} from "@/lib/supabase/admin-context";
import {
  createServiceClient,
  createSignedPhotoUrl,
} from "@/lib/supabase/supabase-service";
import { webConversationId } from "@/lib/supabase/portal-chat";

/**
 * GET /api/admin/clients/[id] — the profile-drawer bundle.
 *
 * Role-check FIRST (assertStaff), service-role reads AFTER. Coach/assistant
 * callers are restricted to their assigned clients (acting as 404 otherwise
 * so scoped roles cannot probe unassigned ids).
 *
 * Conversations use a PRAGMATIC JOIN: the client's web thread is
 * `web-{client_id}` (Task 6 contract); telegram rows live under
 * chat_conversations keyed by chat_id. Both are merged into one ascending
 * timeline so the admin sees one unified thread. The Task-6 carry-over (c)
 * reconciliation runs here on the admin path: a `web-{client_id}`
 * conversation row carrying a stale source AND chat_id=0 gets a service
 * UPDATE to source='web' (guarded) and the action is reported back so the
 * unification approach stays documented and auditable.
 */

const unknownStr = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const unknownNum = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const uuidLike = (value: string): boolean =>
  /^[0-9a-fA-F-]{36}$/.test(value);

function reviewStatusFor(rows: ReviewFeedbackRow[], submissionId: string) {
  const row = rows.find((r) => r.submission_id === submissionId);
  if (!row) return "none" as const;
  return (["pending", "approved", "needs_work"] as const).includes(
    row.status as "pending"
  )
    ? (row.status as CheckinColumnRow["review_status"])
    : "none";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { ctx, error } = await assertStaff();
  if (error) return error;

  const clientId = params.id;
  if (!uuidLike(clientId)) {
    return NextResponse.json({ ok: false, error: "bad_id" }, { status: 400 });
  }

  if (ctx.demo) {
    return NextResponse.json(
      { ok: false, error: "demo_mode — drawer renders the demo store" },
      { status: 409 }
    );
  }

  if (!canAccessClient(ctx, clientId)) return scopeDenied();

  const service = createServiceClient();
  const webConversation = webConversationId(clientId);

  /* ------------------------------------------------------------ *
   * Client + subscriptions + ledger
   * ------------------------------------------------------------ */
  const clientRes = await service
    .from("clients")
    .select(
      "id, client_code, full_name, email, phone, telegram_user_id, telegram_chat_id, fitness_goal, training_location, training_days, experience_level, notes, package_id, status, onboarding_completed, created_at"
    )
    .eq("id", clientId)
    .single();

  if (clientRes.error || !clientRes.data) {
    console.error("[admin/client] client read failed", clientRes.error?.message);
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const client = clientRes.data as Record<string, unknown>;

  const [subsRes, eventsRes] = await Promise.all([
    service
      .from("client_subscriptions")
      .select("id, subscription_code, package_id, status, start_date, end_date")
      .eq("client_id", clientId)
      .order("start_date", { ascending: false }),
    service
      .from("subscription_events")
      .select("id, event_type, source, occurred_at, payload_reference")
      .eq("client_id", clientId)
      .order("occurred_at", { ascending: false })
      .limit(60),
  ]);

  /* ------------------------------------------------------------ *
   * Onboarding (latest request + its submission, if any)
   * ------------------------------------------------------------ */
  const reqRes = await service
    .from("onboarding_requests")
    .select("id, status, channel, sent_at, completed_at")
    .eq("client_id", clientId)
    .order("sent_at", { ascending: false })
    .limit(1);
  const latestRequest = reqRes.data?.[0] as Record<string, unknown> | undefined;

  const subRes = latestRequest
    ? await service
        .from("onboarding_submissions")
        .select("id, data, submitted_at")
        .eq("request_id", latestRequest.id as string)
        .order("submitted_at", { ascending: false })
        .limit(1)
    : null;
  const latestSubmission = subRes?.data?.[0] as Record<string, unknown> | undefined;

  /* ------------------------------------------------------------ *
   * Check-ins: requests (cadence) + submissions + reviews
   * ------------------------------------------------------------ */
  const [checkinRequestsRes, submissionsRes] = await Promise.all([
    service
      .from("checkin_requests")
      .select("id, period_label, period_start, period_end, status")
      .eq("client_id", clientId)
      .order("period_start", { ascending: false })
      .limit(60),
    service
      .from("checkin_submissions")
      .select(
        "id, request_id, client_id, weight_kg, measurements, training_days_made, workout_pct, nutrition_pct, energy, sleep, difficulties, feedback, photos, data, submitted_at"
      )
      .eq("client_id", clientId)
      .order("submitted_at", { ascending: false, nullsFirst: false })
      .limit(120),
  ]);

  const submissionRows = (submissionsRes.data ?? []) as Record<string, unknown>[];
  const submissionIds = submissionRows.map((s) => s.id as string);

  const reviewsRes = await service
    .from("checkin_reviews")
    .select("submission_id, status, feedback, updated_at")
    .in(
      "submission_id",
      submissionIds.length
        ? submissionIds
        : /* keep the query valid without an IN () */ [
            "00000000-0000-0000-0000-000000000000",
          ]
    );
  const feedback: ReviewFeedbackRow[] = ((reviewsRes.data ?? []) as Record<
    string,
    unknown
  >[]).map((r) => ({
    submission_id: r.submission_id as string,
    status: (r.status as string) ?? "pending",
    feedback: (r.feedback as string | null) ?? null,
    updated_at: (r.updated_at as string | null) ?? null,
    demo: false,
  }));

  const requests = (checkinRequestsRes.data ?? []) as Record<string, unknown>[];
  const requestById = new Map(
    requests.map((r) => [r.id as string, r])
  );

  const toColumnRow = (s: Record<string, unknown>): CheckinColumnRow => {
    const req = requestById.get(s.request_id as string) ?? null;
    return {
      submission_id: s.id as string,
      request_id: s.request_id as string,
      client_id: unknownStr(s.client_id),
      period_label: (req ? unknownStr(req.period_label) : null) ?? null,
      period_start: (req ? unknownStr(req.period_start) : null) ?? null,
      period_end: (req ? unknownStr(req.period_end) : null) ?? null,
      request_status: (req ? unknownStr(req.status) : null) ?? null,
      submitted_at: unknownStr(s.submitted_at),
      weight_kg: s.weight_kg == null ? null : Number(s.weight_kg),
      training_days_made: unknownNum(s.training_days_made),
      workout_pct: unknownNum(s.workout_pct),
      nutrition_pct: unknownNum(s.nutrition_pct),
      energy: unknownNum(s.energy),
      sleep: unknownNum(s.sleep),
      difficulties: unknownStr(s.difficulties),
      feedback: unknownStr(s.feedback),
      review_status: reviewStatusFor(feedback, s.id as string),
      demo: false,
    };
  };

  const allColumns = submissionRows.map(toColumnRow);
  const weekly = allColumns.filter((c) => c.period_label === "weekly");
  const monthly = allColumns.filter((c) => c.period_label === "monthly");

  /* ------------------------------------------------------------ *
   * Measurements history (checkin_submissions.measurements jsonb)
   * ------------------------------------------------------------ */
  const measurements = submissionRows
    .filter((s) => s.measurements != null)
    .map((s) => ({
      submission_id: s.id as string,
      submitted_at: unknownStr(s.submitted_at),
      measurements:
        typeof s.measurements === "object" && s.measurements !== null
          ? (s.measurements as Record<string, unknown>)
          : null,
      demo: false,
    }));

  /* ------------------------------------------------------------ *
   * Photos — signed URLs from the bucket the client owns
   * ------------------------------------------------------------ */
  const photoRows: AdminClientBundle["photos"] = [];
  for (const s of submissionRows) {
    const photos = Array.isArray(s.photos) ? s.photos : [];
    // Accept both bare object paths and {path|name|url} objects from the
    // (Task 8) submission writer; every candidate is validated below.
    const candidates = photos
      .map((raw) => {
        if (typeof raw === "string") return raw;
        if (raw && typeof raw === "object") {
          const rec = raw as Record<string, unknown>;
          return unknownStr(rec.path) ?? unknownStr(rec.name) ?? null;
        }
        return null;
      })
      .filter((v): v is string => Boolean(v))
      .slice(0, 12);
    for (const pathStr of candidates) {
      if (pathStr.includes("..")) continue;
      // Ownership validated against the row we already scope-checked: the
      // object path MUST live under this client's folder.
      const objectPath = pathStr.includes("/")
        ? pathStr
        : `${clientId}/${pathStr}`;
      if (!objectPath.startsWith(`${clientId}/`)) continue;
      let url: string | null = null;
      try {
        url = await createSignedPhotoUrl(objectPath);
      } catch {
        url = null;
      }
      photoRows.push({
        submission_id: s.id as string,
        submitted_at: unknownStr(s.submitted_at),
        url,
        path: objectPath,
        demo: false,
      });
    }
  }

  /* ------------------------------------------------------------ *
   * Conversations — pragmatic join: web thread + telegram threads
   * ------------------------------------------------------------ */
  // 1. Reconciliation (Task 6 carry-over (c), documented): a conversation
  //    row keyed `web-{client_id}` must be source='web' AND chat_id=0.
  let reconciliation: AdminClientBundle["reconciliation"] = null;
  const convRes = await service
    .from("chat_conversations")
    .select("conversation_id, source, chat_id")
    .eq("conversation_id", webConversation)
    .maybeSingle();
  const convRow = (convRes.data ?? null) as Record<string, unknown> | null;

  if (convRow) {
    const source = typeof convRow.source === "string" ? convRow.source : "";
    const chatId = unknownNum(convRow.chat_id);
    if (source !== "web") {
      if (chatId === 0) {
        const upd = await service
          .from("chat_conversations")
          .update({ source: "web" })
          .eq("conversation_id", webConversation)
          .eq("chat_id", 0);
        reconciliation = {
          conversation_id: webConversation,
          action: upd.error ? "left_alone" : "updated",
          detail: upd.error
            ? `reconciliation UPDATE failed: ${upd.error.message}`
            : "legacy web-{id} row carried a non-web source with chat_id=0 — service UPDATE applied to source='web'",
        };
      } else {
        reconciliation = {
          conversation_id: webConversation,
          action: "left_alone",
          detail: `web-{id}-shaped row is chat_id=${chatId} (not 0) — treated as telegram legacy and left untouched`,
        };
      }
    } else {
      reconciliation = {
        conversation_id: webConversation,
        action: "left_alone",
        detail: "already source='web' — no reconciliation needed",
      };
    }
  } else {
    reconciliation = {
      conversation_id: webConversation,
      action: "none",
      detail: "no chat_conversations row — created lazily on first reply",
    };
  }

  // 2. Telegram threads keyed by the client's chat ids.
  const telegramKeys = [client.telegram_chat_id, client.telegram_user_id]
    .filter((v): v is number => typeof v === "number")
    .map(String);
  const convByIdRes = telegramKeys.length
    ? await service
        .from("chat_conversations")
        .select("conversation_id, source, chat_id")
        .in("chat_id", telegramKeys.map(Number))
    : null;
  const telegramConversationIds = ((convByIdRes?.data ?? []) as Record<
    string,
    unknown
  >[])
    .map((r) => unknownStr(r.conversation_id))
    .filter((v): v is string => Boolean(v))
    // never re-include the web sentinel with itself
    .filter((v) => v !== webConversation);

  let messages: ConversationMessageRow[] = [];
  const messagesQuery = service
    .from("chat_messages")
    .select(
      "id, conversation_id, role, content, source, message_ts, intent"
    )
    .order("message_ts", { ascending: true, nullsFirst: false })
    .limit(200);

  if (telegramConversationIds.length) {
    const res = await messagesQuery.or(
      `conversation_id.eq.${webConversation},conversation_id.in.(${telegramConversationIds.join(
        ","
      )})`
    );
    messages = ((res.data ?? []) as Record<string, unknown>[]).map(
      (m) =>
        ({
          id: unknownStr(m.id) ?? "",
          conversation_id: unknownStr(m.conversation_id) ?? "",
          role: unknownStr(m.role) ?? "client",
          content: unknownStr(m.content) ?? "",
          source: unknownStr(m.source) ?? "telegram",
          message_ts: unknownStr(m.message_ts),
          intent: unknownStr(m.intent),
          demo: false,
        }) as ConversationMessageRow
    );
  } else {
    const res = await messagesQuery.eq("conversation_id", webConversation);
    messages = ((res.data ?? []) as Record<string, unknown>[]).map(
      (m) =>
        ({
          id: unknownStr(m.id) ?? "",
          conversation_id: unknownStr(m.conversation_id) ?? "",
          role: unknownStr(m.role) ?? "client",
          content: unknownStr(m.content) ?? "",
          source: unknownStr(m.source) ?? "web",
          message_ts: unknownStr(m.message_ts),
          intent: unknownStr(m.intent),
          demo: false,
        }) as ConversationMessageRow
    );
  }
  messages.sort(
    (a, b) => (a.message_ts ?? "").localeCompare(b.message_ts ?? "")
  );

  /* ------------------------------------------------------------ *
   * Payments + activity (integration_events, light read)
   * ------------------------------------------------------------ */
  const idFilter = `payload->>client_id.eq.${clientId}`;
  const emailFilter = client.email
    ? `,payload->>email.eq.${String(client.email)}`
    : "";
  const ledgerRes = await service
    .from("integration_events")
    .select("id, event_type, order_ref, status, created_at, payload")
    .or(`${idFilter}${emailFilter}`)
    .order("created_at", { ascending: false })
    .limit(50);

  const ledger = ((ledgerRes.data ?? []) as Record<string, unknown>[]).map(
    (r) => {
      const payload = (r.payload ?? {}) as Record<string, unknown>;
      return {
        id: unknownStr(r.id) ?? "",
        event_type: unknownStr(r.event_type) ?? "",
        order_ref: unknownStr(r.order_ref),
        status: unknownStr(r.status) ?? "",
        created_at: unknownStr(r.created_at) ?? "",
        summary:
          payload.order_id != null || payload.total != null
            ? JSON.stringify({ order_id: payload.order_id, total: payload.total })
            : null,
        demo: false,
      };
    }
  );

  const bundle: AdminClientBundle = {
    ok: true,
    demo: false,
    role: ctx.role,
    client: {
      id: clientId,
      client_code: unknownStr(client.client_code) ?? "",
      full_name: unknownStr(client.full_name) ?? "",
      email: unknownStr(client.email),
      phone: unknownStr(client.phone),
      telegram_user_id: unknownNum(client.telegram_user_id),
      telegram_chat_id: unknownNum(client.telegram_chat_id),
      fitness_goal: unknownStr(client.fitness_goal),
      training_location: unknownStr(client.training_location),
      training_days: unknownStr(client.training_days),
      experience_level: unknownStr(client.experience_level),
      notes: unknownStr(client.notes),
      package_id:
        client.package_id && typeof client.package_id === "string"
          ? client.package_id
          : null,
      status: unknownStr(client.status) ?? "unknown",
      onboarding_completed: client.onboarding_completed === true,
      created_at: unknownStr(client.created_at) ?? "",
      demo: false,
    },
    onboarding: {
      request: latestRequest
        ? {
            id: unknownStr(latestRequest.id) ?? "",
            status: unknownStr(latestRequest.status) ?? "",
            channel: unknownStr(latestRequest.channel) ?? "",
            sent_at: unknownStr(latestRequest.sent_at),
            completed_at: unknownStr(latestRequest.completed_at),
          }
        : null,
      submission: latestSubmission
        ? {
            id: unknownStr(latestSubmission.id) ?? "",
            submitted_at: unknownStr(latestSubmission.submitted_at),
            data:
              typeof latestSubmission.data === "object" &&
              latestSubmission.data !== null
                ? (latestSubmission.data as Record<string, unknown>)
                : null,
          }
        : null,
      demo: false,
    },
    subscriptions: ((subsRes.data ?? []) as Record<string, unknown>[]).map(
      (s) => ({
        id: unknownStr(s.id) ?? "",
        subscription_code: unknownStr(s.subscription_code) ?? "",
        package_id:
          typeof s.package_id === "string" ? (s.package_id as string) : "",
        status: unknownStr(s.status) ?? "",
        start_date: unknownStr(s.start_date) ?? "",
        end_date: unknownStr(s.end_date) ?? "",
        demo: false,
      })
    ),
    timeline: ((eventsRes.data ?? []) as Record<string, unknown>[]).map((e) => ({
      id: unknownStr(e.id) ?? "",
      event_type: unknownStr(e.event_type) ?? "",
      source: unknownStr(e.source) ?? "",
      occurred_at: unknownStr(e.occurred_at) ?? "",
      payload_reference: unknownStr(e.payload_reference),
      demo: false,
    })),
    weekly,
    monthly,
    measurements,
    photos: photoRows,
    messages,
    web_conversation_id: webConversation,
    feedback,
    payments: ledger.filter((r) => r.order_ref && r.event_type.startsWith("order.")),
    activity: ledger,
    reconciliation,
  };

  return NextResponse.json(bundle);
}
