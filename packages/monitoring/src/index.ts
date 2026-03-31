export {
  initMonitoring,
  setUser,
  clearUser,
  getSentryInstance,
} from './init';
export type { SentryLike, MonitoringConfig } from './init';

export { trackEvent, trackError } from './events';
export type { AnalyticsEvent } from './events';

export { ErrorBoundary } from './ErrorBoundary';
