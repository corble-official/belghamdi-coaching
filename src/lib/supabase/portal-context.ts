import "server-only";

import { isDemoMode } from "@/lib/mode";
import {
  computeEntitlements,
  type SubscriptionState,
} from "./entitlements";
import type { PortalSubscriptionSnapshot } from "./portal-banner";
import { createPortalClient, getAuthUser } from "./supabase-auth";

export type PortalRole = "client" | "coach" | "admin";

export type PortalProfile = {
  id: string;
  full_name: string;
  email: string;
};

export type PortalClient = {
  id: string;
  full_name: string;
  email: string;
};

export type PortalContext =
  | {
      demo: true;
      role: PortalRole;
      profile: PortalProfile;
      client: PortalClient;
      subscription: Exclude<PortalSubscriptionSnapshot, null>;
      entitlements: ReturnType<typeof computeEntitlements>;
    }
  | { demo: false; authed: false }
  | {
      demo: false;
      authed: true;
      role: PortalRole;
      profile: PortalProfile;
      client: PortalClient;
      subscription: PortalSubscriptionSnapshot;
      entitlements: ReturnType<typeof computeEntitlements>;
    };

const DEMO_CLIENT: PortalClient = {
  id: "demo-client-id",
  full_name: "عميل تجريبي",
  email: "demo@belghamdicoaching.com",
};

const DEMO_PROFILE: PortalProfile = {
  id: "demo-client-id",
  full_name: "عميل تجريبي",
  email: "demo@belghamdicoaching.com",
};

const DEMO_SUB: SubscriptionState = {
  status: "active",
  start_date: "2026-01-01",
  end_date: "2099-12-31",
};

/**
 * Resolve the current portal context.
 * Demo path returns BEFORE any Supabase construction — zero network calls.
 */
export async function getPortalContext(): Promise<PortalContext> {
  // ---- Demo path (must run before any client creation) ----
  if (isDemoMode()) {
    return {
      demo: true,
      role: "client",
      profile: DEMO_PROFILE,
      client: DEMO_CLIENT,
      subscription: { status: DEMO_SUB.status, end_date: DEMO_SUB.end_date },
      entitlements: computeEntitlements(DEMO_SUB, new Date()),
    };
  }

  // ---- Live path ----
  const user = await getAuthUser();

  if (!user) {
    return { demo: false, authed: false };
  }

  const supabase = await createPortalClient();

/**
 * Columns not yet present in Supabase — migrations 001/004 own the schema.
 * Align (and delete this shim) when the migrations land. Typed as optional
 * unknowns so tsc stays strict without lying about the current schema.
 */
interface PendingSchemaFields {
  auth_user_id?: unknown;
  onboarding_completed?: unknown;
  full_name?: unknown;
  email?: unknown;
}

/** Safe string read for shim-typed optional schema fields. */
const str = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

  const [profileRes, clientRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("clients").select("*").eq("auth_user_id", user.id).single(),
  ]);

  // TODO(schema): `clients.auth_user_id` filters a column from migration 001;
  // remove this guard once the migrations land.
  const client = (clientRes.data as (Record<string, unknown> &
    PendingSchemaFields) | null) ?? null;

  let sub: SubscriptionState | null = null;
  let onboardingPending = false;

  if (client) {
    // TODO(schema): `onboarding_completed` comes from migration 004.
    onboardingPending = client.onboarding_completed === false;

    const subsRes = await supabase
      .from("client_subscriptions")
      .select("status, start_date, end_date, cancelled_at, resumed")
      .eq("client_id", client.id)
      .order("start_date", { ascending: false })
      .limit(1);

    sub = (subsRes.data?.[0] as SubscriptionState | undefined) ?? null;
  }

  const profile: PortalProfile = {
    id: user.id,
    full_name:
      (profileRes.data?.full_name as string | undefined) ??
      DEMO_PROFILE.full_name,
    email: user.email ?? "",
  };

  if (!client) {
    // Authenticated but no linked client record — onboarding-only context.
    return {
      demo: false,
      authed: true,
      role: "client",
      profile,
      client: { id: "", full_name: profile.full_name, email: profile.email },
      subscription: null,
      entitlements: computeEntitlements(null, new Date(), {
        onboardingPending: true,
      }),
    };
  }

  return {
    demo: false,
    authed: true,
    role: "client",
    profile,
    client: {
      id: str(client.id) ?? "",
      full_name: str(client.full_name) ?? profile.full_name,
      email: str(client.email) ?? profile.email,
    },
    subscription: sub
      ? { status: sub.status, end_date: sub.end_date }
      : null,
    entitlements: computeEntitlements(sub, new Date(), {
      onboardingPending,
    }),
  };
}
