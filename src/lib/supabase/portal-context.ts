import "server-only";

import { isDemoMode } from "@/lib/mode";
import { computeEntitlements, type SubscriptionState } from "./entitlements";
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
  | { demo: true; role: PortalRole; profile: PortalProfile; client: PortalClient; entitlements: ReturnType<typeof computeEntitlements> }
  | { demo: false; authed: false }
  | {
      demo: false;
      authed: true;
      role: PortalRole;
      profile: PortalProfile;
      client: PortalClient;
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
      entitlements: computeEntitlements(DEMO_SUB, new Date()),
    };
  }

  // ---- Live path ----
  const user = await getAuthUser();

  if (!user) {
    return { demo: false, authed: false };
  }

  const supabase = await createPortalClient();

  const [profileRes, clientRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("clients").select("*").eq("auth_user_id", user.id).single(),
  ]);

  const client = clientRes.data;

  let sub: SubscriptionState | null = null;
  let onboardingPending = false;

  if (client) {
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
      id: client.id,
      full_name: client.full_name ?? profile.full_name,
      email: client.email ?? profile.email,
    },
    entitlements: computeEntitlements(sub, new Date(), {
      onboardingPending,
    }),
  };
}
