import { isDemoMode } from "@/lib/mode";
import LoginForm from "./LoginForm";

/* NOTE: demo/live discrimination happens HERE, on the server —
   `isDemoMode()` reads `SHOPIFY_STORE_DOMAIN`, a server-only env var that is
   not available in client components. The flag is passed down as a prop. */
export default function ClientLoginPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  return (
    <LoginForm
      demo={isDemoMode()}
      callbackFailed={searchParams?.error === "auth"}
    />
  );
}
