import { useEffect, useState, useCallback } from 'react';
import type { Session } from '@ascension/api';
import { useApi } from './useApi';

interface AuthState {
  session: Session | null;
  user: { id: string; email: string } | null;
  loading: boolean;
}

export function useAuth() {
  const api = useApi();
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    loading: true,
  });

  useEffect(() => {
    // Fetch initial session
    api.auth
      .getSession()
      .then((session) => {
        setState({
          session,
          user: session?.user ?? null,
          loading: false,
        });
      })
      .catch(() => {
        setState({ session: null, user: null, loading: false });
      });

    // Subscribe to auth changes
    const { unsubscribe } = api.auth.onAuthStateChange((_event, session) => {
      setState({
        session,
        user: session?.user ?? null,
        loading: false,
      });
    });

    return () => unsubscribe();
  }, [api]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await api.auth.signIn(email, password);
      return result;
    },
    [api],
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      const result = await api.auth.signUp(email, password);
      return result;
    },
    [api],
  );

  const signOut = useCallback(async () => {
    await api.auth.signOut();
  }, [api]);

  return {
    ...state,
    signIn,
    signUp,
    signOut,
  };
}
