#!/usr/bin/env node

const token = process.env.VERCEL_TOKEN;
const projectId = process.env.VERCEL_PROJECT_ID;

if (!token || !projectId) {
  console.error('Missing VERCEL_TOKEN or VERCEL_PROJECT_ID');
  process.exit(1);
}

async function redeploy() {
  // Get latest deployment
  const listRes = await fetch(
    `https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=1&target=production`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const { deployments } = await listRes.json();

  if (!deployments?.length) {
    console.error('No deployments found');
    process.exit(1);
  }

  const latest = deployments[0];
  console.log(`Redeploying: ${latest.uid} (${latest.url})`);

  // Trigger redeploy
  const redeployRes = await fetch(
    `https://api.vercel.com/v13/deployments?forceNew=1`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'mamourmedia-dashboard',
        deploymentId: latest.uid,
        target: 'production',
      }),
    }
  );

  const result = await redeployRes.json();
  if (result.id) {
    console.log(`✓ Redeploy triggered: https://${result.url}`);
  } else {
    console.error('Redeploy failed:', JSON.stringify(result));
    process.exit(1);
  }
}

redeploy();
