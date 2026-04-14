const BASE_URL = 'https://chrome.browserless.io';

function getToken() {
  const token = process.env.BROWSERLESS_API_KEY;
  if (!token) throw new Error('BROWSERLESS_API_KEY not set');
  return token;
}

export interface ScrapeResult {
  url: string;
  title: string;
  content: string;
}

export interface ScreenshotResult {
  image: string; // base64
}

// Get full page HTML content
export async function getPageContent(url: string): Promise<ScrapeResult> {
  const res = await fetch(`${BASE_URL}/content?token=${getToken()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, waitFor: 2000 }),
  });
  const html = await res.text();
  const title = html.match(/<title>(.*?)<\/title>/i)?.[1] ?? '';
  return { url, title, content: html };
}

// Take a screenshot (returns base64 PNG)
export async function takeScreenshot(url: string): Promise<ScreenshotResult> {
  const res = await fetch(`${BASE_URL}/screenshot?token=${getToken()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      options: { fullPage: true, type: 'png' },
      waitFor: 2000,
    }),
  });
  const buffer = await res.arrayBuffer();
  const image = Buffer.from(buffer).toString('base64');
  return { image };
}

// Scrape structured data from a page
export async function scrapePage(url: string, selectors: Record<string, string>) {
  const res = await fetch(`${BASE_URL}/scrape?token=${getToken()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      elements: Object.entries(selectors).map(([name, selector]) => ({
        selector,
        timeout: 5000,
      })),
      waitFor: 2000,
    }),
  });
  return res.json();
}

// Execute arbitrary Puppeteer script via /function endpoint
export async function runScript(code: string, context?: Record<string, unknown>) {
  const res = await fetch(`${BASE_URL}/function?token=${getToken()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, context: context ?? {} }),
  });
  return res.json();
}
