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
  /** The account's email once it's a permanent (non-guest) account. */
  email: string | null;
  /** True if the account is an anonymous (guest) sign-in. */
  isAnonymous: boolean;
  error: string | null;
  /**
   * Attach an email to the current guest account to make it permanent. Sends a
   * confirmation magic link; the same user_id (and thus name/stats) is kept.
   */
  upgradeWithEmail: (email: string) => Promise<{ error: string | null }>;
  /**
   * Sign in to an existing account via emailed magic link. On confirmation the
   * session switches to that account, replacing the current guest session.
   */
  signInWithEmail: (email: string) => Promise<{ error: string | null }>;
  /** Rename the current account (writes to `profiles`). */
  updateDisplayName: (name: string) => Promise<{ error: string | null }>;
  /** Sign out, then drop back to a fresh guest session so play still works. */
  signOut: () => Promise<void>;
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

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (s) {
        loadProfile(s.user.id);
      } else {
        // Signed out: clear the stale name and immediately start a fresh guest
        // session so solo/online play keeps working.
        setDisplayName(null);
        if (event === 'SIGNED_OUT') ensureSignedIn(null);
      }
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
      email: user?.email ?? null,
      isAnonymous: !!user?.is_anonymous,
      error,
      upgradeWithEmail: async (email: string) => {
        if (!supabase) return { error: 'Supabase not configured' };
        const { error: e } = await supabase.auth.updateUser(
          { email },
          { emailRedirectTo: window.location.origin },
        );
        return { error: e?.message ?? null };
      },
      signInWithEmail: async (email: string) => {
        if (!supabase) return { error: 'Supabase not configured' };
        const { error: e } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin },
        });
        return { error: e?.message ?? null };
      },
      updateDisplayName: async (name: string) => {
        if (!supabase || !user) return { error: 'Not signed in' };
        const trimmed = name.trim();
        if (trimmed.length < 1 || trimmed.length > 24) {
          return { error: 'Name must be 1–24 characters' };
        }
        const { error: e } = await supabase
          .from('profiles')
          .update({ display_name: trimmed })
          .eq('user_id', user.id);
        if (e) return { error: e.message };
        setDisplayName(trimmed);
        return { error: null };
      },
      signOut: async () => {
        if (!supabase) return;
        await supabase.auth.signOut();
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
