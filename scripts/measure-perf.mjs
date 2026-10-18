import { chromium } from 'playwright';

const URL = process.env.DEMO_URL ?? 'https://ecopulseaiapp.netlify.app';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

console.log('--- load ---');
const t0 = Date.now();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('.leaflet-container', { timeout: 60000 });
await page.locator('#live-map').scrollIntoViewIfNeeded();
console.log(`  ready in ${Date.now() - t0} ms`);

const stats = await page.evaluate(() => {
  const count = (sel) => document.querySelectorAll(sel).length;
  return {
    domNodes: document.getElementsByTagName('*').length,
    feedButtons: count('#live-map .feed-track button'),
    feedItems: count('#live-map .feed-track button') / 2,
    tableRows: count('#triage-log tbody tr'),
    leafletMarkers: count('.leaflet-marker-icon'),
    heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
  };
});
console.log('--- DOM ---');
Object.entries(stats).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

// interaction latency
console.log('--- interaction latency ---');
const regions = ['Mumbai', 'Chennai', 'Delhi-NCR', 'Global'];
for (const r of regions) {
  const start = Date.now();
  await page.locator(`#live-map .chip:text-is("${r}")`).first().click();
  await page.waitForFunction(
    (label) => document.querySelector('#live-map h2')?.textContent?.startsWith(label),
    r.replace('-NCR', '-NCR').replace('Global', 'Global'),
    { timeout: 15000 },
  ).catch(() => {});
  console.log(`  chip "${r}": ${Date.now() - start} ms`);
}

console.log('--- theme switch latency ---');
for (const t of ['Frost', 'Graphite', 'Midnight']) {
  const start = Date.now();
  await page.locator('header button[aria-haspopup="true"]').click();
  await page.locator(`[role="radio"]:has-text("${t}")`).click();
  console.log(`  theme "${t}": ${Date.now() - start} ms`);
}

console.log('--- heap after interaction ---');
const heap = await page.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null));
console.log(`  ${heap} MB`);
console.log(`\nconsole errors: ${errors.length}`);
errors.slice(0, 4).forEach((e) => console.log('  -', e.slice(0, 140)));

await browser.close();