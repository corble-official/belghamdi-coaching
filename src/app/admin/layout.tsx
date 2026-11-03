"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Package,
  ShoppingCart,
  RefreshCcw,
  TrendingUp,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  Cloud,
  Database,
  Workflow,
  MessageSquare,
  ClipboardCheck,
  Bell,
} from "lucide-react";
import { isDemoMode, integrationStatus } from "@/lib/mode";

const NAV: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  /** Hidden for coach / coach_assistant scopes (admin legacy sees all). */
  adminOnly?: boolean;
}[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/leads", label: "Leads", icon: Users, adminOnly: true },
  { href: "/admin/clients", label: "Clients", icon: UserCheck },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: RefreshCcw },
  { href: "/admin/conversations", label: "Conversations", icon: MessageSquare },
  { href: "/admin/tasks", label: "Check-in Reviews", icon: ClipboardCheck },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
  { href: "/admin/products", label: "Products", icon: Package, adminOnly: true },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart, adminOnly: true },
  { href: "/admin/progress", label: "Progress", icon: TrendingUp, adminOnly: true },
  { href: "/admin/content", label: "Content", icon: FileText, adminOnly: true },
  { href: "/admin/automation", label: "Automation", icon: Workflow, adminOnly: true },
  { href: "/admin/settings", label: "Settings", icon: Settings, adminOnly: true },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"admin" | "coach" | "coach_assistant" | null | "loading">(
    "loading"
  );
  const demo = useMemo(() => isDemoMode(), []);
  const integrations = useMemo(() => integrationStatus(), []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  /**
   * Role-aware nav mapping (Task 7): demo/legacy admin → 'admin' (all
   * items); live JWT staff → role read from the staff API (pages + routes
   * enforce the matrix server-side; the nav badge is informative).
   */
  useEffect(() => {
    let alive = true;
    if (demo) {
      setRole("admin");
      return;
    }
    fetch("/api/admin/clients?segment=all")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { role?: string } | null) => {
        if (!alive) return;
        const r = data?.role;
        setRole(
          r === "admin" || r === "coach" || r === "coach_assistant" ? r : null
        );
      })
      .catch(() => alive && setRole(null));
    return () => {
      alive = false;
    };
  }, [demo, pathname]);

  const logout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin/login");
  };

  /**
   * Role-aware visibility: admin (legacy cookie or JWT) sees everything; coach
   * and coach_assistant see only the view-only CRM surfaces. Server routes
   * remain the enforcement point — this is chrome, not security.
   */
  const visibleNav =
    role === "coach" || role === "coach_assistant"
      ? NAV.filter((item) => !item.adminOnly)
      : NAV;

  return (
    <div dir="ltr" className="min-h-screen bg-graphite flex">
      <aside
        className={`fixed lg:sticky top-0 h-screen w-64 shrink-0 bg-obsidian border-r border-wgray-dim/50 z-40 flex flex-col transition-transform duration-300 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 flex items-center gap-3 px-6 border-b border-wgray-dim/50">
          <span className="w-8 h-8 border border-copper flex items-center justify-center font-display font-bold text-copper text-sm">
            B
          </span>
          <span className="font-display font-semibold text-sm uppercase tracking-widest text-bone">
            Admin<span className="text-copper">.</span>
          </span>
          {demo && (
            <span
              title="Demo environment — simulated data, no real payments or production notifications"
              className="text-[10px] font-display font-bold uppercase tracking-widest bg-copper/15 text-copper border border-copper/40 px-2 py-0.5 rounded-full"
            >
              Demo
            </span>
          )}
          <button className="ml-auto text-wgray lg:hidden" onClick={() => setOpen(false)} aria-label="Close sidebar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          {visibleNav.map((item) => {
            const active =
              item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-copper/10 text-copper border-l-2 border-copper"
                    : "text-wgray hover:text-bone border-l-2 border-transparent"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-wgray-dim/50">
          <div className="mb-4 space-y-2 text-xs">
            {role !== "loading" && (
              <p className="flex items-center gap-2 text-wgray" data-role-badge>
                Scope:{" "}
                <span className="text-copper font-display uppercase tracking-widest">
                  {role ?? "none"}
                  {role === "coach_assistant" ? " (view-only)" : ""}
                </span>
              </p>
            )}
            <p className="flex items-center gap-2 text-wgray">
              <Database className="h-3.5 w-3.5" />
              {integrations.supabase ? "Supabase: connected" : "Supabase: not configured"}
            </p>
            <p className="flex items-center gap-2 text-wgray">
              <Cloud className="h-3.5 w-3.5" />
              {integrations.shopify ? "Shopify: connected" : "Shopify: not configured"}
            </p>
            {!integrations.supabase && !integrations.shopify && (
              <p className="text-[10px] text-copper leading-relaxed">
                Demo mode active — data is simulated and clearly labeled.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="flex-1 text-xs font-display uppercase tracking-widest text-wgray hover:text-bone border border-wgray-dim py-2 text-center transition-colors"
            >
              View Site
            </Link>
            <button
              onClick={logout}
              className="p-2 border border-wgray-dim text-wgray hover:text-red-300 hover:border-red-400/40 transition-colors"
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <div className="lg:hidden h-16 sticky top-0 z-30 bg-graphite/90 backdrop-blur border-b border-wgray-dim/50 flex items-center px-5">
          <button onClick={() => setOpen(true)} className="text-bone" aria-label="Open sidebar">
            <Menu className="h-6 w-6" />
          </button>
          <span className="ml-4 font-display font-semibold uppercase tracking-widest text-sm">
            Belghamdi Admin
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
