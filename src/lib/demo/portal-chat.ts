/**
 * Demo-mode simulated portal chat (follow-up tunnel).
 *
 * In-memory only — module-scope store living as long as the dev server.
 * ZERO Supabase/network by design (isDemoMode() guards every caller).
 * Every row is flagged `demo: true` so demo data stays distinguishable
 * from real client data (house rule from src/lib/demo/admin-store.ts).
 *
 * The seed includes a telegram-source coach row so the unified-thread
 * channel badge is visible without any real integration.
 */
import type { PortalChatMessage } from "@/lib/supabase/portal-chat";

/** Sentinel identity — mirrors portal-context's DEMO_CLIENT.id. */
export const DEMO_CHAT_CONVERSATION_ID = "web-demo-client-id";

const minutesAgo = (n: number) =>
  new Date(Date.now() - n * 60000).toISOString();

const seed: PortalChatMessage[] = [
  {
    id: "demo-msg-1",
    role: "client",
    content: "السلام عليكم كابتن، الخطة وصلت وبدأت اليوم.",
    source: "web",
    message_ts: minutesAgo(27 * 60),
    intent: null,
  },
  {
    id: "demo-msg-2",
    role: "coach",
    content: "وعليكم السلام! تمام، ابعتلي أرقامك بعد أول جلسة وأنا أظبط الأوزان.",
    source: "telegram",
    message_ts: minutesAgo(26.5 * 60),
    intent: "plan_adjustment",
  },
  {
    id: "demo-msg-3",
    role: "coach",
    content: "وفي أي وقت لو عندك سؤال — اكتبه هنا وبنرد أول بأول.",
    source: "web",
    message_ts: minutesAgo(26 * 60),
    intent: null,
  },
  {
    id: "demo-msg-4",
    role: "client",
    content: "تمام كابتن، متشكر.",
    source: "web",
    message_ts: minutesAgo(25 * 60),
    intent: null,
  },
];

const CANNED_REPLIES: string[] = [
  "وصلت رسالتك — بتابعها وأرد عليك بأقرب وقت.",
  "تمام، سجلتها. لو محتاج أي تعديل في الخطة اكتبه هنا.",
  "اتفقنا. خلي بالك من الأداء قبل الزيادة في الوزن.",
  "تم — وبعد تمرين بكرة ابعتلي الإحساس والوزن نفسه.",
];

type DemoChatStore = {
  messages: PortalChatMessage[];
  seq: number;
  replyCursor: number;
};

const store: DemoChatStore = {
  messages: seed.map((m) => ({ ...m, demo: true })),
  seq: 0,
  replyCursor: 0,
};

/** Current simulated thread (snapshot copy). */
export function demoChatThread(): PortalChatMessage[] {
  return store.messages.map((m) => ({ ...m }));
}

/**
 * Simulated POST: append the client message, then the canned coach reply
 * straight after (the demo "tunnel" answers instantly; the UI poll picks
 * both up on the next 8s cycle or the immediate refetch).
 * Returns only the NEW rows so the route can answer with just the delta.
 */
export function demoChatPost(content: string): PortalChatMessage[] {
  store.seq += 1;
  const clientMsg: PortalChatMessage & { demo: true } = {
    id: `demo-web-${Date.now()}-${store.seq}`,
    role: "client",
    content,
    source: "web",
    message_ts: new Date().toISOString(),
    intent: null,
    demo: true,
  };
  const reply: PortalChatMessage & { demo: true } = {
    id: `demo-coach-${Date.now()}-${store.seq}`,
    role: "coach",
    content: CANNED_REPLIES[store.replyCursor % CANNED_REPLIES.length],
    source: "web",
    message_ts: new Date().toISOString(),
    intent: null,
    demo: true,
  };
  store.replyCursor += 1;
  store.messages.push(clientMsg, reply);
  return [clientMsg, reply];
}
