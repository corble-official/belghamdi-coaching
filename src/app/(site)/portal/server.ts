import { cache } from "react";
import { getPortalContext } from "@/lib/supabase/portal-context";

/**
 * Request-scoped memoization of getPortalContext().
 * The portal layout AND hub page both need the context; `cache()` dedupes
 * the call within one render pass (demo: still zero network; live: one DB
 * read per request instead of two).
 */
export const getPortalCtx = cache(getPortalContext);
