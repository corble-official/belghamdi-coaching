import "server-only";

import { isDemoMode } from "@/lib/mode";
import type { PortalContext } from "./portal-context";
import { createPortalClient } from "./supabase-auth";
import {
  DEMO_CHAT_CONVERSATION_ID,
  demoChatThread,
} from "@/lib/demo/portal-chat";

/**
 * Portal coach chat — BC-06 conversation as seen by the CLIENT portal.
 *
 * Live-data contract (Task 6 brief, binding):
 * - Web conversation identity is EXACTLY `conversation_id = 'web-{client_id}'`,
 *   `source='web'`, `chat_id=0` — ONE persistent conversation per client.
 * - ALL reads/writes run through the USER-JWT client (createPortalClient);
 *   the service client is NEVER used here. RLS
 *   (`bc_can_read_conversation` SELECT policies + the
 *   `bc_chat_messages_insert_client` INSERT policy) is the second guard.
 * - Telegram rows are history that renders in the SAME thread (badge) —
 *   the portal never writes them and never talks to Telegram/n8n.
 *
 * Demo path: zero Supabase/network — the simulated thread comes from
 * src/lib/demo/portal-chat.ts (in-memory, demo-flagged rows).
 */

export type PortalChatMessage = {
  id: string;
  role: "client" | "coach";
  content: string;
  /** "web" rows are portal writes; anything else is telegram history. */
  source: string;
  message_ts: string | null;
  intent: string | null;
};

export type PortalChatState = {
  demo: boolean;
  /**
   * The caller's OWN conversation id (server-derived). Null when the
   * authenticated user has no linked client record — nothing is readable.
   */
  conversation_id: string | null;
  messages: PortalChatMessage[];
};

/** The binding web-conversation identity. Callers NEVER supply client ids. */
export const webConversationId = (clientId: string): string => `web-${clientId}`;

const MESSAGE_COLUMNS = "id, role, content, source, message_ts, intent";

/**
 * Read window for one page render: last 200 rows, then flipped back to
 * ascending order (`message_ts asc`, brief) without unbounded reads.
 */
const READ_WINDOW = 200;

/** Nil-safe row normalizer — telegram-legacy rows may miss source/role nuance. */
export function normalizeChatMessage(
  row: Record<string, unknown>
): PortalChatMessage {
  return {
    id: typeof row.id === "string" ? row.id : "",
    role: row.role === "coach" ? "coach" : "client",
    content: typeof row.content === "string" ? row.content : "",
    source: typeof row.source === "string" ? row.source : "web",
    message_ts: typeof row.message_ts === "string" ? row.message_ts : null,
    intent: typeof row.intent === "string" ? row.intent : null,
  };
}

export async function getPortalChatState(
  ctx: PortalContext
): Promise<PortalChatState> {
  // ---- Demo path (before any client construction): simulated thread ----
  if (isDemoMode()) {
    return {
      demo: true,
      conversation_id: DEMO_CHAT_CONVERSATION_ID,
      messages: demoChatThread(),
    };
  }

  // ---- Unreachable-at-runtime narrowing (callers redirect first) ----
  if (ctx.demo || !ctx.authed) {
    return { demo: false, conversation_id: null, messages: [] };
  }

  const clientId = ctx.client.id;
  if (!clientId) {
    return { demo: false, conversation_id: null, messages: [] };
  }

  // ---- Live path: USER-JWT read, RLS backstop ----
  const supabase = await createPortalClient();
  // Session-derived id — never a value from a request body/param.
  const conversationId = webConversationId(clientId);

  const res = await supabase
    .from("chat_messages")
    .select(MESSAGE_COLUMNS)
    .eq("conversation_id", conversationId)
    .order("message_ts", { ascending: false, nullsFirst: false })
    // Tiebreaker: same-`message_ts` rows keep a deterministic order by id.
    .order("id", { ascending: false })
    .limit(READ_WINDOW);

  const rows = (res.data ?? []) as Record<string, unknown>[];

  return {
    demo: false,
    conversation_id: conversationId,
    messages: rows.map(normalizeChatMessage).reverse(),
  };
}
