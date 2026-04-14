import { NextRequest, NextResponse } from 'next/server';
import { getPageContent, takeScreenshot, scrapePage, runScript } from '@/lib/browserless';

export async function POST(req: NextRequest) {
  try {
    const { action, url, selectors, code, context } = await req.json();

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    switch (action) {
      case 'screenshot': {
        if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });
        const result = await takeScreenshot(url);
        return NextResponse.json(result);
      }

      case 'content': {
        if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });
        const result = await getPageContent(url);
        return NextResponse.json(result);
      }

      case 'scrape': {
        if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });
        const result = await scrapePage(url, selectors ?? {});
        return NextResponse.json(result);
      }

      case 'script': {
        if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });
        const result = await runScript(code, context);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Browser task failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
