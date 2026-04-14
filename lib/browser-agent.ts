const BROWSERLESS_URL = process.env.BROWSERLESS_BASE_URL ?? 'https://production-sfo.browserless.io';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

export interface AgentStep {
  type: 'think' | 'browse' | 'result' | 'error';
  content: string;
  screenshot?: string;
}

const SYSTEM_PROMPT = `You are an autonomous browser agent for Mamour Media. You control a real Chrome browser via Puppeteer running on Browserless.io.

When given a task, respond with a JSON object in one of these formats:

1. To run a browser action:
{"action":"browse","code":"module.exports=async({page})=>{await page.goto('https://example.com');return {title:await page.title()}}"}

2. To take a screenshot:
{"action":"screenshot","url":"https://example.com"}

3. When the task is complete:
{"action":"complete","result":"<summary of what was accomplished>"}

4. If you need to think before acting:
{"action":"think","thought":"<your reasoning>"}

Rules:
- Always use valid Puppeteer code for browse actions
- Return only raw JSON, no markdown, no code fences
- Keep code concise and focused on the task
- After each browse result, decide next step or complete`;

export async function runBrowserAgent(
  task: string,
  onStep: (step: AgentStep) => void,
  maxSteps = 8
): Promise<string> {
  const token = process.env.BROWSERLESS_API_KEY;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!token) throw new Error('BROWSERLESS_API_KEY not set');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const messages: { role: string; content: string }[] = [
    { role: 'user', content: `Task: ${task}` },
  ];

  for (let step = 0; step < maxSteps; step++) {
    // Ask Claude what to do next
    const claudeRes = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages,
      }),
    });

    const claudeData = await claudeRes.json();
    const raw = claudeData.content?.[0]?.text ?? '';

    let parsed: { action: string; code?: string; url?: string; result?: string; thought?: string };
    try {
      parsed = JSON.parse(raw.trim());
    } catch {
      onStep({ type: 'error', content: `Claude returned invalid JSON: ${raw}` });
      break;
    }

    messages.push({ role: 'assistant', content: raw });

    // ── Think ──
    if (parsed.action === 'think') {
      onStep({ type: 'think', content: parsed.thought ?? '' });
      messages.push({ role: 'user', content: 'Continue.' });
      continue;
    }

    // ── Complete ──
    if (parsed.action === 'complete') {
      const result = parsed.result ?? 'Task complete.';
      onStep({ type: 'result', content: result });
      return result;
    }

    // ── Screenshot ──
    if (parsed.action === 'screenshot' && parsed.url) {
      onStep({ type: 'browse', content: `Taking screenshot of ${parsed.url}` });
      try {
        const res = await fetch(`${BROWSERLESS_URL}/chromium/screenshot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ url: parsed.url, options: { type: 'png', fullPage: true }, waitForTimeout: 2000 }),
        });
        const buf = await res.arrayBuffer();
        const img = Buffer.from(buf).toString('base64');
        onStep({ type: 'browse', content: `Screenshot captured`, screenshot: img });
        messages.push({ role: 'user', content: `Screenshot taken of ${parsed.url}. What next?` });
      } catch (e) {
        const msg = `Screenshot failed: ${e}`;
        onStep({ type: 'error', content: msg });
        messages.push({ role: 'user', content: msg });
      }
      continue;
    }

    // ── Browse (Puppeteer script) ──
    if (parsed.action === 'browse' && parsed.code) {
      onStep({ type: 'browse', content: `Running browser script…` });
      try {
        const res = await fetch(`${BROWSERLESS_URL}/chromium/function`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ code: parsed.code }),
        });
        const data = await res.json();
        const summary = JSON.stringify(data).slice(0, 800);
        onStep({ type: 'browse', content: `Result: ${summary}` });
        messages.push({ role: 'user', content: `Browser result: ${summary}. What next?` });
      } catch (e) {
        const msg = `Browse failed: ${e}`;
        onStep({ type: 'error', content: msg });
        messages.push({ role: 'user', content: msg });
      }
      continue;
    }

    onStep({ type: 'error', content: `Unknown action: ${parsed.action}` });
    break;
  }

  return 'Agent stopped after max steps.';
}
