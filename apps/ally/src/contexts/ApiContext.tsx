import React, { createContext, useMemo, type ReactNode } from 'react';
import { createApiClient, type AscensionAPI } from '@ascension/api';
import { config } from '../config';

export const ApiContext = createContext<AscensionAPI | null>(null);

interface ApiProviderProps {
  children: ReactNode;
}

export function ApiProvider({ children }: ApiProviderProps) {
  const api = useMemo(
    () =>
      createApiClient({
        supabaseUrl: config.supabaseUrl,
        supabaseAnonKey: config.supabaseAnonKey,
        functionsBaseUrl: config.functionsBaseUrl,
      }),
    [],
  );

  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}
