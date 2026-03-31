-- Ascension Database Schema
-- Run this in your Supabase SQL editor

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  partner_id UUID REFERENCES public.users(id),
  partner_email TEXT,
  stripe_customer_id TEXT,
  subscription_status TEXT DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'cancelled', 'expired')),
  goals TEXT,
  partner_password_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Screenshots table
CREATE TABLE IF NOT EXISTS public.screenshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  file_path TEXT,
  rekognition_score REAL DEFAULT 0,
  flagged BOOLEAN DEFAULT FALSE,
  reviewed BOOLEAN DEFAULT FALSE,
  labels TEXT[],
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alerts table
CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.users(id),
  type TEXT NOT NULL CHECK (type IN ('attempted_access', 'content_detected', 'evasion')),
  message TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  read BOOLEAN DEFAULT FALSE
);

-- Blocked attempts table
CREATE TABLE IF NOT EXISTS public.blocked_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  browser TEXT,
  blocked_successfully BOOLEAN DEFAULT TRUE
);

-- Streaks table
CREATE TABLE IF NOT EXISTS public.streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_relapse_date TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_screenshots_user_id ON public.screenshots(user_id);
CREATE INDEX IF NOT EXISTS idx_screenshots_flagged ON public.screenshots(user_id, flagged) WHERE flagged = TRUE;
CREATE INDEX IF NOT EXISTS idx_alerts_partner_id ON public.alerts(partner_id);
CREATE INDEX IF NOT EXISTS idx_alerts_unread ON public.alerts(partner_id, read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_blocked_attempts_user ON public.blocked_attempts(user_id);

-- Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screenshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY "Users can read own data" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own data
CREATE POLICY "Users can update own data" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own record
CREATE POLICY "Users can insert own record" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Partners can read their partner's data
CREATE POLICY "Partners can read partner data" ON public.users
  FOR SELECT USING (auth.uid() = partner_id);

-- Screenshots: user and partner can read
CREATE POLICY "User can read own screenshots" ON public.screenshots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Partner can read screenshots" ON public.screenshots
  FOR SELECT USING (
    auth.uid() IN (
      SELECT partner_id FROM public.users WHERE id = user_id
    )
  );

CREATE POLICY "User can insert screenshots" ON public.screenshots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Alerts: partner can read, user can insert
CREATE POLICY "Partner can read alerts" ON public.alerts
  FOR SELECT USING (auth.uid() = partner_id);

CREATE POLICY "User can read own alerts" ON public.alerts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "User can insert alerts" ON public.alerts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Partner can update alerts" ON public.alerts
  FOR UPDATE USING (auth.uid() = partner_id);

-- Blocked attempts: same pattern
CREATE POLICY "User can manage blocked attempts" ON public.blocked_attempts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Partner can read blocked attempts" ON public.blocked_attempts
  FOR SELECT USING (
    auth.uid() IN (
      SELECT partner_id FROM public.users WHERE id = user_id
    )
  );

-- Streaks: user and partner can read
CREATE POLICY "User can manage own streak" ON public.streaks
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Partner can read streak" ON public.streaks
  FOR SELECT USING (
    auth.uid() IN (
      SELECT partner_id FROM public.users WHERE id = user_id
    )
  );

-- Function to auto-create user record on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);

  INSERT INTO public.streaks (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
