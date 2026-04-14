import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { messages, systemPrompt } = await req.json();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: [
          {
            type: 'text',
            text: systemPrompt || 'You are an AI assistant for Mamour Media. Help build and manage projects.',
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: messages.map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    const data = await response.json();
    const content = data.content?.map((b: { text?: string }) => b.text || '').join('') || 'No response.';

    return NextResponse.json({ content });
  } catch (error) {
    return NextResponse.json({ content: 'Error connecting to Claude.' }, { status: 500 });
  }
}
