import { NextResponse, type NextRequest } from "next/server";

import type { ConversationMessageRow } from "@/lib/admin/types";
import { assertStaff, canAccessClient, scopeDenied } from "@/lib/supabase/admin-context";
import { createServiceClient } from "@/lib/supabase/supabase-service";
import { webConversationId } from "@/lib/supabase/portal-chat";

const uuidLike = (value: string): boolean =>
  /^[0-9a-fA-F-]{36}$/.test(value);

const unknownStr = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

/**
 * GET  /api/admin/conversations[?client_id=<uuid>]
 *      — unified (web + telegram) chat list/thread for staff. Admin sees
 *        all clients; coach/assistant scope-filtered. When `client_id` is
 *        present the route answers with that client's merged thread.
 *
 * POST /api/admin/conversations  { client_id, content }
 *      — coach/admin reply. The row is written role='coach' source='web'
 *        into the client's `web-{client_id}` thread. The role value is
 *        PINNED SERVER-SIDE — request bodies can never set it.
 *        DEVIATION (documented): no RLS policy currently allows
 *        role='coach' INSERTs from a JWT; the reply is intentionally routed
 *        through the validated admin route's service client AFTER
 *        route-level staff auth. The follow-up migration
 *        `supabase/migrations/004_coach_chat_policy.sql` (written in this
 *        task, NOT applied — the controller applies it) adds the strict
 *        parity policy: bc_chat_messages_insert_coach for authenticated
 *        coaches whose can_access_client() matches the conversation.
 *        In demo mode the reply is simulated in-memory (admin-crm module).
 */

const CLIENT_COLS =
  "id, client_code, full_name, telegram_chat_id, telegram_user_id, created_at";

type ClientRow = {
  id: string;
  client_code: string | null;
  full_name: string | null;
  telegram_chat_id: number | null;
  telegram_user_id: number | null;
};

