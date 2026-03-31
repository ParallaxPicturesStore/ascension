import { useContext } from 'react';
import type { AscensionAPI } from '@ascension/api';
import { ApiContext } from '../contexts/ApiContext';

export function useApi(): AscensionAPI {
  const api = useContext(ApiContext);
  if (!api) {
    throw new Error('useApi must be used within an ApiProvider');
  }
  return api;
}
