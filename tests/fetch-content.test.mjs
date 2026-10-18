import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, readdir, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('../scripts/fetch-content.ts', import.meta.url));

function articlePost() {
  return [{
    id: 1084,
    slug: 'sample-article',
    status: 'publish',
    link: 'https://platefullofyum.com/sample-article/',
    title: { rendered: 'Sample article' },
    excerpt: { rendered: '' },
    content: { rendered: '<p>Public editorial copy.</p>', protected: false },
    date_gmt: '2026-08-24T02:30:00',
    modified_gmt: '2026-08-24T02:30:00',
    author: 1,
    comment_status: 'closed',
    yoast_head_json: {
      title: 'Sample article',
      description: 'Public editorial copy.',
      canonical: 'https://platefullofyum.com/sample-article/',
      robots: 'index,follow',
      og_title: 'Sample article',
      og_description: 'Public editorial copy.',
      og_image: null
    },
    _embedded: {
      author: [{ name: 'Asha G' }],
      'wp:term': [[], []]
    }
  }];
}

async function runSnapshot(cwd, apiRoot) {
  return await new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, ['--experimental-strip-types', script], {
      cwd,
      env: {
        ...process.env,
        PFOY_WORDPRESS_API_ROOT: apiRoot,
        VITE_PUBLIC_SITE_ORIGIN: 'https://platefullofyum.com',
        VITE_CMS_ORIGIN: new URL(apiRoot).origin,
        PFOY_REQUIRE_SOURCE_REVISION: 'false'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    child.on('error', rejectRun);
    child.on('close', (code) => resolveRun({ code, stdout, stderr }));
  });
}

async function withWordPress(status, callback) {
  const server = createServer((request, response) => {
    if (request.url?.includes('/wp/v2/comments')) {
      response.writeHead(200, {
        'content-type': 'application/json',
        'x-wp-total': '0',
        'x-wp-totalpages': '0'
      });
      response.end('[]');
      return;
    }
    if (status !== 200 && request.url?.includes('/wp/v2/posts')) {
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ message: 'unavailable' }));
      return;
    }
    const records = request.url?.includes('/wp/v2/posts') ? articlePost() : [];
    response.writeHead(200, {
      'content-type': 'application/json',
      'x-wp-total': String(records.length),
      'x-wp-totalpages': records.length === 0 ? '0' : '1'
    });
    response.end(JSON.stringify(records));
  });
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const address = server.address();
  try {
    await callback(`http://127.0.0.1:${address.port}/wp-json/`);
  } finally {
    await new Promise((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
  }
}

async function withTempDirectory(callback) {
  const directory = await mkdtemp(resolve(tmpdir(), 'pfoy-snapshot-'));
  try {
    await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('snapshot command atomically writes a complete validated direct-API snapshot', async () => {
  await withTempDirectory(async (directory) => {
    await withWordPress(200, async (apiRoot) => {
      const result = await runSnapshot(directory, apiRoot);
      assert.equal(result.code, 0, result.stderr);
      const snapshot = JSON.parse(await readFile(resolve(directory, 'content-snapshot/snapshot.json'), 'utf8'));
      assert.equal(snapshot.items.length, 1);
      assert.equal(snapshot.items[0].kind, 'article');
      assert.equal(snapshot.items[0].seo.canonical, 'https://platefullofyum.com/sample-article/');
      assert.deepEqual(await readdir(resolve(directory, 'content-snapshot')), ['snapshot.json']);
    });
  });
});

test('snapshot command preserves the last complete snapshot when retrieval fails', async () => {
  await withTempDirectory(async (directory) => {
    const output = resolve(directory, 'content-snapshot');
    await mkdir(output, { recursive: true });
    await writeFile(resolve(output, 'snapshot.json'), '{"revision":"last-good"}\n');
    await withWordPress(503, async (apiRoot) => {
      const result = await runSnapshot(directory, apiRoot);
      assert.notEqual(result.code, 0);
      assert.match(result.stderr, /returned HTTP 503/);
      assert.equal(await readFile(resolve(output, 'snapshot.json'), 'utf8'), '{"revision":"last-good"}\n');
      assert.deepEqual(await readdir(output), ['snapshot.json']);
    });
  });
});
