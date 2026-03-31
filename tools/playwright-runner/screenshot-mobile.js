const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'http://localhost:8081';
const OUTPUT_DIR = path.join(__dirname, '../../test-screenshots/mobile-web');

const VIEWPORTS = [
  { name: '375x812', width: 375, height: 812 },   // iPhone 13/14
  { name: '360x800', width: 360, height: 800 },   // Standard Android
  { name: '414x896', width: 414, height: 896 },   // iPhone 11 Pro Max
  { name: '768x1024', width: 768, height: 1024 }, // iPad Mini
];

const ROUTES = [
  { name: 'login', path: '/login' },
  { name: 'signup', path: '/signup' },
  { name: 'onboarding-step1', path: '/onboarding' },
  { name: 'onboarding-partner', path: '/onboarding/partner' },
  { name: 'onboarding-confirm', path: '/onboarding/confirm' },
  { name: 'dashboard', path: '/' },
  { name: 'settings', path: '/settings' },
  { name: 'pricing', path: '/pricing' },
];

(async () => {
  const fs = require('fs');

  const browser = await chromium.launch({ headless: true });

  for (const vp of VIEWPORTS) {
    const dir = path.join(OUTPUT_DIR, vp.name);
    fs.mkdirSync(dir, { recursive: true });

    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });

    for (const route of ROUTES) {
      const page = await context.newPage();
      try {
        await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle', timeout: 15000 });
        // Wait a bit for any animations/renders
        await page.waitForTimeout(2000);
        const file = path.join(dir, `${route.name}.png`);
        await page.screenshot({ path: file, fullPage: true });
        console.log(`✓ ${vp.name}/${route.name}.png`);
      } catch (err) {
        console.log(`✗ ${vp.name}/${route.name} - ${err.message.substring(0, 80)}`);
      }
      await page.close();
    }

    await context.close();
  }

  await browser.close();
  console.log('\nDone! Screenshots saved to test-screenshots/mobile-web/');
})();
