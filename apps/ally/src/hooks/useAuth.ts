import { useState, useEffect, useCallback } from 'react';
import { useApi } from '@ascension/api';
import type { Session } from '@ascension/api';

interface AuthState {
  session: Session | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

/**
 * Manages authentication state for the Ally app partner account.
 */
export function useAuth(): AuthState {
  const api = useApi();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial session
  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const existing = await api.auth.getSession();
        if (mounted) setSession(existing);
      } catch {
        // No session - that's fine
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadSession();

    // Listen for auth changes
    const { unsubscribe } = api.auth.onAuthStateChange((_event, newSession) => {
      if (mounted) {
        setSession(newSession);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [api]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setError(null);
      setLoading(true);
      try {
        const result = await api.auth.signIn(email, password);
        if (result.error) {
          setError(result.error);
          return false;
        }
        setSession(result.session);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Sign in failed');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [api],
  );

  const signOut = useCallback(async () => {
    try {
      await api.auth.signOut();
      setSession(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign out failed');
    }
  }, [api]);

  return { session, loading, error, signIn, signOut };
}
