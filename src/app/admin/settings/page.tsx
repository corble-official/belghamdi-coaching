"use client";

import { useEffect, useState } from "react";
import { Save, Database, Cloud, RefreshCcw, ShieldAlert, Zap, Activity } from "lucide-react";
import { useAdminStore } from "@/lib/demo/admin-store";
import { integrationStatus, isDemoMode } from "@/lib/mode";
import { eventBus } from "@/lib/integrations/dispatcher";

export default function AdminSettingsPage() {
  const { settings, saveSettings, currency, setCurrency, resetDemoData } = useAdminStore();
  const integrations = integrationStatus();
  const demo = isDemoMode();
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState(settings);
  const [wiping, setWiping] = useState(false);

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      <div>
        <h1 className="font-display font-bold text-3xl text-bone">Settings</h1>
        <p className="text-sm text-wgray mt-1">Business, integrations, and platform preferences</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 mt-8">
        <div className="card-surface p-8">
          <h2 className="font-display font-semibold text-bone mb-6">Business information</h2>
          <div className="space-y-4">
            {[
              { key: "businessName", label: "Business name" },
              { key: "contactEmail", label: "Contact email" },
              { key: "phone", label: "Phone" },
              { key: "whatsapp", label: "WhatsApp number" },
              { key: "instagram", label: "Instagram URL" },
              { key: "youtube", label: "YouTube URL" },
            ].map((f) => (
              <div key={f.key}>
                <label className="label-dark">{f.label}</label>
                <input
                  value={form[f.key as keyof typeof form] as string}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  className="input-dark"
                />
              </div>
            ))}
            {saved && (
              <p className="text-xs text-copper font-display uppercase tracking-widest">
                Settings saved
              </p>
            )}
            <button
              onClick={() => {
                saveSettings(form);
                setSaved(true);
                window.setTimeout(() => setSaved(false), 2000);
              }}
              className="btn-primary w-full"
            >
              <Save className="h-4 w-4" /> Save Settings
            </button>
          </div>
        </div>

        <div className="space-y-8">
          <div className="card-surface p-8">
            <h2 className="font-display font-semibold text-bone mb-6">Commerce & locale</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-dark">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as "EGP" | "MAD" | "EUR" | "USD")}
                  className="input-dark"
                >
                  <option value="EGP">EGP</option>
                  <option value="USD">USD</option>
                  <option value="MAD">MAD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div>
                <label className="label-dark">Language</label>
                <select
                  value={form.language}
                  onChange={(e) => {
                    const language = e.target.value as "en" | "ar";
                    setForm({ ...form, language });
                    saveSettings({ language });
                  }}
                  className="input-dark"
                >
                  <option value="en">English</option>
                  <option value="ar">العربية</option>
                </select>
              </div>
            </div>

            <h3 className="text-xs font-display uppercase tracking-widest text-wgray mt-8 mb-4">
              Notification preferences
            </h3>
            <div className="space-y-3">
              {[
                { key: "notifyNewLeads", label: "New lead captured" },
                { key: "notifyNewOrders", label: "New order paid" },
                { key: "notifyProgress", label: "Progress submitted" },
              ].map((n) => (
                <label key={n.key} className="flex items-center justify-between text-sm text-wgray cursor-pointer">
                  {n.label}
                  <button
                    type="button"
                    onClick={() => {
                      const next = { ...form, [n.key]: !(form[n.key as keyof typeof form] as boolean) };
                      setForm(next);
                      saveSettings(next);
                    }}
                    className={`w-10 h-5 relative border transition-colors ${
                      form[n.key as keyof typeof form] ? "border-copper" : "border-wgray-dim"
                    }`}
                    aria-label={`Toggle ${n.label}`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 transition-all ${
                        form[n.key as keyof typeof form] ? "left-[22px] bg-copper" : "left-0.5 bg-wgray"
                      }`}
                    />
                  </button>
                </label>
              ))}
            </div>
          </div>

          <div className="card-surface p-8">
            <h2 className="font-display font-semibold text-bone mb-6 flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-copper" /> Environment
            </h2>
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-wgray">Current environment</span>
                <span
                  className={`text-xs font-display font-bold uppercase tracking-widest px-3 py-1 rounded-full border ${
                    demo
                      ? "bg-copper/15 text-copper border-copper/40"
                      : "bg-emerald-400/10 text-emerald-300 border-emerald-300/30"
                  }`}
                >
                  {demo ? "Demo" : "Live"}
                </span>
              </div>
              <p className="text-xs text-wgray leading-relaxed">
                {demo
                  ? "Demo: simulated clients, orders, and deliveries. No real payments and no production notifications. Demo actions never modify live records."
                  : "Live: real business records, real Shopify payments, production notifications."}
              </p>
              <div className="border-t border-wgray-dim/40 pt-4">
                {integrations.supabase ? (
                  <p className="text-xs text-emerald-300">
                    Live prerequisites met (Supabase configured). The environment is selected by the
                    configured <code className="text-bone">.env</code> credentials — switching to Live
                    requires setting <code className="text-bone">NEXT_PUBLIC_SUPABASE_URL</code>, Shopify
                    credentials, and <code className="text-bone">N8N_*</code> variables, then restarting.
                    All live dispatches are enforced server-side; this UI never switches data stores on its own.
                  </p>
                ) : (
                  <p className="text-xs text-wgray-dim">
                    Live mode is not available yet: no Supabase project is configured. Configure the live
                    project credentials in <code className="text-bone">.env</code> first — then switching
                    environments re-provisions data and automation routing server-side (with confirmation).
                    Frontend filtering alone is never treated as isolation.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="card-surface p-8">
            <h2 className="font-display font-semibold text-bone mb-6">Integration status</h2>
            <div className="space-y-3 text-sm">
              <p className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-wgray">
                  <Database className="h-4 w-4" /> Supabase
                </span>
                {integrations.supabase ? (
                  <span className="text-emerald-400">Connected</span>
                ) : (
                  <span className="text-copper">Not configured (demo)</span>
                )}
              </p>
              <p className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-wgray">
                  <Cloud className="h-4 w-4" /> Shopify Storefront
                </span>
                {integrations.shopifyStorefront ? (
                  <span className="text-emerald-400">Connected</span>
                ) : (
                  <span className="text-copper">Not configured (demo)</span>
                )}
              </p>
              <p className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-wgray">
                  <Cloud className="h-4 w-4" /> Shopify Admin API
                </span>
                {integrations.shopifyAdmin ? (
                  <span className="text-emerald-400">Connected</span>
                ) : (
                  <span className="text-copper">Not configured (demo)</span>
                )}
              </p>
            </div>
            <p className="text-xs text-wgray-dim mt-6 leading-relaxed">
              Fill the environment variables in <code className="text-bone">.env</code> (see{" "}
              <code className="text-bone">.env.example</code>) and restart to switch this platform
              from demo to live mode. Shopify stays the source of truth for products, orders, and
              checkout.
            </p>
          </div>
        </div>
      </div>

      <div className="card-surface p-8 mt-8">
        <h2 className="font-display font-semibold text-bone mb-6 flex items-center gap-3">
          <Zap className="h-5 w-5 text-copper" /> Automation (n8n)
        </h2>
        <p className="text-sm text-wgray max-w-3xl leading-relaxed">
          The n8n connection, workflow inventory, and webhook delivery log now live in the{" "}
          <a href="/admin/automation" className="text-copper hover:underline">
            Automation Center
          </a>
          . Every business lead, verified order, and renewal still dispatches into the integration
          event stream below.
        </p>
        <EventLog />
      </div>

      {demo && (
        <div className="card-surface p-8 mt-8 border-red-400/30">
          <h2 className="font-display font-semibold text-bone mb-3 flex items-center gap-2 text-red-300">
            <ShieldAlert className="h-5 w-5" /> Danger zone
          </h2>
          <p className="text-sm text-wgray mb-6">
            Reset the demo dataset to its seeded state. This only affects demo data.
          </p>
          {wiping ? (
            <div className="flex gap-3">
              <button
                onClick={resetDemoData}
                className="px-5 py-3 text-sm font-display uppercase tracking-widest bg-red-500/80 text-white hover:bg-red-500"
              >
                Yes, reset demo data
              </button>
              <button
                onClick={() => setWiping(false)}
                className="px-5 py-3 text-sm font-display uppercase tracking-widest border border-wgray-dim text-wgray hover:text-bone"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setWiping(true)}
              className="px-5 py-3 text-sm font-display uppercase tracking-widest border border-red-400/40 text-red-300 hover:bg-red-400/10 transition-colors"
            >
              <RefreshCcw className="h-4 w-4 inline mr-2" /> Reset demo data
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function EventLog() {
  const [events, setEvents] = useState<
    { id: string; type: string; source: string; payloadRef: string; status: string; createdAt: string }[]
  >([]);

  useEffect(() => {
    const load = () => {
      eventBus.list().then((list) => setEvents(list.slice(0, 10)));
    };
    load();
    window.addEventListener("bc:integration-events", load);
    return () => window.removeEventListener("bc:integration-events", load);
  }, []);

  return (
    <div className="mt-6">
      <p className="flex items-center gap-2 text-xs font-display uppercase tracking-widest text-wgray mb-3">
        <Activity className="h-4 w-4 text-copper" /> Integration event stream
      </p>
      {events.length === 0 ? (
        <p className="text-xs text-wgray-dim">No events dispatched yet.</p>
      ) : (
        <div className="card-surface">
          {events.map((e) => (
            <div key={e.id} className="flex items-center justify-between px-5 py-3 border-b border-wgray-dim/30 last:border-0">
              <div className="flex items-center gap-4">
                <span className="font-mono text-xs text-copper">{e.type}</span>
                <span className="font-mono text-[10px] text-wgray-dim break-all">{e.payloadRef}</span>
              </div>
              <span className="text-[10px] text-wgray-dim shrink-0">{new Date(e.createdAt).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
