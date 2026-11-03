import { Bell } from "lucide-react";

import {
  NotificationsView,
  type PortalNotifRow,
  type SalesNotifRow,
} from "@/components/admin/notifications-view";
import type { AdminRole } from "@/lib/admin/types";
import { demoNotifications, demoSalesNotifications } from "@/lib/demo/admin-crm";
import { getAdminContext } from "@/lib/supabase/admin-context";
import { createServiceClient } from "@/lib/supabase/supabase-service";

export const dynamic = "force-dynamic";

/**
 * Notifications center (Task 7 #6).
 *
 * Server component: `getAdminContext()` decides everything — demo renders
 * the in-memory demo rows (zero network); live reads run on the SERVICE
 * client strictly after the staff gate. Coach/assistant scope mirrors the
 * DB SELECT policy (`bc_notifications_select_staff`): admins see all
 * audience rows, coaches/assistants only coach/coach_assistant rows.
 * `sales_notifications` stays admin-only (zero authenticated policies by
 * design) — the tab is hidden for non-admins.
 *
 * Demo rows carry `demo: true` (house rule) and simulation rows appraised
 * by the override/task flows appear here after their demo writes.
 */
export default async function AdminNotificationsPage() {
  const ctx = await getAdminContext();
  const role = ctx.role;

  let portal: PortalNotifRow[] = [];
  let sales: SalesNotifRow[] = [];

  if (ctx.demo) {
    portal = demoNotifications();
    sales = demoSalesNotifications().map((s) => ({ ...s }));
  } else if (role === "admin") {
    const service = createServiceClient();
    const [portalRes, salesRes] = await Promise.all([
      service
        .from("notifications")
        .select(
          "id, audience_role, client_id, kind, title, body, created_at, read"
        )
        .order("created_at", { ascending: false })
        .limit(100),
      service
        .from("sales_notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    portal = ((portalRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      audience_role: String(r.audience_role),
      client_id: r.client_id ? String(r.client_id) : null,
      kind: String(r.kind),
      title: String(r.title),
      body: typeof r.body === "string" ? r.body : null,
      created_at: String(r.created_at),
      read: r.read === true,
      demo: false,
    }));
    sales = ((salesRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      lead_id: typeof r.lead_id === "string" ? r.lead_id : null,
      qualified: r.qualified === true,
      handoff: r.handoff === true,
      success: r.success === true,
      error: typeof r.error === "string" ? r.error : null,
      created_at: String(r.created_at),
      demo: false,
    }));
  } else {
    // coach/assistant: same scope the RLS policy grants them (service read
    // keeps parity with bc_notifications_select_staff).
    const service = createServiceClient();
    const portalRes = await service
      .from("notifications")
      .select("id, audience_role, client_id, kind, title, body, created_at, read")
      .in("audience_role", ["coach", "coach_assistant"])
      .order("created_at", { ascending: false })
      .limit(100);
    portal = ((portalRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      audience_role: String(r.audience_role),
      client_id: r.client_id ? String(r.client_id) : null,
      kind: String(r.kind),
      title: String(r.title),
      body: typeof r.body === "string" ? r.body : null,
      created_at: String(r.created_at),
      read: r.read === true,
      demo: false,
    }));
  }

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <Bell className="h-5 w-5 text-copper" />
        <h1 className="font-display font-bold text-3xl text-bone">
          Notifications
        </h1>
      </div>
      <p className="text-sm text-wgray mt-1 mb-8">
        Operator notices, override requests/errors and sales automation state
        {ctx.demo ? " — demo rows, simulated only" : ""}.
      </p>
      <NotificationsView portal={portal} sales={sales} role={role} />
    </div>
  );
}
