import { useContext } from 'react';
import { ApiContext } from '../contexts/ApiContext';
import type { AscensionAPI } from '@ascension/api';

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
