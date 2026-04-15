// Browserless BaaS
// Auth: ?token=<key> query param
// Endpoint: https://production-sfo.browserless.io (US)

const BASE_URL = process.env.BROWSERLESS_BASE_URL ?? 'https://production-sfo.browserless.io';

function tokenParam() {
  const token = process.env.BROWSERLESS_API_KEY;
  if (!token) throw new Error('BROWSERLESS_API_KEY not set');
  return `?token=${token}`;
}

export async function takeScreenshot(url: string): Promise<{ image: string }> {
  const res = await fetch(`${BASE_URL}/chromium/screenshot${tokenParam()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, options: { type: 'png', fullPage: true }, waitForTimeout: 2000 }),
  });
  if (!res.ok) throw new Error(`Screenshot failed: ${res.status} ${await res.text()}`);
  const buf = await res.arrayBuffer();
  return { image: Buffer.from(buf).toString('base64') };
}

export async function getPageContent(url: string): Promise<{ url: string; title: string; content: string }> {
  const res = await fetch(`${BASE_URL}/chromium/content${tokenParam()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, waitForTimeout: 2000 }),
  });
  if (!res.ok) throw new Error(`Content failed: ${res.status} ${await res.text()}`);
  const html = await res.text();
  const title = html.match(/<title>(.*?)<\/title>/i)?.[1] ?? '';
  return { url, title, content: html };
}

export async function runScript(code: string, context?: Record<string, unknown>) {
  const res = await fetch(`${BASE_URL}/chromium/function${tokenParam()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, context: context ?? {} }),
  });
  if (!res.ok) throw new Error(`Script failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function scrapePage(url: string, selectors: Record<string, string>) {
  const res = await fetch(`${BASE_URL}/chromium/scrape${tokenParam()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, elements: Object.values(selectors).map(s => ({ selector: s })), waitForTimeout: 2000 }),
  });
  if (!res.ok) throw new Error(`Scrape failed: ${res.status} ${await res.text()}`);
  return res.json();
}
