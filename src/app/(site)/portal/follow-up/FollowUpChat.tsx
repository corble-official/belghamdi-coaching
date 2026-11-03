"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  CircleAlert,
  History,
  Lock,
  MessageSquare,
  RefreshCcw,
  Send,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Reveal } from "@/components/ui/Reveal";

/**
 * Follow-up chat — one unified thread for BC-06: the client's own web
 * messages AND the coach's telegram history rows render together, with a
 * channel badge on telegram rows (history, rendered read-only).
 *
 * - Polls GET /api/portal/messages every 8s; messages are the source of
 *   truth from the server (no local echo ledger).
 * - Optimistic send: a temp client bubble renders while POST is in flight,
 *   replaced by the polled/refreshed server truth on success; removed with
 *   an inline (i18n) error on failure. No n8n/Telegram calls anywhere.
 * - Gating modes (server-page derived):
 *   `full` → composer on; `readonly` → history-only expired thread with the
 *   composer disabled + banner; `locked` → chat blocked card + renewal CTA.
 * - RTL/Arabic follows the language context; the demo chip matches the
 *   portal shell tokens (chip / card-surface / btn-primary / eyebrow).
 */

type ChatMessage = {
  id: string;
  role: "client" | "coach";
  content: string;
  source: string;
  message_ts: string | null;
  demo?: boolean;
};

type Mode = "full" | "readonly" | "locked";

type TFn = ReturnType<typeof useI18n>["t"];
type TKey = Parameters<TFn>[0];
type ErrorKey =
  | "followup_error_required"
  | "followup_error_too_long"
  | "followup_error_locked"
  | "followup_error_generic";

const POLL_MS = 8000;
const MAX_LEN = 2000;

const mapApiError = (code: unknown): ErrorKey =>
  code === "content_required"
    ? "followup_error_required"
    : code === "content_too_long"
      ? "followup_error_too_long"
      : code === "feature_locked"
        ? "followup_error_locked"
        : "followup_error_generic";

