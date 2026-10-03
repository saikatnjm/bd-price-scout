// End-to-end check of a running BD Price Scout instance (normally the Docker dev container).
// Runs inside the official Playwright container (see .github/workflows/qa.yml); writes
// report.json and screenshots to OUT_DIR. Makes real Othoba requests: a few searches plus a
// handful of product pages for comparison. Not part of the normal CI run.
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.env.OUT_DIR ?? "out";
const ALLOWED_IMAGE_HOSTS = new Set(["images.othoba.com", "othoba.com"]);
mkdirSync(OUT, { recursive: true });

const report = { base: BASE, startedAt: new Date().toISOString(), api: [], errors: [], ui: [], links: [], failures: [] };
const fail = (msg) => report.failures.push(msg);

async function api(body, { raw = false, method = "POST" } = {}) {
  const started = Date.now();
  const res = await fetch(`${BASE}/api/search`, {
    method,
    headers: { "content-type": "application/json" },
    body: method === "GET" ? undefined : raw ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: res.status, ms: Date.now() - started, json, text: text.slice(0, 300) };
}

const brief = (o) => ({
  title: o.title,
  brand: o.brand,
  price: o.price,
  regular: o.regularPrice,
  availability: o.availability,
  pack: o.pack,
  variant: o.variant,
  image: o.imageUrl,
  url: o.url,
});

// 1. Real searches through the API.
const QUERIES = [
  "detergent",
  "rice",
  "shampoo",
  "soap",
  "tissue",
  "cooking oil",
  "soybean oil 5 ltr",
  "fresh soybean oil 1 ltr",
  "chinigura rice 1kg",
  "mr noodles 8 pcs",
  "himalaya shampoo",
  "lux soap",
  "dettol handwash",
  "rice", // repeated search
];
const offersSeen = [];
for (const q of QUERIES) {
  const r = await api({ query: q });
  const d = r.json ?? {};
  const entry = {
    query: q,
    status: r.status,
    ms: r.ms,
    stores: d.stores,
    results: d.results?.length,
    groups: d.groups?.length,
    multiOfferGroups: d.groups?.filter((g) => g.offers.length > 1).map((g) => ({ title: g.title, basis: g.matchBasis, offers: g.offers.map((o) => o.title) })),
    offers: (d.results ?? []).map(brief),
  };
  report.api.push(entry);
  if (r.status !== 200) fail(`search "${q}" -> HTTP ${r.status}`);
  for (const o of d.results ?? []) {
    offersSeen.push(o);
    if (o.imageUrl && !ALLOWED_IMAGE_HOSTS.has(new URL(o.imageUrl).hostname)) fail(`untrusted image host ${o.imageUrl}`);
    if (!/^https:\/\/(www\.)?othoba\.com\//.test(o.url)) fail(`unexpected product URL ${o.url}`);
    if (o.price !== null && !(o.price > 0)) fail(`bad price ${o.price} for ${o.title}`);
  }
}

// 2. Error handling through the API.
const ERROR_CASES = [
  ["empty", { query: "" }],
  ["whitespace", { query: "    " }],
  ["one char", { query: "a" }],
  ["too long", { query: "x".repeat(121) }],
  ["html", { query: "<script>alert(1)</script>" }],
  ["symbols", { query: "!!!@@@###" }],
  ["bangla", { query: "চাল" }],
  ["no result", { query: "zzqqxx nonexistent product" }],
  ["not a string", { query: 42 }],
];
for (const [name, body] of ERROR_CASES) {
  const r = await api(body);
  report.errors.push({ name, status: r.status, ms: r.ms, body: r.text });
  if (r.status >= 500) fail(`error case ${name} -> HTTP ${r.status}`);
}
for (const [name, r] of [
  ["invalid json", await api("{bad", { raw: true })],
  ["huge body", await api(JSON.stringify({ query: "rice", pad: "x".repeat(5000) }), { raw: true })],
  ["GET", await api(null, { method: "GET" })],
]) {
  report.errors.push({ name, status: r.status, body: r.text });
  if (r.status >= 500) fail(`error case ${name} -> HTTP ${r.status}`);
}

// 3. UI at three viewports.
const browser = await chromium.launch();
const VIEWPORTS = { desktop: { width: 1280, height: 900 }, tablet: { width: 820, height: 1180 }, mobile: { width: 390, height: 844 } };
for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  const page = await browser.newPage({ viewport });
  const consoleErrors = [];
  const imageHosts = new Set();
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on("request", (r) => r.resourceType() === "image" && imageHosts.add(new URL(r.url()).hostname));

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/${name}-1-home.png`, fullPage: true });

  // Keyboard only: tab to the search box, type, press Enter.
  await page.keyboard.press("Tab");
  const focusedId = await page.evaluate(() => document.activeElement?.id);
  await page.keyboard.type("soybean oil 5 ltr");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/${name}-2-loading.png` });
  await page
    .locator('[data-testid="product-group"]')
    .or(page.locator('main [role="alert"]'))
    .or(page.locator("main").getByText("No products found"))
    .first()
    .waitFor({ timeout: 30000 });
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${OUT}/${name}-3-results.png`, fullPage: true });

  const images = await page.$$eval('[data-testid="product-group"] img', (imgs) =>
    imgs.map((i) => ({ src: i.currentSrc, loaded: i.complete && i.naturalWidth > 0 })),
  );
  const placeholders = await page.locator('[data-testid="product-group"] [aria-label="No image available"], [data-testid="product-group"] [data-image-fallback]').count();
  const groups = await page.locator('[data-testid="product-group"]').count();
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  const lowestBadges = await page.getByText("Lowest price").count();

  // Focus ring on the first product link.
  let linkFocus;
  const firstLink = page.locator("main a").first();
  if ((await firstLink.count()) > 0) {
    await firstLink.focus();
    linkFocus = await firstLink.evaluate((el) => {
      const s = getComputedStyle(el);
      return { outline: `${s.outlineStyle} ${s.outlineWidth}`, boxShadow: s.boxShadow, target: el.getAttribute("target"), rel: el.getAttribute("rel"), label: el.textContent };
    });
    await page.screenshot({ path: `${OUT}/${name}-4-link-focus.png` });
  }

  report.ui.push({ viewport: name, focusedId, groups, images, placeholders, overflowX, lowestBadges, linkFocus, consoleErrors, imageHosts: [...imageHosts] });
  if (focusedId !== "search-query") fail(`${name}: first Tab did not focus the search box (${focusedId})`);
  if (overflowX) fail(`${name}: horizontal overflow`);
  if (groups === 0) fail(`${name}: no results rendered`);
  if (images.length + placeholders !== groups) fail(`${name}: ${groups} groups but ${images.length} images + ${placeholders} placeholders`);
  if (lowestBadges > 0) fail(`${name}: "Lowest price" shown with a single store`);
  for (const h of imageHosts) if (!ALLOWED_IMAGE_HOSTS.has(h) && h !== new URL(BASE).hostname) fail(`${name}: image from ${h}`);
  for (const e of consoleErrors) if (!/Failed to load resource: the server responded with a status of 403/.test(e)) fail(`${name}: console error ${e}`);
  await page.close();
}

// 4. UI states: empty input, broken images, network failure, no results.
{
  const page = await browser.newPage({ viewport: VIEWPORTS.mobile });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.locator('main button[type="submit"]').click();
  const emptyMsg = await page.locator('main [role="alert"]').textContent().catch(() => null);
  await page.fill("#search-query", "    ");
  await page.keyboard.press("Enter");
  const wsMsg = await page.locator('main [role="alert"]').textContent().catch(() => null);
  await page.screenshot({ path: `${OUT}/state-empty.png` });

  await page.route(/\.(png|jpe?g|webp|gif)(\?|$)/i, (r) => r.fulfill({ status: 404, body: "" }));
  await page.fill("#search-query", "detergent");
  await page.keyboard.press("Enter");
  await page.waitForSelector('[data-testid="product-group"], [role="alert"]', { timeout: 30000 });
  await page.waitForTimeout(500);
  const brokenImgs = await page.$$eval('[data-testid="product-group"] img', (imgs) => imgs.length);
  const brokenPlaceholders = await page.locator('[aria-label="No image available"], [data-image-fallback]').count();
  const brokenGroups = await page.locator('[data-testid="product-group"]').count();
  await page.screenshot({ path: `${OUT}/state-broken-images.png`, fullPage: true });
  await page.unroute(/\.(png|jpe?g|webp|gif)(\?|$)/i);

  await page.fill("#search-query", "zzqqxx nonexistent product");
  await page.keyboard.press("Enter");
  await page.waitForSelector('text=No products found', { timeout: 30000 }).catch(() => {});
  const noResult = await page.locator("main").getByText("No products found").count();
  await page.screenshot({ path: `${OUT}/state-no-results.png` });

  await page.route("**/api/search", (r) => r.abort("failed"));
  await page.fill("#search-query", "rice");
  await page.keyboard.press("Enter");
  await page.waitForSelector('main [role="alert"]', { timeout: 10000 }).catch(() => {});
  const netMsg = await page.locator('main [role="alert"]').textContent().catch(() => null);
  const retry = await page.getByRole("button", { name: /try again/i }).count();
  await page.screenshot({ path: `${OUT}/state-network-error.png` });
  await page.unroute("**/api/search");
  if (retry) {
    await page.getByRole("button", { name: /try again/i }).click();
    await page.waitForSelector('[data-testid="product-group"]', { timeout: 30000 }).catch(() => {});
  }
  const recovered = await page.locator('[data-testid="product-group"]').count();

  report.ui.push({ states: { emptyMsg, wsMsg, brokenGroups, brokenImgs, brokenPlaceholders, noResult, netMsg, retry, recovered } });
  if (!emptyMsg || !wsMsg) fail("empty/whitespace search shows no message");
  if (brokenImgs !== 0 || brokenPlaceholders !== brokenGroups) fail("broken images not replaced by placeholders");
  if (noResult !== 1) fail("no-result state not shown");
  if (!netMsg || retry !== 1 || recovered === 0) fail("network failure state or retry broken");
  await page.close();
}

// 5. Compare a few results with the store's own product pages (title and visible price).
{
  const page = await browser.newPage();
  const sample = [];
  for (const o of offersSeen) if (o.price !== null && !sample.some((s) => s.url === o.url) && sample.length < 6) sample.push(o);
  for (const o of sample) {
    try {
      await page.goto(o.url, { waitUntil: "domcontentloaded", timeout: 20000 });
      const h1 = (await page.locator("h1").first().textContent({ timeout: 5000 }).catch(() => ""))?.replace(/\s+/g, " ").trim();
      const body = (await page.locator("body").innerText()).replace(/,/g, "");
      const priceShown = new RegExp(`(৳|Tk\\.?|BDT)\\s*${o.price}(\\.00)?\\b`).test(body) || body.includes(`${o.price}.00`);
      const regularShown = o.regularPrice === null ? null : body.includes(String(o.regularPrice));
      const stock = /out of stock/i.test(body) ? "out_of_stock" : /add to cart|buy now/i.test(body) ? "in_stock?" : "unclear";
      report.links.push({ url: o.url, appTitle: o.title, pageH1: h1, appPrice: o.price, priceShown, appRegular: o.regularPrice, regularShown, appAvailability: o.availability, pageStock: stock });
      if (!priceShown) fail(`price ${o.price} not visible on ${o.url}`);
    } catch (e) {
      report.links.push({ url: o.url, error: String(e).slice(0, 200) });
    }
  }
  await page.close();
}

// 6. Production server (next start) when PROD_URL is given: CSP present, the UI works under
// it (no CSP violations or other console errors), and images only come from Othoba hosts.
if (process.env.PROD_URL) {
  const PROD = process.env.PROD_URL;
  const page = await browser.newPage({ viewport: VIEWPORTS.desktop });
  const consoleErrors = [];
  const imageHosts = new Set();
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on("request", (r) => r.resourceType() === "image" && imageHosts.add(new URL(r.url()).hostname));
  const res = await page.goto(PROD, { waitUntil: "networkidle" });
  const headers = res.headers();
  await page.fill("#search-query", "rice");
  await page.keyboard.press("Enter");
  await page.locator('main [data-testid="product-group"]').or(page.locator('main [role="alert"]')).first().waitFor({ timeout: 30000 });
  await page.waitForLoadState("networkidle");
  const groups = await page.locator('main [data-testid="product-group"]').count();
  const loadedImages = await page.$$eval("main img", (imgs) => imgs.filter((i) => i.complete && i.naturalWidth > 0).length);
  await page.screenshot({ path: `${OUT}/prod-results.png`, fullPage: true });
  report.production = { csp: headers["content-security-policy"], xfo: headers["x-frame-options"], groups, loadedImages, consoleErrors, imageHosts: [...imageHosts] };
  if (!headers["content-security-policy"]) fail("production: no CSP header");
  if (groups === 0) fail("production: no results rendered");
  for (const h of imageHosts) if (!ALLOWED_IMAGE_HOSTS.has(h) && h !== new URL(PROD).hostname) fail(`production: image from ${h}`);
  for (const e of consoleErrors) if (!/status of 403/.test(e)) fail(`production: console error ${e}`);
  await page.close();
}

await browser.close();
report.finishedAt = new Date().toISOString();
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(`failures: ${report.failures.length}`);
for (const f of report.failures) console.log(`FAIL ${f}`);
process.exit(report.failures.length ? 1 : 0);
