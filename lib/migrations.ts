import { createClient } from '@supabase/supabase-js';

export async function runMigrations() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.warn('[migrations] Skipping — SUPABASE_SERVICE_ROLE_KEY not set');
    return;
  }

  const supabase = createClient(url, key);

  // Seed default projects (upsert — safe to run repeatedly)
  const { error } = await supabase.from('projects').upsert(
    [
      {
        id: 'cine-labs',
        name: 'Cine Labs',
        subtitle: 'Cinema Labs — AI Content Studio',
        description:
          'End-to-end AI content automation studio. Script-to-screen pipeline with voice cloning, storyboarding, video generation, and character consistency.',
        status: 'active',
        accent: '#d4a574',
        features: [
          'Script & Content',
          'Storyboard',
          'Voice & Audio',
          'Video Generation',
          'Character Library',
          'Pipeline Status',
        ],
        progress: 65,
      },
      {
        id: 'admanager',
        name: 'AdManager',
        subtitle: 'AI Ad Platform',
        description:
          'AI-powered ad platform for campaign creation, targeting, A/B testing, and performance analytics at scale.',
        status: 'active',
        accent: '#60a5fa',
        features: ['Campaign Builder', 'A/B Testing', 'Analytics', 'Audience Targeting'],
        progress: 40,
      },
    ],
    { onConflict: 'id', ignoreDuplicates: true }
  );

  if (error) {
    // Table may not exist yet — schema.sql must be run first in Supabase
    console.warn('[migrations] Seed skipped:', error.message);
  } else {
    console.log('[migrations] ✓ Projects seeded');
  }
}
