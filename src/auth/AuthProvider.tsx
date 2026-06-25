/**
 * Auth context. Signs the player in anonymously on first load so they can play
 * instantly, exposes the current user + profile, and offers an optional
 * email-magic-link upgrade to persist identity across devices.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthValue {
  ready: boolean;
  configured: boolean;
  user: User | null;
  session: Session | null;
  displayName: string | null;
  /** True if the account is an anonymous (guest) sign-in. */
  isAnonymous: boolean;
  error: string | null;
  /** Send a magic link to upgrade an anonymous account to a real one. */
  linkEmail: (email: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const signingIn = useRef(false);

  const supabase = getSupabase();
  const user = session?.user ?? null;

  // Load the player's display name from their profile.
  const loadProfile = async (uid: string) => {
    if (!supabase) return;
    const { data } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', uid)
      .maybeSingle();
    if (data) setDisplayName(data.display_name);
  };

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    const ensureSignedIn = async (s: Session | null) => {
      if (s) return;
      if (signingIn.current) return;
      signingIn.current = true;
      const { error: e } = await supabase.auth.signInAnonymously();
      if (e) setError(e.message);
      signingIn.current = false;
    };

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await ensureSignedIn(data.session);
      if (data.session) await loadProfile(data.session.user.id);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) loadProfile(s.user.id);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      ready,
      configured: isSupabaseConfigured,
      user,
      session,
      displayName,
      isAnonymous: !!user?.is_anonymous,
      error,
      linkEmail: async (email: string) => {
        if (!supabase) return { error: 'Supabase not configured' };
        const { error: e } = await supabase.auth.updateUser({ email });
        return { error: e?.message ?? null };
      },
      refreshProfile: async () => {
        if (user) await loadProfile(user.id);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, user, session, displayName, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
