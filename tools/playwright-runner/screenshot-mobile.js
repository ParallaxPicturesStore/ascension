const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'http://localhost:8081';
const OUTPUT_DIR = path.join(__dirname, '../../test-screenshots/mobile-web');
const SUPABASE_URL = 'https://flrllorqzmbztvtccvab.supabase.co';
const PROJECT_REF = 'flrllorqzmbztvtccvab';

const VIEWPORTS = [
  { name: '375x812', width: 375, height: 812 },   // iPhone 13/14
  { name: '360x800', width: 360, height: 800 },   // Standard Android
  { name: '414x896', width: 414, height: 896 },   // iPhone 11 Pro Max
  { name: '768x1024', width: 768, height: 1024 }, // iPad Mini
];

const ROUTES = [
  { name: 'login', path: '/login', requiresAuth: false },
  { name: 'signup', path: '/signup', requiresAuth: false },
  { name: 'onboarding-step1', path: '/onboarding', requiresAuth: true, needsOnboarding: true },
  { name: 'onboarding-partner', path: '/onboarding/partner', requiresAuth: true, needsOnboarding: true },
  { name: 'onboarding-confirm', path: '/onboarding/confirm', requiresAuth: true, needsOnboarding: true },
  { name: 'dashboard', path: '/', requiresAuth: true },
  { name: 'settings', path: '/settings', requiresAuth: true },
  { name: 'pricing', path: '/pricing', requiresAuth: true },
];

// Mock user data
const MOCK_USER_ID = '00000000-0000-0000-0000-000000000001';
const MOCK_EMAIL = 'test@ascension.app';

// Fake Supabase session that will be injected into localStorage
function makeFakeSession(needsOnboarding = false) {
  return JSON.stringify({
    access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJlbWFpbCI6InRlc3RAYXNjZW5zaW9uLmFwcCIsInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiaWF0IjoxOTAwMDAwMDAwLCJleHAiOjIwMDAwMDAwMDB9.fake',
    refresh_token: 'fake-refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: {
      id: MOCK_USER_ID,
      email: MOCK_EMAIL,
      aud: 'authenticated',
      role: 'authenticated',
      email_confirmed_at: '2026-01-01T00:00:00.000Z',
      app_metadata: { provider: 'email' },
      user_metadata: {},
      created_at: '2026-01-01T00:00:00.000Z',
    },
  });
}

// Mock profile - complete (for dashboard/settings/pricing)
const MOCK_PROFILE_COMPLETE = {
  id: MOCK_USER_ID,
  email: MOCK_EMAIL,
  name: 'Jamie Test',
  partner_id: null,
  partner_email: null,
  subscription_status: 'trial',
  created_at: '2026-01-01T00:00:00.000Z',
};

// Mock profile - incomplete (for onboarding screens)
const MOCK_PROFILE_INCOMPLETE = {
  id: MOCK_USER_ID,
  email: MOCK_EMAIL,
  name: null,
  partner_id: null,
  partner_email: null,
  subscription_status: 'trial',
  created_at: '2026-01-01T00:00:00.000Z',
};

// Mock streak data
const MOCK_STREAK = {
  id: '00000000-0000-0000-0000-000000000010',
  user_id: MOCK_USER_ID,
  current_streak: 14,
  longest_streak: 21,
  last_clean_date: new Date().toISOString().split('T')[0],
  created_at: '2026-01-01T00:00:00.000Z',
};

// Mock weekly stats
const MOCK_WEEKLY_STATS = {
  screenshotCount: 142,
  blockedCount: 3,
  flaggedCount: 1,
};

// Mock screenshot stats
const MOCK_SCREENSHOT_STATS = {
  totalCaptures: 1423,
  flaggedCount: 7,
  lastCaptureTime: new Date().toISOString(),
};

