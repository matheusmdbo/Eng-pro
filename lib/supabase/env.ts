const firstDefined = (...values: Array<string | undefined>) =>
  values.find((value) => typeof value === 'string' && value.length > 0);

export function getSupabaseEnv() {
  const url = firstDefined(
    process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL
  );
  const anonKey = firstDefined(
    process.env.SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  return {
    url,
    anonKey,
    configured: Boolean(url && anonKey),
  };
}
