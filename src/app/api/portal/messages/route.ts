import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/mode";
import { getPortalContext } from "@/lib/supabase/portal-context";
import { createPortalClient } from "@/lib/supabase/supabase-auth";
import {
  getPortalChatState,
  normalizeChatMessage,
  webConversationId,
} from "@/lib/supabase/portal-chat";
import {
  DEMO_CHAT_CONVERSATION_ID,
  demoChatPost,
} from "@/lib/demo/portal-chat";

/**
 * Portal follow-up chat — `/api/portal/messages` (client side of BC-06).
 *
 * GET  → the caller's OWN conversation (`web-{client_id}`) messages ordered
 *        `message_ts asc`, unified across web + telegram-source rows.
 * POST → appends ONE `chat_messages` row with role='client', source='web'
 *        through the USER-JWT client (RLS backstop). The sentinel
 *        conversation row is ensured first (on-conflict-do-nothing via JWT).
 *
 * Hard rules (binding):
 *  - Conversation identity is derived SERVER-SIDE from the session
 *    (`ctx.client.id` → `web-{id}`). Any `?conversation_id=` / body
 *    conversation id that is not the caller's own → 403, zero rows.
 *  - `role` (or any other field) in the POST body is NEVER read: the server
 *    pins role='client' + source='web', so a body `{"role":"coach"}` spoof
 *    cannot produce a coach row (RLS would also reject it).
 *  - NO Telegram/n8n/deliver() calls — BC-06 owns Telegram; the portal only
 *    writes web-source rows.
 *  - Zero Supabase/network in demo mode.
 */

/** Content window: 1..2000 chars after trim (brief). */
const MAX_CONTENT = 2000;

const forbidden = () =>
  NextResponse.json({ error: "conversation_forbidden" }, { status: 403 });

/* ------------------------------------------------------------------ GET */

export async function GET(req: Request) {
  const ctx = await getPortalContext();

  if (!ctx.demo && !ctx.authed) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const requested = new URL(req.url).searchParams.get("conversation_id");

  /* ---- Demo: simulated thread, zero Supabase (foreign ids still 403) ---- */
  if (isDemoMode()) {
    if (requested && requested !== DEMO_CHAT_CONVERSATION_ID) {
      return forbidden();
    }
    const state = await getPortalChatState(ctx);
    return NextResponse.json({ ok: true, ...state, read_only: false });
  }

  // Narrowing only: anonymous callers were rejected above and the demo path
  // returned already, so this branch is unreachable at runtime.
  if (ctx.demo || !ctx.authed) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const clientId = ctx.client.id;
  if (!clientId) {
    // No linked client record → no own conversation exists at all.
    return NextResponse.json({ error: "no_linked_client" }, { status: 403 });
  }

  const own = webConversationId(clientId);

  // Ownership: ONLY the session-derived id is ever readable. A crafted
  // foreign conversation_id (another client's thread) → 403 and the query
  // below never runs.
  if (requested && requested !== own) {
    return forbidden();
  }

  const ent = ctx.entitlements;
  // Gating: full subscribers read + write; history-only (expired) clients
  // keep READ-ONLY access to their thread; suspended/revoked get neither.
  const historyReadonly =
    ent.checkin_history_readonly || ent.coach_feedback_readonly;

  if (!ent.coach_chat && !historyReadonly) {
    return NextResponse.json({ error: "feature_locked" }, { status: 403 });
  }

  const state = await getPortalChatState(ctx);

  return NextResponse.json({
    ok: true,
    conversation_id: own,
    messages: state.messages,
    read_only: !ent.coach_chat,
  });
}

/* ----------------------------------------------------------------- POST */

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const ctx = await getPortalContext();
  if (!ctx.demo && !ctx.authed) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ONLY `content` is read. `role`, `source`, `conversation_id` and any
  // other key in the body are ignored entirely — the server pins
  // role='client' + source='web' and derives the conversation from the
  // session, so a spoofed body cannot touch either.
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "content_required" }, { status: 400 });
  }
  if (content.length > MAX_CONTENT) {
    return NextResponse.json({ error: "content_too_long" }, { status: 400 });
  }

  /* ---- Demo: simulated append + canned reply, zero Supabase ---- */
  if (isDemoMode()) {
    const messages = demoChatPost(content);
    return NextResponse.json({
      ok: true,
      demo: true,
      conversation_id: DEMO_CHAT_CONVERSATION_ID,
      messages,
    });
  }

  // Narrowing only (anonymous + demo handled above).
  if (ctx.demo || !ctx.authed) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const clientId = ctx.client.id;
  if (!clientId) {
    return NextResponse.json({ error: "no_linked_client" }, { status: 403 });
  }

  if (!ctx.entitlements.coach_chat) {
    return NextResponse.json({ error: "feature_locked" }, { status: 403 });
  }

  const supabase = await createPortalClient();
  const conversationId = webConversationId(clientId);

  // Ensure the own sentinel conversation exists (RLS
  // `bc_chat_conversations_insert_client` allows EXACTLY this row:
  // source='web', chat_id=0, id = 'web-' || my client id). Existing rows
  // are a no-op (ignoreDuplicates), so the first portal message
  // self-provisions the thread.
  const conv = await supabase
    .from("chat_conversations")
    .upsert(
      { conversation_id: conversationId, source: "web", chat_id: 0 },
      { onConflict: "conversation_id", ignoreDuplicates: true }
    );

  if (conv.error) {
    return NextResponse.json({ error: "conversation_rejected" }, { status: 403 });
  }

  // USER-JWT INSERT — RLS `bc_chat_messages_insert_client` enforces
  // role='client' AND source='web' AND own conversation at the DB level.
  // `message_ts` is pinned server-side so web rows interleave in the
  // unified `message_ts asc` thread instead of sinking to the nulls tail.
  const insertRes = await supabase
    .from("chat_messages")
    .insert({
      conversation_id: conversationId,
      role: "client",
      source: "web",
      content,
      message_ts: new Date().toISOString(),
    })
    .select("id, role, content, source, message_ts, intent")
    .single();

  if (insertRes.error || !insertRes.data) {
    return NextResponse.json({ error: "message_rejected" }, { status: 403 });
  }

  return NextResponse.json({
    ok: true,
    conversation_id: conversationId,
    message: normalizeChatMessage(insertRes.data as Record<string, unknown>),
  });
}