async function setupSupabaseMocks(context, needsOnboarding = false) {
  // Intercept ALL Supabase REST/Auth API calls
  await context.route(`${SUPABASE_URL}/**`, async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    // Auth: getSession / token refresh
    if (url.includes('/auth/v1/token')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'fake-access-token',
          refresh_token: 'fake-refresh-token',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          token_type: 'bearer',
          user: {
            id: MOCK_USER_ID,
            email: MOCK_EMAIL,
            aud: 'authenticated',
            role: 'authenticated',
          },
        }),
      });
    }

    // Auth: getUser
    if (url.includes('/auth/v1/user')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: MOCK_USER_ID,
          email: MOCK_EMAIL,
          aud: 'authenticated',
          role: 'authenticated',
          email_confirmed_at: '2026-01-01T00:00:00.000Z',
        }),
      });
    }

    // REST: users table queries
    if (url.includes('/rest/v1/users')) {
      const profile = needsOnboarding ? MOCK_PROFILE_INCOMPLETE : MOCK_PROFILE_COMPLETE;
      // Check if it's asking for specific fields
      if (url.includes('select=partner_id')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ partner_id: null }),
          headers: { 'content-range': '0-0/1' },
        });
      }
      if (url.includes('select=subscription_status')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ subscription_status: 'trial' }),
          headers: { 'content-range': '0-0/1' },
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(profile),
        headers: { 'content-range': '0-0/1' },
      });
    }

    // REST: streaks
    if (url.includes('/rest/v1/streaks')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_STREAK),
        headers: { 'content-range': '0-0/1' },
      });
    }

    // REST: screenshots
    if (url.includes('/rest/v1/screenshots')) {
      if (method === 'HEAD' || url.includes('head=true') || url.includes('count=exact')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
          headers: { 'content-range': '0-0/7' },
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }

    // REST: alerts
    if (url.includes('/rest/v1/alerts')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }

    // REST: blocked_attempts
    if (url.includes('/rest/v1/blocked_attempts')) {
      if (method === 'HEAD' || url.includes('count=exact')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
          headers: { 'content-range': '0-0/3' },
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }

    // REST: devices
    if (url.includes('/rest/v1/devices')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }

    // REST: encouragements
    if (url.includes('/rest/v1/encouragements')) {
      if (url.includes('count=exact')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
          headers: { 'content-range': '0-0/0' },
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }

    // Edge Functions
    if (url.includes('/functions/v1/')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    }

    // Realtime websocket - just let it fail silently
    if (url.includes('/realtime/')) {
      return route.abort();
    }

    // Fallback - return empty success
    console.log(`  [mock] Unhandled Supabase request: ${method} ${url}`);
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });
}

(async () => {
  const fs = require('fs');
  const browser = await chromium.launch({ headless: true });

  for (const vp of VIEWPORTS) {
    const dir = path.join(OUTPUT_DIR, vp.name);
    fs.mkdirSync(dir, { recursive: true });

    for (const route of ROUTES) {
      const needsOnboarding = route.needsOnboarding || false;

      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
      });

      // Set up API mocks for authenticated routes
      if (route.requiresAuth) {
        await setupSupabaseMocks(context, needsOnboarding);

        // Inject fake session into localStorage before any page loads
        await context.addInitScript((args) => {
          const { projectRef, sessionData } = args;
          const key = `sb-${projectRef}-auth-token`;
          window.localStorage.setItem(key, sessionData);
        }, {
          projectRef: PROJECT_REF,
          sessionData: makeFakeSession(needsOnboarding),
        });
      }

      const page = await context.newPage();
      try {
        await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle', timeout: 20000 });
        await page.waitForTimeout(2500);
        const file = path.join(dir, `${route.name}.png`);
        await page.screenshot({ path: file, fullPage: true });
        console.log(`✓ ${vp.name}/${route.name}.png`);
      } catch (err) {
        console.log(`✗ ${vp.name}/${route.name} - ${err.message.substring(0, 100)}`);
      }
      await page.close();
      await context.close();
    }
  }

  await browser.close();
  console.log('\nDone! Screenshots saved to test-screenshots/mobile-web/');
})();
