import { NextRequest } from 'next/server';
import { runBrowserAgent, AgentStep } from '@/lib/browser-agent';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { task } = await req.json();
  if (!task) return new Response('task is required', { status: 400 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (step: AgentStep) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(step)}\n\n`));
      };

      try {
        await runBrowserAgent(task, send);
      } catch (err) {
        send({ type: 'error', content: err instanceof Error ? err.message : String(err) });
      }

      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
