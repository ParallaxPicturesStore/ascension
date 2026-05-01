import { createContext, useContext, type ReactNode } from 'react';
import type { AscensionAPI } from '@ascension/api';

const ApiContext = createContext<AscensionAPI | null>(null);

export function ApiProvider({ api, children }: { api: AscensionAPI; children: ReactNode }) {
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

export function useApi(): AscensionAPI {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi must be used within ApiProvider');
  return api;
}