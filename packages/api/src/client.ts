// ============================================================
// Ascension API Client
// Platform-agnostic typed wrapper around Supabase + Edge Functions.
// Uses ANON key only — elevated operations go through Edge Functions.
// ============================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { calculateStreak } from '@ascension/shared';
import type {
  AscensionApiConfig,
  AuthResult,
  Session,
  UserProfile,
  PartnerData,
  Screenshot,
  ScreenshotLog,
  ScreenshotStats,
  Alert,
  CreateAlert,
  BlockedAttempt,
  Streak,
  WeeklyStats,
  SubscriptionStatus,
  CheckoutResult,
  Device,
  RegisterDevice,
  Encouragement,
  CreateEncouragement,
} from './types';

// ── Helper: throw on Supabase error ─────────────────────────

function throwOnError<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

/**
 * Recompute current_streak from raw timestamp fields so the displayed value
 * is always correct regardless of whether the daily increment job ran.
 * Priority: last_relapse_date → streak_started_at → updated_at → stored value
 */
function normalizeStreak(streak: Streak | null): Streak | null {
  if (!streak) return null;

  const computed = calculateStreak({
    lastRelapseDate: streak.last_relapse_date,
    streakStartedAt: streak.streak_started_at,
    updatedAt: streak.updated_at,
    currentStreak: streak.current_streak,
  });

  return {
    ...streak,
    current_streak: computed,
    longest_streak: Math.max(streak.longest_streak, computed),
  };
}

// ── API Client Interface ────────────────────────────────────

export interface AscensionAPI {
  /** Access the raw Supabase client (e.g. for realtime subscriptions). */
  readonly supabase: SupabaseClient;

  auth: {
    signUp(email: string, password: string): Promise<AuthResult>;
    signIn(email: string, password: string): Promise<AuthResult>;
    signOut(): Promise<void>;
    getSession(): Promise<Session | null>;
    onAuthStateChange(callback: (event: string, session: Session | null) => void): {
      unsubscribe: () => void;
    };
  };

  users: {
    getProfile(userId: string): Promise<UserProfile>;
    updateProfile(userId: string, data: Partial<UserProfile>): Promise<void>;
    linkByInvite(inviteCode: string): Promise<void>;
    getPartnerData(userId: string): Promise<PartnerData | null>;
    setQuitPassword(userId: string, passwordHash: string): Promise<void>;
    getQuitPasswordHash(userId: string): Promise<string | null>;
    updateUserPartnerId(inviteCode: string, data: { partner_id: string }): Promise<void>;
  };

  screenshots: {
    log(data: ScreenshotLog): Promise<void>;
    getRecent(userId: string, limit?: number): Promise<Screenshot[]>;
    getRecentByPartner(partnerId: string, limit?: number): Promise<Screenshot[]>;
    getSignedUrl(filePath: string, expiresIn?: number): Promise<string | null>;
    getStats(userId: string): Promise<ScreenshotStats>;
  };

  alerts: {
    create(data: CreateAlert): Promise<void>;
    invitePartner(partnerEmail: string, inviteCode: string, userName: string): Promise<void>;
    getForPartner(partnerId: string): Promise<Alert[]>;
    getForUser(userId: string): Promise<Alert[]>;
    markRead(alertId: string): Promise<void>;
  };

  streaks: {
    get(userId: string): Promise<Streak | null>;
    syncLongest(userId: string, currentStreak: number, longestStreak: number): Promise<Streak>;
    reset(userId: string): Promise<Streak>;
    increment(userId: string): Promise<Streak>;
    getWeeklyStats(userId: string): Promise<WeeklyStats>;
  };

  billing: {
    createCheckout(userId: string, email: string, plan: string): Promise<CheckoutResult>;
    getSubscriptionStatus(userId: string): Promise<SubscriptionStatus>;
    getCustomerId(userId: string): Promise<string | null>;
    createPortalSession(customerId: string): Promise<{ url: string } | null>;
  };

  blockedAttempts: {
    log(data: BlockedAttempt): Promise<void>;
    getRecent(userId: string, limit?: number): Promise<BlockedAttempt[]>;
  };

