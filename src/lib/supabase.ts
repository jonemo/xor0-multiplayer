/**
 * Supabase client. Created lazily so the app still runs (solo/offline modes)
 * before the Supabase project env vars are configured.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

export type DB = SupabaseClient<Database>;

let client: DB | null = null;

/** Returns the shared client, or null if env vars are not set. */
export function getSupabase(): DB | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient<Database>(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}

/** Returns the client, throwing if Supabase is not configured (online features). */
export function requireSupabase(): DB {
  const c = getSupabase();
  if (!c) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env',
    );
  }
  return c;
}
