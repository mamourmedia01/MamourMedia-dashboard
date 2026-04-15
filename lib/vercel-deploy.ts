// lib/vercel-deploy.ts
// Vercel Files API — deploy Next.js apps by POSTing source files directly.
// No GitHub token needed. Each generated app gets its own Vercel project.

export interface GeneratedFile {
  path: string;    // e.g. "app/page.tsx" — no leading slash
  content: string; // UTF-8 source text
}

export interface VercelDeployment {
  id: string;
  url: string;
  readyState: 'QUEUED' | 'INITIALIZING' | 'BUILDING' | 'READY' | 'ERROR' | 'CANCELED';
}

export interface DeployResult {
  deploymentId: string;
  url: string;
  status: 'success' | 'error';
  errorLog?: string;
}

// POST source files to Vercel Files API. Returns {id, url} immediately (async build).
// projectSlug: unique per generated app, e.g. "mm-cine-labs-1713200000"
export async function createVercelDeployment(
  projectSlug: string,
  files: GeneratedFile[],
  token: string
): Promise<{ id: string; url: string }> {
  const body = {
    name: projectSlug,
    framework: 'nextjs',
    target: 'production',
    projectSettings: {
      framework: 'nextjs',
      nodeVersion: '20.x',
      installCommand: 'npm install',
      buildCommand: 'next build',
      outputDirectory: '.next',
    },
    // "file" key (not "path") + encoding required — Vercel silently ignores wrong keys
    files: files.map(f => ({
      file: f.path.replace(/^\/+/, ''), // strip leading slashes
      data: f.content,
      encoding: 'utf-8',
    })),
  };

  const res = await fetch('https://api.vercel.com/v13/deployments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Vercel deploy API ${res.status}: ${errText.slice(0, 500)}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(`Vercel: ${data.error.message ?? JSON.stringify(data.error)}`);
  return { id: data.id, url: data.url };
}

// Poll deployment status. readyState: QUEUED → INITIALIZING → BUILDING → READY|ERROR
export async function getDeploymentStatus(
  deploymentId: string,
  token: string
): Promise<VercelDeployment> {
  const res = await fetch(
    `https://api.vercel.com/v13/deployments/${deploymentId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Status poll ${res.status}`);
  const data = await res.json();
  return { id: data.id, url: data.url, readyState: data.readyState };
}

// Fetch build log lines. NOTE: uses /v2/deployments (different version than status poll!).
// Returns NDJSON lines concatenated as a plain string.
export async function getDeploymentLogs(
  deploymentId: string,
  token: string
): Promise<string> {
  const res = await fetch(
    `https://api.vercel.com/v2/deployments/${deploymentId}/events?limit=500`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return `Log fetch failed: ${res.status}`;

  const text = await res.text();
  const lines = text
    .split('\n')
    .filter(Boolean)
    .flatMap(line => {
      try {
        const obj = JSON.parse(line) as { payload?: { text?: string }; text?: string };
        return [obj?.payload?.text ?? obj?.text ?? ''];
      } catch {
        return [];
      }
    })
    .filter(Boolean);

  return lines.join('\n');
}

// Poll until READY or ERROR, calling onPoll on each tick.
export async function pollUntilReady(
  deploymentId: string,
  token: string,
  onPoll: (state: string, url: string) => void,
  maxWaitMs = 180_000,
  intervalMs = 5_000
): Promise<DeployResult> {
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, intervalMs));

    let deployment: VercelDeployment;
    try {
      deployment = await getDeploymentStatus(deploymentId, token);
    } catch {
      continue; // transient network error — keep polling
    }

    onPoll(deployment.readyState, deployment.url);

    if (deployment.readyState === 'READY') {
      return { deploymentId, url: deployment.url, status: 'success' };
    }

    if (deployment.readyState === 'ERROR' || deployment.readyState === 'CANCELED') {
      const errorLog = await getDeploymentLogs(deploymentId, token);
      return { deploymentId, url: deployment.url, status: 'error', errorLog };
    }
    // QUEUED / INITIALIZING / BUILDING → keep polling
  }

  return { deploymentId, url: '', status: 'error', errorLog: 'Deployment timed out after 3 minutes.' };
}