export default function FollowUpChat({
  demo,
  mode,
  clientName,
}: {
  demo: boolean;
  mode: Mode;
  /** Session client name — only shown in the locked variant header. */
  clientName: string;
}) {
  const { t, lang } = useI18n();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<ErrorKey | null>(null);
  const busyRef = useRef(false);
  const threadRef = useRef<HTMLDivElement | null>(null);
  // Stick to the newest message ONLY while the user is already reading the
  // bottom — scrolling up to read history never gets yanked by the 8s poll.
  const stickBottomRef = useRef(true);

  const adopt = useCallback((rows: unknown): void => {
    if (!Array.isArray(rows)) return;
    setMessages(
      rows
        .filter(
          (row): row is ChatMessage =>
            typeof row === "object" &&
            row !== null &&
            typeof (row as ChatMessage).content === "string" &&
            (row as ChatMessage).content.trim() !== ""
        )
        .map((row) => ({
          ...row,
          role: row.role === "coach" ? "coach" : "client",
          source: typeof row.source === "string" ? row.source : "web",
          message_ts:
            typeof row.message_ts === "string" ? row.message_ts : null,
        }))
    );
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/api/portal/messages", { cache: "no-store" });
      if (!res.ok) return; // keep last state; errors surface on send
      const data = (await res.json().catch(() => ({}))) as {
        messages?: unknown;
      };
      adopt(data.messages);
    } catch {
      // Transient network error mid-poll — next cycle retries.
    }
  }, [adopt]);

  /* 8s polling; paused in the locked surface (the API would 403) and while
     a send is in flight (never clobber the optimistic bubble). */
  useEffect(() => {
    if (mode === "locked") return;

    let cancelled = false;
    const tick = async () => {
      if (cancelled || busyRef.current) return;
      await refresh();
    };

    void refresh();
    const timer = setInterval(tick, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [mode, refresh]);

  /* Keep the newest message in view while the reader is at the bottom;
     a user scrolled up into history keeps their position. */
  const onThreadScroll = () => {
    const el = threadRef.current;
    if (!el) return;
    stickBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };

  useEffect(() => {
    const el = threadRef.current;
    if (el && stickBottomRef.current) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    const content = draft.trim();
    if (!content) {
      setErrorKey("followup_error_required");
      return;
    }
    if (content.length > MAX_LEN) {
      setErrorKey("followup_error_too_long");
      return;
    }

    setBusy(true);
    busyRef.current = true;
    setErrorKey(null);

    // Optimistic bubble — server-pinned shape (client role, web source).
    const temp: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "client",
      content,
      source: "web",
      message_ts: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, temp]);
    setDraft("");

    try {
      const res = await fetch("/api/portal/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // ONLY content — role/conversation_id are server-pinned server-side.
        body: JSON.stringify({ content }),
      });

      if (res.ok) {
        // Pull the server truth right away (demo canned reply included);
        // the 8s poll continues from there.
        await refresh();
      } else {
        const data = (await res.json().catch(() => ({}))) as {
          error?: unknown;
        };
        setMessages((prev) => prev.filter((m) => m.id !== temp.id));
        setDraft(content); // restore the text the user typed
        setErrorKey(mapApiError(data.error));
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== temp.id));
      setDraft(content);
      setErrorKey("followup_error_generic");
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  };

  const stamp = (iso: string | null): string => {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString(lang === "ar" ? "ar-EG" : "en-US", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  /* -------------------------------------------------- locked (renew CTA) */
  if (mode === "locked") {
    return (
      <section className="pt-4">
        <Header titleKey="followup_title" introKey="followup_intro" demo={demo} />
        <Reveal delay={0.05} className="mt-6">
          <div className="card-surface p-8 md:p-10 text-center">
            <span className="mx-auto mb-5 inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-cream text-muted">
              <Lock className="h-7 w-7" />
            </span>
            <h2 className="heading-lg text-2xl md:text-3xl">
              {t("followup_locked_title")}
            </h2>
            <p className="text-sm leading-relaxed text-muted mt-3 max-w-md mx-auto">
              {t("followup_locked_body").replace("{name}", clientName)}
            </p>
            <Link href="/portal/renewal" className="btn-primary mt-8">
              <RefreshCcw className="h-4 w-4" />
              {t("followup_locked_cta")}
            </Link>
          </div>
        </Reveal>
        <CheckinsTeaser />
      </section>
    );
  }

  const telegramRows = messages.some((m) => m.source && m.source !== "web");

  return (
    <section className="pt-4">
      <Header
        titleKey="followup_title"
        introKey="followup_intro"
        demo={demo}
      />

      <Reveal delay={0.05} className="mt-6">
        <div className="card-surface p-5 md:p-6">
          {/* Card header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-xl bg-brand-soft text-brand">
                <MessageSquare className="h-5 w-5" />
              </span>
              <h2 className="heading-lg text-base md:text-lg">
                {t("portal_card_chat_title")}
              </h2>
            </div>
            {demo && (
              <span className="shrink-0 text-[10px] font-display uppercase tracking-widest text-brand border border-brand/50 bg-brand-soft px-2.5 py-1 rounded-full">
                {t("badge_demo")}
              </span>
            )}
          </div>

          {/* History-only expired banner */}
          {mode === "readonly" && (
            <div
              role="status"
              className="mt-4 flex items-start gap-3 rounded-2xl border border-amber/60 bg-amber/15 p-4 text-ink"
            >
              <History className="h-5 w-5 mt-0.5 shrink-0" />
              <p className="text-sm leading-relaxed">
                {t("followup_history_banner")}
              </p>
            </div>
          )}

          {/* Unified thread (web + telegram history rows) */}
          <div
            ref={threadRef}
            onScroll={onThreadScroll}
            role="log"
            aria-live="polite"
            aria-label={t("followup_thread_aria")}
            className="mt-4 space-y-3 max-h-[26rem] overflow-y-auto pr-1"
          >
            {messages.length === 0 ? (
              <p className="text-sm text-muted text-center py-10">
                {t("followup_empty")}
              </p>
            ) : (
              messages.map((m) => {
                const mine = m.role === "client";
                const telegram = Boolean(m.source && m.source !== "web");
                return (
                  <div
                    key={m.id}
                    className={`flex ${mine ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                        mine
                          ? "bg-forest-soft text-ink"
                          : "bg-cream border border-line text-ink"
                      }`}
                    >
                      {!mine && telegram && (
                        <span className="me-2 mb-1 inline-block rounded-full border border-line bg-white px-2 py-0.5 text-[10px] font-display uppercase tracking-widest text-muted">
                          {t("followup_badge_telegram")}
                        </span>
                      )}
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                        {m.content}
                      </p>
                      {stamp(m.message_ts) && (
                        <p className="text-[10px] text-muted mt-1">
                          {stamp(m.message_ts)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {telegramRows && (
            <p className="mt-3 text-[11px] text-muted">
              {t("followup_telegram_note")}
            </p>
          )}

          {/* Composer (full) — disabled input + hint (readonly) */}
          {mode === "full" ? (
            <form onSubmit={send} className="mt-5 space-y-2.5" noValidate>
              <label
                htmlFor="followup-input"
                className="flex items-center gap-2 text-xs font-bold text-muted"
              >
                <MessageSquare className="h-3.5 w-3.5 text-brand" />
                {t("followup_input_label")}
              </label>
              <textarea
                id="followup-input"
                rows={3}
                maxLength={MAX_LEN}
                className="input-light resize-y"
                placeholder={t("followup_placeholder")}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={busy}
                aria-invalid={
                  errorKey === "followup_error_required" ||
                  errorKey === "followup_error_too_long"
                }
                aria-describedby={
                  errorKey ? "followup-error" : undefined
                }
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-muted text-xs">{t("followup_hint")}</p>
                <button
                  type="submit"
                  disabled={busy}
                  className="btn-primary px-6 py-2.5"
                >
                  <Send className="h-4 w-4" />
                  {t(busy ? "followup_sending" : "followup_send")}
                </button>
              </div>
            </form>
          ) : (
            <textarea
              rows={2}
              className="input-light resize-none mt-5 opacity-60"
              placeholder={t("followup_placeholder")}
              value=""
              disabled
              aria-disabled="true"
              aria-label={t("followup_input_label")}
            />
          )}

          {errorKey && (
            <p
              id="followup-error"
              role="alert"
              className="mt-3 text-sm leading-relaxed text-red-700 flex items-center gap-2"
            >
              <CircleAlert className="h-4 w-4 shrink-0" />
              {t(errorKey)}
            </p>
          )}
        </div>
      </Reveal>

      <CheckinsTeaser />
    </section>
  );
}

/* ------------------------------------------------------------- helpers */

function Header({
  titleKey,
  introKey,
  demo,
}: {
  titleKey: TKey;
  introKey: TKey;
  demo: boolean;
}) {
  const { t } = useI18n();
  return (
    <Reveal>
      <div className="flex flex-wrap items-center gap-3">
        <p className="eyebrow mb-0">{t(titleKey)}</p>
        {demo && (
          <span className="text-[10px] font-display uppercase tracking-widest text-brand border border-brand/50 bg-brand-soft px-2.5 py-0.5 rounded-full">
            {t("badge_demo")}
          </span>
        )}
      </div>
      <p className="text-sm leading-relaxed text-muted mt-1.5">
        {t(introKey)}
      </p>
    </Reveal>
  );
}

/**
 * Check-ins teaser — the hub card anchor target (`/portal/follow-up#checkins`).
 * Placeholder card only; Task 8 fills this surface.
 */
function CheckinsTeaser() {
  const { t } = useI18n();
  const Icon: LucideIcon = CalendarCheck;

  return (
    <section id="checkins" className="scroll-mt-28 mt-8">
      <Reveal>
        <div className="card-surface p-6 opacity-90">
          <div className="flex items-start justify-between gap-3">
            <span className="shrink-0 inline-flex items-center justify-center h-11 w-11 rounded-xl bg-brand-soft text-brand">
              <Icon className="h-5 w-5" />
            </span>
            <span className="shrink-0 rounded-full text-[10px] font-display uppercase tracking-widest text-muted border border-line px-2.5 py-1">
              {t("followup_checkins_soon")}
            </span>
          </div>
          <h3 className="heading-lg text-lg mt-4">
            {t("portal_card_checkins_title")}
          </h3>
          <p className="text-sm leading-relaxed text-muted mt-1.5">
            {t("followup_checkins_teaser_body")}
          </p>
        </div>
      </Reveal>
    </section>
  );
}
