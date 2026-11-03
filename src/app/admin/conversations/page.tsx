"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageSquare, Send } from "lucide-react";

import type { ConversationMessageRow } from "@/lib/admin/types";
import {
  demoConversationFor,
  demoConversationPost,
} from "@/lib/demo/admin-crm";
import { useAdminStore } from "@/lib/demo/admin-store";
import { isDemoMode } from "@/lib/mode";

/**
 * Unified chat per client (Task 7 #4, LTR admin).
 *
 * Demo path: client list from the demo store, thread from the in-memory
 * demo module (telegram+web unified), reply simulated locally with the
 * pinned role='coach' / source='web' semantics. Zero network.
 *
 * Live path: GET /api/admin/conversations lists the latest message per
 * client (web sentinel + telegram-keyed threads merged service-side);
 * selecting a client loads its merged thread via ?client_id=; replies POST
 * to the same route — the route pins role='coach', so the UI never sends a
 * role. Role is taken from the API answer (admin legacy → 'admin').
 */

type ThreadSummary = {
  client_id: string;
  client_code: string;
  client_name: string;
  telegram_conversation_id: string | null;
  last_message: string | null;
  last_ts: string | null;
  last_source: string | null;
  demo?: boolean;
};

export default function AdminConversationsPage() {
  const demo = useMemo(() => isDemoMode(), []);
  const storeClients = useAdminStore((s) => s.clients);

  const [role, setRole] = useState<"admin" | "coach" | "coach_assistant" | null>(
    demo ? "admin" : null
  );
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<ConversationMessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const demoClients = useMemo(
    () =>
      storeClients.map((c) => {
        const msgs = demoConversationFor(c.id);
        const last = msgs[msgs.length - 1];
        return {
          client_id: c.id,
          client_code: c.id,
          client_name: c.name,
          telegram_conversation_id: null,
          last_message: last?.content ?? null,
          last_ts: last?.message_ts ?? null,
          last_source: last?.source ?? null,
          demo: true,
        } satisfies ThreadSummary;
      }),
    [storeClients]
  );

  const loadThread = useCallback(
    async (clientId: string) => {
      setError(null);
      if (demo) {
        setThread(demoConversationFor(clientId));
        return;
      }
      const res = await fetch(`/api/admin/conversations?client_id=${clientId}`);
      const data = (await res.json()) as {
        ok?: boolean;
        thread?: ConversationMessageRow[];
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        setThread([]);
        return;
      }
      setThread(data.thread ?? []);
    },
    [demo]
  );

  useEffect(() => {
    if (demo) return;
    (async () => {
      const res = await fetch("/api/admin/conversations");
      const data = (await res.json()) as {
        ok?: boolean;
        role?: "admin" | "coach" | "coach_assistant" | null;
        threads?: ThreadSummary[];
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setRole(data.role ?? null);
      setThreads(data.threads ?? []);
      setSelectedId(data.threads?.[0]?.client_id ?? null);
    })().catch((e) => setError(String(e)));
  }, [demo]);

  useEffect(() => {
    if (selectedId) void loadThread(selectedId);
  }, [selectedId, loadThread]);

  const summaries = demo ? demoClients : threads;
  const selected = summaries.find((t) => t.client_id === selectedId) ?? null;

  const send = async () => {
    const content = draft.trim();
    if (!content || !selectedId) return;
    if (demo) {
      demoConversationPost(selectedId, content);
      setDraft("");
      setThread(demoConversationFor(selectedId));
      return;
    }
    const res = await fetch("/api/admin/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: selectedId, content }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      role?: string;
    };
    if (!res.ok || !data.ok) {
      setError(data.error ?? `HTTP ${res.status}${data.role ? ` (${data.role})` : ""}`);
      return;
    }
    setDraft("");
    await loadThread(selectedId);
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <MessageSquare className="h-5 w-5 text-copper" />
        <h1 className="font-display font-bold text-3xl text-bone">Conversations</h1>
      </div>
      <p className="text-sm text-wgray mt-1 mb-6">
        Unified web + telegram threads per client{" "}
        {demo
          ? "— demo threads, simulated replies"
          : "— replies are sent as the coach (role pinned server-side)"}
      </p>

      {error && (
        <p className="text-sm text-red-300 border border-red-400/30 bg-red-500/10 px-4 py-3 mb-4">
          {error}
        </p>
      )}

      <div className="grid lg:grid-cols-[320px_1fr] gap-6">
        {/* client list */}
        <div className="card-surface divide-y divide-wgray-dim/40 max-h-[70vh] overflow-y-auto">
          {summaries.length === 0 ? (
            <p className="text-sm text-wgray-dim p-6">No clients in scope.</p>
          ) : (
            summaries.map((t) => (
              <button
                key={t.client_id}
                onClick={() => setSelectedId(t.client_id)}
                className={`w-full text-left px-4 py-3 transition-colors ${
                  selectedId === t.client_id
                    ? "bg-copper/10 text-copper"
                    : "hover:bg-surface/60 text-bone"
                }`}
              >
                <p className="text-sm font-medium">{t.client_name}</p>
                <p className="text-xs text-wgray-dim mt-0.5">
                  {t.client_code}
                  {t.last_source && t.last_source !== "web" ? ` · ${t.last_source}` : ""}
                </p>
                {t.last_message && (
                  <p className="text-xs text-wgray mt-1 truncate">{t.last_message}</p>
                )}
              </button>
            ))
          )}
        </div>

        {/* thread pane */}
        <div className="card-surface flex flex-col max-h-[70vh]">
          <div className="px-4 py-3 border-b border-wgray-dim/40 flex items-center justify-between">
            <p className="text-sm text-bone font-medium">
              {selected?.client_name ?? "Select a client"}
            </p>
            {!demo && selected && (
              <div className="text-[10px] uppercase tracking-widest text-wgray-dim">
                web + telegram merged
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {thread.length === 0 ? (
              <p className="text-sm text-wgray-dim text-center py-12">
                No messages in this client's threads yet.
              </p>
            ) : (
              thread.map((m) => (
                <div
                  key={`${m.id}-${m.message_ts ?? ""}`}
                  className={`flex ${m.role === "coach" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] px-4 py-2.5 text-sm ${
                      m.role === "coach"
                        ? "bg-copper/15 text-bone border border-copper/30"
                        : "bg-surface text-bone border border-wgray-dim/40"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    <p className="text-[10px] text-wgray-dim mt-1 uppercase tracking-widest">
                      {m.source}
                      {m.message_ts
                        ? ` · ${new Date(m.message_ts).toLocaleString()}`
                        : ""}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="p-4 border-t border-wgray-dim/40 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={
                role === "coach_assistant"
                  ? "Assistants are view-only for threads"
                  : "Reply as coach (web)..."
              }
              disabled={role === "coach_assistant"}
              className="input-dark flex-1"
              aria-label="Reply message"
            />
            <button
              onClick={() => void send()}
              disabled={!draft.trim() || role === "coach_assistant"}
              className="btn-primary !px-4 !py-2 disabled:opacity-40"
              aria-label="Send reply"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
