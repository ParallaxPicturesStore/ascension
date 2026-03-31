/**
 * Tests for the Ascension API client.
 *
 * We mock `@supabase/supabase-js` so no real network calls are made.
 * The goal is to verify that createApiClient() wires up the correct
 * Supabase queries and propagates errors properly.
 */

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------

const mockSingle = jest.fn();
const mockLimit = jest.fn(() => ({ data: [], error: null, single: mockSingle }));
const mockGte = jest.fn(() => ({ data: [], error: null, limit: mockLimit, single: mockSingle }));
const mockOrder = jest.fn(() => ({ data: [], error: null, limit: mockLimit, gte: mockGte }));
const mockEq = jest.fn(() => ({
  data: null,
  error: null,
  single: mockSingle,
  order: mockOrder,
  eq: mockEq,
  limit: mockLimit,
  gte: mockGte,
}));
const mockSelect = jest.fn(() => ({
  eq: mockEq,
  order: mockOrder,
  single: mockSingle,
  data: [],
  error: null,
}));
const mockInsert = jest.fn(() => ({
  select: mockSelect,
  data: null,
  error: null,
  single: mockSingle,
}));
const mockUpdate = jest.fn(() => ({ eq: mockEq, data: null, error: null }));
const mockDelete = jest.fn(() => ({ eq: mockEq, data: null, error: null }));
const mockUpsert = jest.fn(() => ({ select: mockSelect, data: null, error: null }));

const mockFrom = jest.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
  upsert: mockUpsert,
}));

const mockSignUp = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockSignOut = jest.fn();
const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn(() => ({
  data: { subscription: { unsubscribe: jest.fn() } },
}));

const mockSupabaseClient = {
  from: mockFrom,
  auth: {
    signUp: mockSignUp,
    signInWithPassword: mockSignInWithPassword,
    signOut: mockSignOut,
    getSession: mockGetSession,
    onAuthStateChange: mockOnAuthStateChange,
  },
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

// Also mock global fetch for Edge Function calls
global.fetch = jest.fn() as jest.Mock;

import { createApiClient } from '../client';

const api = createApiClient({
  supabaseUrl: 'https://test.supabase.co',
  supabaseAnonKey: 'test-anon-key',
});

beforeEach(() => {
  jest.clearAllMocks();
  // Default session for edge function calls
  mockGetSession.mockResolvedValue({
    data: { session: { access_token: 'test-token' } },
  });
});

// ---------------------------------------------------------------------------
// Namespace existence
// ---------------------------------------------------------------------------

describe('createApiClient namespaces', () => {
  it('returns an object with a supabase property', () => {
    expect(api.supabase).toBeDefined();
  });

  it('returns all expected namespace keys', () => {
    const expectedKeys = [
      'supabase',
      'auth',
      'users',
      'screenshots',
      'alerts',
      'streaks',
      'billing',
      'blockedAttempts',
      'devices',
      'encouragements',
    ];
    for (const key of expectedKeys) {
      expect(api).toHaveProperty(key);
    }
  });

  it('auth namespace has all expected methods', () => {
    expect(typeof api.auth.signUp).toBe('function');
    expect(typeof api.auth.signIn).toBe('function');
    expect(typeof api.auth.signOut).toBe('function');
    expect(typeof api.auth.getSession).toBe('function');
    expect(typeof api.auth.onAuthStateChange).toBe('function');
  });

  it('users namespace has all expected methods', () => {
    expect(typeof api.users.getProfile).toBe('function');
    expect(typeof api.users.updateProfile).toBe('function');
    expect(typeof api.users.getPartnerData).toBe('function');
    expect(typeof api.users.setQuitPassword).toBe('function');
    expect(typeof api.users.getQuitPasswordHash).toBe('function');
  });

  it('streaks namespace has all expected methods', () => {
    expect(typeof api.streaks.get).toBe('function');
    expect(typeof api.streaks.reset).toBe('function');
    expect(typeof api.streaks.increment).toBe('function');
    expect(typeof api.streaks.getWeeklyStats).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Auth calls
// ---------------------------------------------------------------------------

describe('auth.signUp', () => {
  it('calls supabase.auth.signUp with email and password', async () => {
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: 'u1', email: 'a@b.com' },
        session: { access_token: 't', refresh_token: 'r', expires_at: 0, user: { id: 'u1', email: 'a@b.com' } },
      },
      error: null,
    });

    const result = await api.auth.signUp('a@b.com', 'pw123');
    expect(mockSignUp).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pw123' });
    expect(result.user).toEqual({ id: 'u1', email: 'a@b.com' });
    expect(result.error).toBeNull();
  });

  it('returns error message when signup fails', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Email taken' },
    });

    const result = await api.auth.signUp('a@b.com', 'pw123');
    expect(result.error).toBe('Email taken');
    expect(result.user).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Supabase query calls
// ---------------------------------------------------------------------------

describe('users.getProfile', () => {
  it('queries the users table with the correct userId', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'u1', email: 'a@b.com', name: 'Test' },
      error: null,
    });

    await api.users.getProfile('u1');
    expect(mockFrom).toHaveBeenCalledWith('users');
    expect(mockSelect).toHaveBeenCalledWith('*');
    expect(mockEq).toHaveBeenCalledWith('id', 'u1');
  });

  it('throws when Supabase returns an error', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    });

    await expect(api.users.getProfile('bad-id')).rejects.toThrow('Not found');
  });
});

describe('alerts.getForPartner', () => {
  it('queries alerts table filtered by partner_id', async () => {
    mockOrder.mockReturnValue({ data: [], error: null });

    await api.alerts.getForPartner('p1');
    expect(mockFrom).toHaveBeenCalledWith('alerts');
    expect(mockEq).toHaveBeenCalledWith('partner_id', 'p1');
  });
});

describe('alerts.markRead', () => {
  it('updates the alert read flag', async () => {
    mockEq.mockReturnValue({ data: null, error: null });

    await api.alerts.markRead('alert-1');
    expect(mockFrom).toHaveBeenCalledWith('alerts');
    expect(mockUpdate).toHaveBeenCalledWith({ read: true });
    expect(mockEq).toHaveBeenCalledWith('id', 'alert-1');
  });
});

// ---------------------------------------------------------------------------
// Edge Function calls
// ---------------------------------------------------------------------------

describe('streaks.reset (edge function)', () => {
  it('calls the ascension-api edge function with action streaks.reset', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 's1', user_id: 'u1', current_streak: 0, longest_streak: 10 }),
    });

    await api.streaks.reset('u1');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://test.supabase.co/functions/v1/ascension-api',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'streaks.reset', payload: { user_id: 'u1' } }),
      }),
    );
  });

  it('throws when edge function returns non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    await expect(api.streaks.reset('u1')).rejects.toThrow(
      'Edge Function ascension-api failed (500): Internal Server Error',
    );
  });
});

// ---------------------------------------------------------------------------
// Error propagation
// ---------------------------------------------------------------------------

describe('error handling', () => {
  it('auth.signOut throws on Supabase error', async () => {
    mockSignOut.mockResolvedValue({ error: { message: 'Session expired' } });
    await expect(api.auth.signOut()).rejects.toThrow('Session expired');
  });

  it('blockedAttempts.getRecent throws on Supabase error', async () => {
    mockLimit.mockReturnValue({ data: null, error: { message: 'DB down' } });

    await expect(api.blockedAttempts.getRecent('u1')).rejects.toThrow('DB down');
  });
});
