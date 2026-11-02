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
} from "lucide-react";
import { isDemoMode, integrationStatus } from "@/lib/mode";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/leads", label: "Leads", icon: Users },
  { href: "/admin/clients", label: "Clients", icon: UserCheck },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: RefreshCcw },
  { href: "/admin/progress", label: "Progress", icon: TrendingUp },
  { href: "/admin/content", label: "Content", icon: FileText },
  { href: "/admin/automation", label: "Automation", icon: Workflow },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const demo = useMemo(() => isDemoMode(), []);
  const integrations = useMemo(() => integrationStatus(), []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const logout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin/login");
  };

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
          {NAV.map((item) => {
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
