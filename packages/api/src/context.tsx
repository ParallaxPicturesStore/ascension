/**
 * Shared React context and hook for the Ascension API client.
 *
 * Both apps (mobile + ally) were maintaining identical copies of ApiContext
 * and useApi. This module provides a single source of truth.
 */

import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createApiClient, type AscensionAPI } from './client';
import type { AscensionApiConfig } from './types';

const ApiContext = createContext<AscensionAPI | null>(null);

export interface ApiProviderProps {
  children: ReactNode;
  config: AscensionApiConfig;
}

/**
 * Provides an AscensionAPI instance to the component tree.
 *
 * @example
 * <ApiProvider config={{ supabaseUrl: '...', supabaseAnonKey: '...' }}>
 *   <App />
 * </ApiProvider>
 */
export function ApiProvider({ children, config }: ApiProviderProps) {
  const api = useMemo(
    () => createApiClient(config),
    [config.supabaseUrl, config.supabaseAnonKey, config.functionsBaseUrl],
  );

  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

/**
 * Access the shared Ascension API client.
 * Must be used inside an <ApiProvider>.
 */
export function useApi(): AscensionAPI {
  const api = useContext(ApiContext);
  if (!api) {
    throw new Error('useApi must be used within an ApiProvider');
  }
  return api;
}