  devices: {
    register(data: RegisterDevice): Promise<Device>;
    heartbeat(deviceId: string): Promise<void>;
    updatePushToken(deviceId: string, token: string): Promise<void>;
    list(userId: string): Promise<Device[]>;
    remove(deviceId: string): Promise<void>;
  };

  encouragements: {
    send(data: CreateEncouragement): Promise<Encouragement>;
    getForUser(userId: string): Promise<Encouragement[]>;
    markRead(encouragementId: string): Promise<void>;
    getUnreadCount(userId: string): Promise<number>;
  };
}

// ── Factory ─────────────────────────────────────────────────

export function createApiClient(config: AscensionApiConfig): AscensionAPI {
  const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      storage: config.storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  const functionsBase = config.functionsBaseUrl ?? `${config.supabaseUrl}/functions/v1`;

  // Helper to call Edge Functions with the user's access token
  async function callEdgeFunction<T = unknown>(
    fnName: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const res = await fetch(`${functionsBase}/${fnName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token ?? config.supabaseAnonKey}`,
        'apikey': config.supabaseAnonKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Edge Function ${fnName} failed (${res.status}): ${text}`);
    }

    return res.json() as Promise<T>;
  }

  // ── Auth ────────────────────────────────────────────────────

  const auth: AscensionAPI['auth'] = {
    async signUp(email, password) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return { user: null, session: null, error: error.message };
      // Supabase returns an empty identities array instead of an error when the email is already registered
      if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
        return { user: null, session: null, error: 'An account with this email already exists. Please sign in instead.' };
      }
      return {
        user: data.user ? { id: data.user.id, email: data.user.email! } : null,
        session: data.session as Session | null,
        error: null,
      };
    },

    async signIn(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { user: null, session: null, error: error.message };
      return {
        user: data.user ? { id: data.user.id, email: data.user.email! } : null,
        session: data.session as Session | null,
        error: null,
      };
    },

    async signOut() {
      const { error } = await supabase.auth.signOut();
      if (error) throw new Error(error.message);
    },

    async getSession() {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw new Error(error.message);
      return (data.session as Session | null) ?? null;
    },

    onAuthStateChange(callback) {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        callback(event, session as Session | null);
      });
      return { unsubscribe: () => data.subscription.unsubscribe() };
    },
  };

  // ── Users ───────────────────────────────────────────────────

  const users: AscensionAPI['users'] = {
    async getProfile(userId) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw new Error(error.message);
      return data as UserProfile;
    },

    async updateProfile(userId, updates) {
      console.log('[API.users.updateProfile] Request', {
        userId,
        updateKeys: Object.keys(updates ?? {}),
        updates,
      });
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select('id, partner_id');
      if (error) {
        console.log('[API.users.updateProfile] Supabase error', {
          userId,
          message: error.message,
        });
        throw new Error(error.message);
      }

      if (!data || data.length === 0) {
        const authUserResult = await supabase.auth.getUser();
        const authUserId = authUserResult.data.user?.id ?? null;
        const userEmail = authUserResult.data.user?.email ?? null;

        console.log('[API.users.updateProfile] No rows updated by id, trying email fallback', {
          userId,
          authUserId,
          userEmail,
        });

        // Never fallback to email when caller targets a different user id.
        // That would update the wrong row and hide the real issue.
        if (!authUserId || authUserId !== userId) {
          throw new Error(
            'Profile update matched 0 rows for the target user id. Fallback by email is only allowed for the currently authenticated user.',
          );
        }

        if (!userEmail) {
          throw new Error(
            'Profile update matched 0 rows by id and no auth email was available for fallback.',
          );
        }

        const emailFallback = await supabase
          .from('users')
          .update(updates)
          .eq('email', userEmail)
          .select('id, email, partner_id');

        console.log('[API.users.updateProfile] Email fallback result', {
          data: emailFallback.data,
          error: emailFallback.error,
        });

        if (emailFallback.error) {
          throw new Error(emailFallback.error.message);
        }

        if (!emailFallback.data || emailFallback.data.length === 0) {
          throw new Error(
            'Profile update matched 0 rows by id and by email. Verify users row exists in this Supabase project.',
          );
        }

        console.log('[API.users.updateProfile] Success via email fallback', {
          updatedRow: emailFallback.data[0],
        });
        return;
      }

      console.log('[API.users.updateProfile] Success', {
        userId,
        updatedRow: data[0],
      });
    },
  async updateUserPartnerId(inviteCode, data) {
      await supabase.from('users').update(data).eq('id', inviteCode);
    },

    async linkByInvite(inviteCode) {
      await callEdgeFunction('ascension-api', {
        action: 'users.linkByInvite',
        payload: {
          invite_code: inviteCode,
        },
      });
    },

    async getPartnerData(userId) {
      // In ally flows, monitored user rows store partner_id = ally user id.
      // So we locate the monitored user by matching partner_id to the ally id.
      if (!userId) return null;

      // Fetch partner profile (RLS allows partner reads)      
      const { data: partner, error: partnerError } = await supabase
        .from('users')
        .select('id, name, email, subscription_status')
        .eq('partner_id', userId)
        .single();

      if (partnerError) throw new Error(partnerError.message);

      if (!partner) return null;

      // Fetch partner's streak
      const { data: streak } = await supabase
        .from('streaks')
        .select('*')
        .eq('user_id', partner.id)
        .single();

      // Compute current_streak from timestamps — do not trust the stored column.
      let normalizedStreak: Streak | null = normalizeStreak(streak ? (streak as Streak) : null);

      // If the stored longest_streak is still behind the computed value,
      // persist the correction via the edge function (admin key bypasses RLS).
      if (normalizedStreak && streak && streak.longest_streak < normalizedStreak.current_streak) {
        try {
          const fixed = await callEdgeFunction<Streak>('ascension-api', {
            action: 'streaks.syncLongest',
            payload: { user_id: partner.id },
          });
          normalizedStreak = normalizeStreak(fixed);
        } catch {
          // Edge function not available — keep the already-normalized in-memory value.
        }
      }

      // Fetch recent alerts for this partner
      const { data: recentAlerts } = await supabase
        .from('alerts')
        .select('*')
        .eq('partner_id', userId)
        .order('timestamp', { ascending: false })
        .limit(10);

      return {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        subscription_status: partner.subscription_status as SubscriptionStatus,
        streak: normalizedStreak,
        recentAlerts: (recentAlerts as Alert[]) ?? [],
      };
    },

    async setQuitPassword(userId, passwordHash) {
      throwOnError(
        await supabase
          .from('users')
          .update({ partner_password_hash: passwordHash })
          .eq('id', userId),
      );
    },

    async getQuitPasswordHash(userId) {
      const { data, error } = await supabase
        .from('users')
        .select('partner_password_hash')
        .eq('id', userId)
        .single();
      if (error) throw new Error(error.message);
      return data?.partner_password_hash ?? null;
    },
  };

  // ── Screenshots ─────────────────────────────────────────────

  const screenshots: AscensionAPI['screenshots'] = {
    async log(data) {
      // Uses Edge Function because desktop/mobile may not have RLS insert
      // permission in all contexts (service role was previously used).
      await callEdgeFunction('ascension-api', {
        action: 'screenshots.log',
        payload: data,
      });
    },

    async getRecent(userId, limit = 20) {
      const { data, error } = await supabase
        .from('screenshots')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []) as Screenshot[];
    },

    async getRecentByPartner(partnerId, limit = 20) {
      const { data, error } = await supabase
        .from('screenshots')
        .select('*')
        .eq('partner_id', partnerId)
        .order('timestamp', { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []) as Screenshot[];
    },

    async getSignedUrl(filePath) {
      // Bucket is public — construct the direct public URL.
      // filePath is stored as "screenshots/{userId}/{timestamp}.jpg"
      // which is already the full path including the bucket name.
      if (!filePath) return null;
      if (filePath.startsWith('http')) return filePath;
      return `${config.supabaseUrl}/storage/v1/object/public/${filePath}`;
    },

    async getStats(userId) {
      const [totalResult, flaggedCountResult, lastCaptureResult] = await Promise.all([
        supabase
          .from('screenshots')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),
        supabase
          .from('screenshots')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('flagged', true),
        supabase
          .from('screenshots')
          .select('timestamp')
          .eq('user_id', userId)
          .order('timestamp', { ascending: false })
          .limit(1),
      ]);

      return {
        totalCaptures: totalResult.count ?? 0,
        flaggedCount: flaggedCountResult.count ?? 0,
        lastCaptureTime: lastCaptureResult.data?.[0]?.timestamp ?? null,
      };
    },
  };

  // ── Alerts ──────────────────────────────────────────────────

  const alerts: AscensionAPI['alerts'] = {
    async create(data) {
      // Edge Function for service-role insert
      await callEdgeFunction('ascension-api', {
        action: 'alerts.create',
        payload: data,
      });
    },

    async invitePartner(partnerEmail, userName, inviteCode) {
      await callEdgeFunction('ascension-api', {
        action: 'alerts.sendEmail',
        payload: {
          type: 'partner_invitation',
          to: partnerEmail,
          userName,
          data: {
            signupUrl: 'https://getascension.app/signup',
            inviteCode ,
          },
        },
      });
    },

    async getForPartner(partnerId) {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .eq('partner_id', partnerId)
        .order('timestamp', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Alert[];
    },

    async getForUser(userId) {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Alert[];
    },

    async markRead(alertId) {
      throwOnError(
        await supabase.from('alerts').update({ read: true }).eq('id', alertId),
      );
    },
  };

  // ── Streaks ─────────────────────────────────────────────────

  const streaks: AscensionAPI['streaks'] = {
    async get(userId) {
      const { data, error } = await supabase
        .from('streaks')
        .select('*')
        .eq('user_id', userId)
        .single();
      if (error) {
        // No row yet is not an error
        if (error.code === 'PGRST116') return null;
        throw new Error(error.message);
      }

      // Compute current_streak from timestamps — do not trust the stored column.
      const normalized = normalizeStreak(data as Streak);
      if (!normalized) return null;

      const stored = data as Streak;
      const currentStreakChanged = normalized.current_streak !== stored.current_streak;
      const longestStreakChanged = normalized.longest_streak > stored.longest_streak;

      // Persist the computed values back to the DB when they differ from what
      // is stored, so the column stays accurate for any other consumers.
      if (currentStreakChanged || longestStreakChanged) {
        const { data: fixed, error: fixErr } = await supabase
          .from('streaks')
          .update({
            current_streak: normalized.current_streak,
            longest_streak: normalized.longest_streak,
          })
          .eq('user_id', userId)
          .select('*')
          .single();

        if (!fixErr && fixed) return normalizeStreak(fixed as Streak);
        // If the update failed, return the in-memory normalized value so the
        // display is still correct even if the write didn't land.
      }

      return normalized;
    },

    async syncLongest(userId, currentStreak, longestStreak) {
      return callEdgeFunction<Streak>('ascension-api', {
        action: 'streaks.syncLongest',
        payload: {
          user_id: userId,
          current_streak: currentStreak,
          longest_streak: longestStreak,
        },
      });
    },

    async reset(userId) {
      const result = await callEdgeFunction<Streak>('ascension-api', {
        action: 'streaks.reset',
        payload: { user_id: userId },
      });
      return result;
    },

    async increment(userId) {
      const result = await callEdgeFunction<Streak>('ascension-api', {
        action: 'streaks.increment',
        payload: { user_id: userId },
      });
      return result;
    },

    async getWeeklyStats(userId) {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const since = weekAgo.toISOString();

      const [screenshotResult, blockedResult, flaggedResult] = await Promise.all([
        supabase
          .from('screenshots')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('timestamp', since),
        supabase
          .from('blocked_attempts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('timestamp', since),
        supabase
          .from('screenshots')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('flagged', true)
          .gte('timestamp', since),
      ]);

      return {
        screenshotCount: screenshotResult.count ?? 0,
        blockedCount: blockedResult.count ?? 0,
        flaggedCount: flaggedResult.count ?? 0,
      };
    },
  };

  // ── Billing ─────────────────────────────────────────────────

  const billing: AscensionAPI['billing'] = {
    async createCheckout(userId, email, plan) {
      return callEdgeFunction<CheckoutResult>('ascension-api', {
        action: 'billing.createCheckout',
        payload: { user_id: userId, email, plan },
      });
    },

    async getSubscriptionStatus(userId) {
      const { data, error } = await supabase
        .from('users')
        .select('subscription_status')
        .eq('id', userId)
        .single();
      if (error) throw new Error(error.message);
      return (data?.subscription_status as SubscriptionStatus) ?? 'trial';
    },

    async getCustomerId(userId) {
      const { data, error } = await supabase
        .from('users')
        .select('stripe_customer_id')
        .eq('id', userId)
        .single();
      if (error) throw new Error(error.message);
      return data?.stripe_customer_id ?? null;
    },

    async createPortalSession(customerId) {
      return callEdgeFunction<{ url: string } | null>('ascension-api', {
        action: 'billing.createPortalSession',
        payload: { customer_id: customerId },
      });
    },
  };

  // ── Blocked Attempts ────────────────────────────────────────

  const blockedAttempts: AscensionAPI['blockedAttempts'] = {
    async log(data) {
      throwOnError(
        await supabase.from('blocked_attempts').insert({
          user_id: data.user_id,
          url: data.url,
          browser: data.browser,
          blocked_successfully: data.blocked_successfully,
        }),
      );
    },

    async getRecent(userId, limit = 20) {
      const { data, error } = await supabase
        .from('blocked_attempts')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []) as BlockedAttempt[];
    },
  };

  // ── Devices ─────────────────────────────────────────────────

  const devices: AscensionAPI['devices'] = {
    async register(data) {
      const { data: device, error } = await supabase
        .from('devices')
        .upsert(
          {
            user_id: data.user_id,
            platform: data.platform,
            device_name: data.device_name ?? null,
            push_token: data.push_token ?? null,
            app_version: data.app_version ?? null,
            last_heartbeat: new Date().toISOString(),
          },
          { onConflict: 'user_id,platform,device_name' },
        )
        .select()
        .single();
      if (error) throw new Error(error.message);
      return device as Device;
    },

    async heartbeat(deviceId) {
      throwOnError(
        await supabase
          .from('devices')
          .update({ last_heartbeat: new Date().toISOString() })
          .eq('id', deviceId),
      );
    },

    async updatePushToken(deviceId, token) {
      throwOnError(
        await supabase
          .from('devices')
          .update({ push_token: token })
          .eq('id', deviceId),
      );
    },

    async list(userId) {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .eq('user_id', userId)
        .order('last_heartbeat', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Device[];
    },

    async remove(deviceId) {
      throwOnError(await supabase.from('devices').delete().eq('id', deviceId));
    },
  };

  // ── Encouragements ─────────────────────────────────────────

  const encouragements: AscensionAPI['encouragements'] = {
    async send(data) {
      const { data: row, error } = await supabase
        .from('encouragements')
        .insert({
          from_user_id: data.from_user_id,
          to_user_id: data.to_user_id,
          message: data.message,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row as Encouragement;
    },

    async getForUser(userId) {
      const { data, error } = await supabase
        .from('encouragements')
        .select('*')
        .eq('to_user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Encouragement[];
    },

    async markRead(encouragementId) {
      throwOnError(
        await supabase
          .from('encouragements')
          .update({ read: true })
          .eq('id', encouragementId),
      );
    },

    async getUnreadCount(userId) {
      const { count, error } = await supabase
        .from('encouragements')
        .select('id', { count: 'exact', head: true })
        .eq('to_user_id', userId)
        .eq('read', false);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
  };

  // ── Return ──────────────────────────────────────────────────

  return {
    supabase,
    auth,
    users,
    screenshots,
    alerts,
    streaks,
    billing,
    blockedAttempts,
    devices,
    encouragements,
  };
}
