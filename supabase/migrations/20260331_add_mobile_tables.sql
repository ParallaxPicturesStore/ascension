-- ============================================================
-- Migration: Add mobile support tables + missing user columns
-- Date: 2026-03-31
-- ============================================================

-- ── Add missing columns to users (used by subscription.js but not in original schema) ──

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS subscription_lapse_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lapse_reminders_sent TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS app_disabled BOOLEAN DEFAULT FALSE;

-- ── Devices table ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.devices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('windows', 'macos', 'ios', 'android')),
  device_name TEXT,
  push_token TEXT,
  last_heartbeat TIMESTAMPTZ,
  app_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_user_id ON public.devices(user_id);

-- Unique constraint for upsert (one record per user+platform+device_name)
CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_user_platform_name
  ON public.devices(user_id, platform, device_name);

-- ── Encouragements table (Ally app) ──────────────────────────

CREATE TABLE IF NOT EXISTS public.encouragements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id UUID NOT NULL REFERENCES auth.users(id),
  to_user_id UUID NOT NULL REFERENCES auth.users(id),
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_encouragements_to_user ON public.encouragements(to_user_id);
CREATE INDEX IF NOT EXISTS idx_encouragements_unread
  ON public.encouragements(to_user_id, read) WHERE read = FALSE;

-- ── RLS: Devices ──────────────────────────────────────────────

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- Users can manage their own devices
CREATE POLICY "User can manage own devices" ON public.devices
  FOR ALL USING (auth.uid() = user_id);

-- Partners can see device list (to know if monitoring is active)
CREATE POLICY "Partner can read devices" ON public.devices
  FOR SELECT USING (
    auth.uid() IN (
      SELECT partner_id FROM public.users WHERE id = user_id
    )
  );

-- ── RLS: Encouragements ──────────────────────────────────────

ALTER TABLE public.encouragements ENABLE ROW LEVEL SECURITY;

-- Users can read encouragements sent TO them
CREATE POLICY "User can read own encouragements" ON public.encouragements
  FOR SELECT USING (auth.uid() = to_user_id);

-- Users can insert encouragements they send (from_user_id must match)
CREATE POLICY "User can send encouragements" ON public.encouragements
  FOR INSERT WITH CHECK (auth.uid() = from_user_id);

-- Users can mark their received encouragements as read
CREATE POLICY "User can update own encouragements" ON public.encouragements
  FOR UPDATE USING (auth.uid() = to_user_id);

-- Senders can read their own sent encouragements
CREATE POLICY "User can read sent encouragements" ON public.encouragements
  FOR SELECT USING (auth.uid() = from_user_id);
