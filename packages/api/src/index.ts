export { createApiClient } from './client';
export type { AscensionAPI } from './client';
export type {
  AscensionApiConfig,
  StorageAdapter,
  AuthResult,
  Session,
  UserProfile,
  PartnerData,
  Screenshot,
  ScreenshotLog,
  ScreenshotStats,
  Alert,
  CreateAlert,
  AlertType,
  BlockedAttempt,
  Streak,
  WeeklyStats,
  SubscriptionStatus,
  CheckoutResult,
  Device,
  RegisterDevice,
  Platform,
  Encouragement,
  CreateEncouragement,
} from './types';

// React context & hook (shared by mobile + ally)
export { ApiProvider, useApi } from './context';
export type { ApiProviderProps } from './context';
