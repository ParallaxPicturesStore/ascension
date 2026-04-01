const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'http://localhost:8082';
const OUTPUT_DIR = path.join(__dirname, '../../test-screenshots/ally-web');
const SUPABASE_URL = 'https://flrllorqzmbztvtccvab.supabase.co';
const PROJECT_REF = 'flrllorqzmbztvtccvab';

const VIEWPORTS = [
  { name: '375x812', width: 375, height: 812 },
  { name: '360x800', width: 360, height: 800 },
  { name: '414x896', width: 414, height: 896 },
  { name: '768x1024', width: 768, height: 1024 },
];

const ROUTES = [
  { name: 'login', path: '/login', requiresAuth: false },
  { name: 'connect', path: '/connect', requiresAuth: true, noPartner: true },
  { name: 'home', path: '/', requiresAuth: true },
  { name: 'alerts', path: '/alerts', requiresAuth: true },
  { name: 'streak', path: '/streak', requiresAuth: true },
  { name: 'encourage', path: '/encourage', requiresAuth: true },
  { name: 'settings', path: '/settings', requiresAuth: true },
];

const MOCK_ALLY_USER_ID = '00000000-0000-0000-0000-000000000002';
const MOCK_MONITORED_USER_ID = '00000000-0000-0000-0000-000000000001';
const MOCK_EMAIL = 'partner@ascension.app';

function makeFakeSession() {
  return JSON.stringify({
    access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDIiLCJlbWFpbCI6InBhcnRuZXJAYXNjZW5zaW9uLmFwcCIsInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiaWF0IjoxOTAwMDAwMDAwLCJleHAiOjIwMDAwMDAwMDB9.fake',
    refresh_token: 'fake-refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: {
      id: MOCK_ALLY_USER_ID,
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

// Mock partner data (the monitored user)
const MOCK_PARTNER_DATA = {
  id: MOCK_MONITORED_USER_ID,
  name: 'Jamie',
  email: 'jamie@ascension.app',
  subscription_status: 'active',
  streak: {
    id: '00000000-0000-0000-0000-000000000010',
    user_id: MOCK_MONITORED_USER_ID,
    current_streak: 14,
    longest_streak: 21,
    last_clean_date: new Date().toISOString().split('T')[0],
    created_at: '2026-01-01T00:00:00.000Z',
  },
  recentAlerts: [
    {
      id: '00000000-0000-0000-0000-000000000020',
      user_id: MOCK_MONITORED_USER_ID,
      partner_id: MOCK_ALLY_USER_ID,
      type: 'content_detected',
      message: 'Potentially inappropriate content detected',
      read: false,
      timestamp: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: '00000000-0000-0000-0000-000000000021',
      user_id: MOCK_MONITORED_USER_ID,
      partner_id: MOCK_ALLY_USER_ID,
      type: 'attempted_access',
      message: 'Blocked site access attempt',
      read: true,
      timestamp: new Date(Date.now() - 86400000).toISOString(),
    },
  ],
};

const MOCK_ENCOURAGEMENTS = [
  {
    id: '00000000-0000-0000-0000-000000000030',
    from_user_id: MOCK_ALLY_USER_ID,
    to_user_id: MOCK_MONITORED_USER_ID,
    message: 'Proud of your 14-day streak! Keep going!',
    read: true,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
];

async function setupSupabaseMocks(context, hasPartner = true) {
  await context.route(`${SUPABASE_URL}/**`, async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    // Auth endpoints
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
          user: { id: MOCK_ALLY_USER_ID, email: MOCK_EMAIL, aud: 'authenticated', role: 'authenticated' },
        }),
      });
    }

    if (url.includes('/auth/v1/user')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: MOCK_ALLY_USER_ID, email: MOCK_EMAIL, aud: 'authenticated', role: 'authenticated' }),
      });
    }

    // Users table - the ally's own profile + partner lookups
    if (url.includes('/rest/v1/users')) {
      if (url.includes('select=partner_id')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ partner_id: hasPartner ? MOCK_MONITORED_USER_ID : null }),
          headers: { 'content-range': '0-0/1' },
        });
      }
      // Partner profile query
      if (url.includes(`eq.${MOCK_MONITORED_USER_ID}`) && url.includes('select=id')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: MOCK_MONITORED_USER_ID,
            name: 'Jamie',
            email: 'jamie@ascension.app',
            subscription_status: 'active',
          }),
          headers: { 'content-range': '0-0/1' },
        });
      }
      // Default user query
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: MOCK_ALLY_USER_ID,
          email: MOCK_EMAIL,
          name: 'Alex Partner',
          partner_id: hasPartner ? MOCK_MONITORED_USER_ID : null,
          subscription_status: 'active',
        }),
        headers: { 'content-range': '0-0/1' },
      });
    }

    // Streaks
    if (url.includes('/rest/v1/streaks')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PARTNER_DATA.streak),
        headers: { 'content-range': '0-0/1' },
      });
    }

    // Alerts
    if (url.includes('/rest/v1/alerts')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PARTNER_DATA.recentAlerts),
      });
    }

    // Screenshots
    if (url.includes('/rest/v1/screenshots')) {
      if (url.includes('count=exact')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
          headers: { 'content-range': '0-0/142' },
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }

    // Blocked attempts
    if (url.includes('/rest/v1/blocked_attempts')) {
      if (url.includes('count=exact')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
          headers: { 'content-range': '0-0/3' },
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    }

    // Encouragements
    if (url.includes('/rest/v1/encouragements')) {
      if (url.includes('count=exact')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
          headers: { 'content-range': '0-0/1' },
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ENCOURAGEMENTS),
      });
    }

    // Edge Functions
    if (url.includes('/functions/v1/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    }

    // Realtime
    if (url.includes('/realtime/')) {
      return route.abort();
    }

    console.log(`  [mock] Unhandled: ${method} ${url}`);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });
}

(async () => {
  const fs = require('fs');
  const browser = await chromium.launch({ headless: true });

  for (const vp of VIEWPORTS) {
    const dir = path.join(OUTPUT_DIR, vp.name);
    fs.mkdirSync(dir, { recursive: true });

    for (const route of ROUTES) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
      });

      if (route.requiresAuth) {
        const hasPartner = !route.noPartner;
        await setupSupabaseMocks(context, hasPartner);

        await context.addInitScript((args) => {
          const { projectRef, sessionData } = args;
          window.localStorage.setItem(`sb-${projectRef}-auth-token`, sessionData);
        }, {
          projectRef: PROJECT_REF,
          sessionData: makeFakeSession(),
        });
      }

      const page = await context.newPage();
      try {
        await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle', timeout: 20000 });
        await page.waitForTimeout(2500);

        // Fill in form fields so buttons show enabled (navy) state
        if (route.name === 'login') {
          await page.fill('input[placeholder="you@example.com"]', 'partner@ascension.app').catch(() => {});
          await page.fill('input[placeholder="Your password"]', 'password123').catch(() => {});
          await page.waitForTimeout(500);
        } else if (route.name === 'connect') {
          await page.fill('input[placeholder="Paste invite code here"]', 'ABC-123-XYZ').catch(() => {});
          await page.waitForTimeout(500);
        } else if (route.name === 'encourage') {
          await page.fill('textarea[placeholder="Type something encouraging..."]', 'You are doing great!').catch(() => {});
          await page.waitForTimeout(500);
        }

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
  console.log('\nDone! Screenshots saved to test-screenshots/ally-web/');
})();
