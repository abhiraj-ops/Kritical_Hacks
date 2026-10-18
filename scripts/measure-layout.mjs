import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(process.env.DEMO_URL ?? 'http://localhost:4173', { waitUntil: 'networkidle' });
await page.waitForSelector('.leaflet-container', { timeout: 60000 });
await page.locator('#live-map').scrollIntoViewIfNeeded();
await new Promise((r) => setTimeout(r, 2000));

const info = await page.evaluate(() => {
  const grid = document.querySelector('#live-map .grid');
  const kids = grid ? [...grid.children] : [];
  const mapBox = document.querySelector('#live-map .leaflet-container');
  return {
    docScrollW: document.documentElement.scrollWidth,
    viewportW: window.innerWidth,
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
    gridCols: grid ? getComputedStyle(grid).gridTemplateColumns : null,
    gridW: grid?.getBoundingClientRect().width,
    childWidths: kids.map((k) => Math.round(k.getBoundingClientRect().width)),
    mapW: mapBox ? Math.round(mapBox.getBoundingClientRect().width) : null,
    mapH: mapBox ? Math.round(mapBox.getBoundingClientRect().height) : null,
  };
});

console.log(JSON.stringify(info, null, 2));
await browser.close();