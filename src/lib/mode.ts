export const isDemoMode = (): boolean => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const shopifyDomain = process.env.SHOPIFY_STORE_DOMAIN;
  return !supabaseUrl || !shopifyDomain;
};

export const isSupabaseConfigured = (): boolean =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );

export const integrationStatus = () => ({
  supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
  shopify: Boolean(process.env.SHOPIFY_STORE_DOMAIN),
  shopifyStorefront: Boolean(process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN),
  shopifyAdmin: Boolean(process.env.SHOPIFY_ADMIN_ACCESS_TOKEN),
});
