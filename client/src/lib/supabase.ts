import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

const client: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!)
  : null;

/** Returns the Supabase client, throwing if env is not configured. */
export function db(): SupabaseClient {
  if (!client) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in client/.env",
    );
  }
  return client;
}

export const supabase = client;
