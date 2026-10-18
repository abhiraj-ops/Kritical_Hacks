/**
 * EcoPulse AI — automated demo recorder.
 *
 * Drives the LIVE Netlify site through the 2.5-minute hackathon storyboard and
 * records a real screencast with Playwright. Output is a .webm that scripts/
 * make-video.mjs converts to .mkv with burned-in captions.
 *
 *   node scripts/record-demo.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const URL = process.env.DEMO_URL ?? 'https://ecopulseaiapp.netlify.app';
const OUT = resolve(process.cwd(), 'video/raw');
const WIDTH = 1920;
const HEIGHT = 1080;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  recordVideo: { dir: OUT, size: { width: WIDTH, height: HEIGHT } },
  colorScheme: 'dark',
});

const page = await context.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

const log = (s) => console.log(`  ${s}`);

try {
  // ── SHOT 1 · Hook ─────────────────────────────────────────────── 0:00–0:14
  log('SHOT 1  hero + headline');
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForSelector('h1');
  await wait(4200);
  await page.mouse.move(WIDTH / 2, 420);
  await wait(3600);

  // ── SHOT 2 · Problem — scroll to command center ───────────────── 0:14–0:32
  log('SHOT 2  scroll to command center');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await wait(1400);
  await page.locator('#live-map').scrollIntoViewIfNeeded();
  await wait(3000);
  await page.mouse.move(WIDTH / 2, 500);
  await wait(3000);

  // ── SHOT 3 · Live map reveal ──────────────────────────────────── 0:32–0:58
  log('SHOT 3  map populating + clusters');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.leaflet-container', { timeout: 60000 });
  await wait(2800);
  await page.locator('#live-map').scrollIntoViewIfNeeded();
  await wait(3800);
  await page.mouse.move(820, 620);
  await wait(4000);

  log('SHOT 3b click a cluster');
  const cluster = page.locator('.marker-cluster').first();
  if (await cluster.count()) {
    await cluster.click({ force: true });
    await wait(4200);
  }

  log('SHOT 3c click a marker -> details panel');
  const marker = page.locator('.leaflet-marker-icon').first();
  if (await marker.count()) {
    await marker.click({ force: true });
    await wait(4400);
    await page.keyboard.press('Escape');
    await wait(2400);
  }

  // ── SHOT 4 · Region filter + URL ─────────────────────────────── 0:58–1:12
  log('SHOT 4  region chips + URL sync');
  for (const label of ['Mumbai', 'Chennai']) {
    const chip = page.locator(`#live-map .chip:text-is("${label}")`).first();
    if (await chip.count()) {
      await chip.click();
      await wait(4200);
    }
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await wait(2200);

  // ── SHOT 5 · TinyFish agent (MONEY SHOT) ─────────────────────── 1:12–1:44
  log('SHOT 5  run TinyFish agent');
  await page.locator('#live-map').scrollIntoViewIfNeeded();
  await wait(2000);
  const agentBtn = page.locator('button:has-text("Run TinyFish Web Agent")').first();
  let agentRan = false;
  if (await agentBtn.count()) {
    await agentBtn.click();
    agentRan = true;
    await wait(4000);
    // hold on the stage progression — the money shot
    for (let i = 0; i < 19; i++) {
      await wait(2300);
    }
  } else {
    log('  ! agent button not found');
  }
  log(`  agent clicked=${agentRan}`);

  // ── SHOT 6 · Triage log ───────────────────────────────────────── 1:44–2:04
  log('SHOT 6  triage table: sort, filter, search, csv');
  await page.locator('#triage-log').scrollIntoViewIfNeeded();
  await wait(2800);
  const sevHeader = page.locator('#triage-log thead th button:has-text("Severity")').first();
  if (await sevHeader.count()) {
    await sevHeader.click();
    await wait(2200);
  }
  const sevSelect = page.locator('#triage-log select').first();
  if (await sevSelect.count()) {
    await sevSelect.selectOption('critical');
    await wait(2200);
    await sevSelect.selectOption('all');
    await wait(1800);
  }
  const search = page.locator('#triage-log input[type="search"]').first();
  if (await search.count()) {
    await search.fill('storm');
    await wait(3600);
    await search.fill('');
    await wait(2800);
  }

  // ── SHOT 7 · Themes ───────────────────────────────────────────── 2:04–2:18
  log('SHOT 7  theme switcher + persistence');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await wait(3000);
  const themeBtn = page.locator('header button[aria-haspopup="true"]').first();
  if (await themeBtn.count()) {
    await themeBtn.click();
    await wait(1800);
    for (const t of ['Frost', 'Graphite']) {
      const opt = page.locator(`[role="radio"]:has-text("${t}")`).first();
      if (await opt.count()) {
        await opt.click();
        await wait(2800);
      }
    }
    // F5 — theme must survive
    log('SHOT 7b reload — theme persistence');
    await page.reload({ waitUntil: 'networkidle' });
    await wait(3400);
  }

  // ── SHOT 8 · Sources (provenance) ─────────────────────────────── 2:18–2:32
  log('SHOT 8  connected data sources');
  await page.locator('#sources').scrollIntoViewIfNeeded();
  await wait(4200);
  await page.evaluate(() => document.querySelectorAll('#sources .badge').forEach((b) => b.scrollIntoView({ block: 'center' })));
  await wait(3400);

  // ── SHOT 9 · Close ────────────────────────────────────────────── 2:32–2:48
  log('SHOT 9  future scope + close');
  await page.locator('#future').scrollIntoViewIfNeeded();
  await wait(4400);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await wait(4400);
} catch (err) {
  console.error('  RECORD ERROR:', err.message);
} finally {
  const video = page.video();
  await page.close();
  if (video) {
    const p = await video.path();
    console.log('\n  raw video:', p);
  }
  await context.close();
  await browser.close();
}

console.log(`\n  console errors: ${errors.length}`);
errors.slice(0, 5).forEach((e) => console.log('   -', e.slice(0, 120)));