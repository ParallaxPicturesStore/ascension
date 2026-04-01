const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://127.0.0.1:9876';
const OUTPUT_DIR = path.join(__dirname, '../../test-screenshots/windows-desktop');

const RESOLUTIONS = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1280x800', width: 1280, height: 800 },
];

// Desktop app is 440x720 fixed window, but we screenshot the pages at desktop viewports
const ROUTES = [
  { name: 'login', path: '/login' },
  { name: 'signup', path: '/signup' },
  { name: 'onboarding', path: '/onboarding' },
  { name: 'onboarding-partner', path: '/onboarding/partner' },
  { name: 'onboarding-confirm', path: '/onboarding/confirm' },
  { name: 'dashboard', path: '/' },
  { name: 'settings', path: '/settings' },
  { name: 'pricing', path: '/pricing' },
  { name: 'partner', path: '/partner' },
  { name: 'locked', path: '/locked' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });

  for (const res of RESOLUTIONS) {
    const dir = path.join(OUTPUT_DIR, res.name);
    fs.mkdirSync(dir, { recursive: true });

    for (const route of ROUTES) {
      const context = await browser.newContext({
        viewport: { width: res.width, height: res.height },
        deviceScaleFactor: 1,
      });

      const page = await context.newPage();
      try {
        await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(1500);
        const file = path.join(dir, `${route.name}.png`);
        await page.screenshot({ path: file, fullPage: true });
        console.log(`✓ ${res.name}/${route.name}.png`);
      } catch (err) {
        console.log(`✗ ${res.name}/${route.name} - ${err.message.substring(0, 80)}`);
      }
      await page.close();
      await context.close();
    }
  }

  await browser.close();
  console.log('\nDone! Screenshots saved to test-screenshots/windows-desktop/');
})();
