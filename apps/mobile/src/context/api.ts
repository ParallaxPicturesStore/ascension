import React, { createContext, useContext } from 'react';
import type { AscensionAPI } from '@ascension/api';

export const ApiContext = createContext<AscensionAPI | null>(null);

export function useApi(): AscensionAPI {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi must be used within ApiProvider');
  return api;
}