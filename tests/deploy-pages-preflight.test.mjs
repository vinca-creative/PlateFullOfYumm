import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, chmod, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/deploy-pages-preflight.sh', import.meta.url));

async function runPreflight(origin, domainEntries) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pages-preflight-'));
  const bin = path.join(directory, 'bin');
  await mkdir(bin);
  const curl = `#!/usr/bin/env node\nconst url = process.argv.at(-1);\nprocess.stdout.write(JSON.stringify(url.endsWith('/domains') ? { success: true, result: ${JSON.stringify(domainEntries)} } : { success: true, result: { production_branch: 'main', subdomain: 'platefullofyum.pages.dev' } }));\n`;
  const jq = `#!/usr/bin/env node\nlet input=''; for await (const chunk of process.stdin) input += chunk; const data=JSON.parse(input); const expr=process.argv.at(-1); if(expr==='.success') console.log(data.success); else if(expr==='.result.production_branch') console.log(data.result.production_branch); else if(expr==='.result.subdomain') console.log(data.result.subdomain); else { const host=process.argv[process.argv.indexOf('--arg')+2]; process.exit(data.result.filter(x=>x.name===host&&x.status==='active').length===1 ? 0 : 1); }\n`;
  for (const [name, content] of [['curl', curl], ['jq', jq]]) {
    const file = path.join(bin, name);
    await writeFile(file, content);
    await chmod(file, 0o755);
  }
  try {
    return spawnSync('bash', [script], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, PFOY_PAGES_PROJECT_NAME: 'platefullofyum', PFOY_PUBLIC_SITE_ORIGIN: origin, CLOUDFLARE_ACCOUNT_ID: 'account', CLOUDFLARE_API_TOKEN: 'token' },
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('Pages preflight accepts the selected project pages.dev host without a domain listing', async () => {
  const result = await runPreflight('https://platefullofyum.pages.dev', []);
  assert.equal(result.status, 0, result.stderr);
});

test('Pages preflight rejects another project pages.dev host', async () => {
  const result = await runPreflight('https://other-project.pages.dev', []);
  assert.notEqual(result.status, 0);
});

test('Pages preflight accepts an active custom domain', async () => {
  const result = await runPreflight('https://recipes.example.com', [{ name: 'recipes.example.com', status: 'active' }]);
  assert.equal(result.status, 0, result.stderr);
});

test('Pages preflight rejects inactive or unrelated domains', async () => {
  for (const domains of [
    [{ name: 'recipes.example.com', status: 'pending' }],
    [{ name: 'other.example.com', status: 'active' }],
  ]) {
    const result = await runPreflight('https://recipes.example.com', domains);
    assert.notEqual(result.status, 0);
  }
});