export async function GET(req: NextRequest) {
  const { ctx, error } = await assertStaff();
  if (error) return error;
  if (ctx.demo) {
    return NextResponse.json({
      ok: true,
      demo: true,
      role: ctx.role,
      threads: [],
      thread: null,
    });
  }

  const service = createServiceClient();

  const scopedIds = ctx.assignedClientIds;
  if (scopedIds !== null && scopedIds.length === 0) {
    return NextResponse.json({ ok: true, demo: false, role: ctx.role, threads: [], thread: null });
  }

  const requestedId = req.nextUrl.searchParams.get("client_id");

  // ---- Single-thread mode (used by the drawer/conversations reply pane) ----
  if (requestedId) {
    if (!uuidLike(requestedId)) {
      return NextResponse.json({ ok: false, error: "bad_id" }, { status: 400 });
    }
    if (!canAccessClient(ctx, requestedId)) return scopeDenied();

    // telegram linkage (pragmatic join — chat_id-keyed conversations)
    const clientRes = await service
      .from("clients")
      .select("telegram_chat_id, telegram_user_id")
      .eq("id", requestedId)
      .single();
    if (clientRes.error || !clientRes.data) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    const keys = [clientRes.data.telegram_chat_id, clientRes.data.telegram_user_id]
      .filter((v): v is number => typeof v === "number");
    const convRes = keys.length
      ? await service
          .from("chat_conversations")
          .select("conversation_id")
          .in("chat_id", keys)
      : null;
    const telegramIds = ((convRes?.data ?? []) as { conversation_id: string }[])
      .map((r) => r.conversation_id)
      .filter((v) => v !== webConversationId(requestedId));

    const webId = webConversationId(requestedId);
    const msgRes = await service
      .from("chat_messages")
      .select("id, conversation_id, role, content, source, message_ts, intent")
      .or(
        telegramIds.length
          ? `conversation_id.eq.${webId},conversation_id.in.(${telegramIds.join(",")})`
          : `conversation_id.eq.${webId}`
      )
      .order("message_ts", { ascending: true, nullsFirst: false })
      .limit(200);

    const thread: ConversationMessageRow[] = ((msgRes.data ?? []) as Record<
      string,
      unknown
    >[]).map((m) => ({
      id: unknownStr(m.id) ?? "",
      conversation_id: unknownStr(m.conversation_id) ?? "",
      role: unknownStr(m.role) ?? "client",
      content: unknownStr(m.content) ?? "",
      source: unknownStr(m.source) ?? "telegram",
      message_ts: unknownStr(m.message_ts),
      intent: unknownStr(m.intent),
      demo: false,
    }));

    return NextResponse.json({ ok: true, demo: false, role: ctx.role, thread });
  }

  // ---- List mode: latest message per client ----
  // Pragmatic join: (a) web threads are keyed `web-{client_id}`; (b) telegram
  // threads are `telegram:<chat_id>`-keyed and resolved through
  // chat_conversations.chat_id mapping. Both reads are service-path
  // (admin-consented, post-gate) and merged per client below.
  const clientsQuery = service
    .from("clients")
    .select(CLIENT_COLS)
    .order("created_at", { ascending: false });
  if (scopedIds !== null) clientsQuery.in("id", scopedIds);
  const clientsRes = await clientsQuery;
  if (clientsRes.error) {
    console.error("[admin/conversations] clients read failed", clientsRes.error.message);
    return NextResponse.json({ ok: false, error: "db_read_failed" }, { status: 502 });
  }
  const clients = clientsRes.data as ClientRow[];

  const chatIds = clients
    .map((c) => c.telegram_chat_id)
    .filter((v): v is number => typeof v === "number");

  const convMapRes = chatIds.length
    ? await service
        .from("chat_conversations")
        .select("conversation_id, chat_id")
        .in("chat_id", chatIds)
    : null;

  const [webMsgRes] = await Promise.all([
    service
      .from("chat_messages")
      .select("id, conversation_id, role, content, source, message_ts")
      .ilike("conversation_id", "web-%")
      .order("message_ts", { ascending: false, nullsFirst: false })
      .limit(400),
  ]);

  const webMessages = (webMsgRes.data ?? []) as Record<string, unknown>[];
  const chatIdToConvId = new Map<string, string>();
  for (const r of ((convMapRes?.data ?? []) as Record<string, unknown>[])) {
    const convId = unknownStr(r.conversation_id);
    const chatIdRaw = r.chat_id;
    const chatId =
      typeof chatIdRaw === "number"
        ? String(chatIdRaw)
        : unknownStr(chatIdRaw);
    if (convId && chatId) chatIdToConvId.set(chatId, convId);
  }

  // Chat-id → conversation-id map is used both directions below.
  const convIdToChatId = new Map(
    Array.from(chatIdToConvId.entries()).map(([chatId, convId]) => [convId, chatId])
  );

  // telegram conversation ids (deduped) → merge their messages
  const tgConvIds = Array.from(new Set(chatIdToConvId.values())).filter(
    (v) => !v.startsWith("web-")
  );
  const telegramMessages: Record<string, unknown>[] = tgConvIds.length
    ? await service
        .from("chat_messages")
        .select("id, conversation_id, role, content, source, message_ts")
        .in("conversation_id", tgConvIds)
        .order("message_ts", { ascending: false, nullsFirst: false })
        .limit(400)
        .then((r) => (r.data ?? []) as Record<string, unknown>[])
    : [];

  const threads = clients.map((c) => {
    const webId = webConversationId(c.id);
    const convIdForClient = c.telegram_chat_id
      ? chatIdToConvId.get(String(c.telegram_chat_id)) ?? null
      : null;
    const webLast = webMessages.find(
      (m) => unknownStr(m.conversation_id) === webId
    );
    const tgLast = convIdForClient
      ? telegramMessages.find(
          (m) => unknownStr(m.conversation_id) === convIdForClient
        )
      : undefined;

    const webTs = unknownStr(webLast?.message_ts) ?? "";
    const tgTs = unknownStr(tgLast?.message_ts) ?? "";
    const pick = tgTs > webTs ? tgLast : webLast;

    return {
      client_id: c.id,
      client_code: c.client_code ?? "",
      client_name: c.full_name ?? "",
      telegram_chat_id: c.telegram_chat_id ?? null,
      telegram_conversation_id: convIdForClient,
      last_message: unknownStr(pick?.content) ?? null,
      last_ts: unknownStr(pick?.message_ts),
      last_source: pick
        ? (unknownStr(pick.source) ?? (pick === webLast ? "web" : "telegram"))
        : null,
      /** all unified conversation ids for this client (drawer joins these) */
      conversation_ids: [webId, ...(convIdForClient ? [convIdForClient] : [])],
      linked_via_chat_id: convIdForClient
        ? convIdToChatId.get(convIdForClient) ?? null
        : null,
    };
  });

  return NextResponse.json({ ok: true, demo: false, role: ctx.role, threads });
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await assertStaff();
  if (error) return error;

  const body = (await req.json().catch(() => null)) as {
    client_id?: string;
    content?: string;
  } | null;

  if (
    !body ||
    typeof body.client_id !== "string" ||
    !uuidLike(body.client_id) ||
    typeof body.content !== "string" ||
    body.content.trim().length === 0
  ) {
    return NextResponse.json({ ok: false, error: "bad_body" }, { status: 400 });
  }
  const content = body.content.trim().slice(0, 4000);

  if (!canAccessClient(ctx, body.client_id)) return scopeDenied();

  const webId = webConversationId(body.client_id);

  if (ctx.demo) {
    // Simulated reply handled by the page via the demo module; the route
    // still answers in the same shape so the UI keeps one code path.
    return NextResponse.json({
      ok: true,
      simulated: true,
      conversation_id: webId,
      role: "coach",
      source: "web",
    });
  }

  const service = createServiceClient();

  // Lazy-create the persistent web conversation row (Task 6 identity).
  const convIns = await service
    .from("chat_conversations")
    .upsert(
      { conversation_id: webId, source: "web", chat_id: 0 },
      { onConflict: "conversation_id", ignoreDuplicates: true }
    );
  if (convIns.error) {
    console.error("[admin/conversations] upsert failed", convIns.error.message);
    return NextResponse.json({ ok: false, error: "db_write_failed" }, { status: 502 });
  }

  const msgRes = await service.from("chat_messages").insert({
    conversation_id: webId,
    role: "coach", // PINNED server-side — never taken from the request body
    content,
    source: "web",
    message_ts: new Date().toISOString(),
  });
  if (msgRes.error) {
    console.error("[admin/conversations] message write failed", msgRes.error.message);
    return NextResponse.json({ ok: false, error: "db_write_failed" }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    simulated: false,
    conversation_id: webId,
    role: "coach",
    source: "web",
  });
}
