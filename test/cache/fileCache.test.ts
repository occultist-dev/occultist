import {resolve} from "path";
import {FileCache} from "../../lib/mod.ts";
import {Registry} from "../../lib/registry.ts";
import {testAuthMiddleware} from "../utils/authMiddleware.ts";
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {mkdir} from "node:fs/promises";

const cacheDir = resolve(import.meta.dirname, '../tmp/fileCache.test');

try {
  await mkdir(cacheDir, { recursive: true });
} catch {}

async function makeRegistry() {
  const registry = new Registry({
    rootIRI: 'https://example.com',
    serverTiming: true,
    cacheHitHeader: true,
  });

  const cache = new FileCache(
    registry,
    resolve(cacheDir, 'info.json'),
    cacheDir,
  );

  registry.http.get('/')
    .public()
    .cache(cache.store())
    .handle('text/plain', 'Hello, World!')
    .handle('text/html', `
      <!doctype html>
      <html>
        <head><title>Hello, World!</title></head>
        <body>
          <h1>Hello, World!</h1>
        </body>
      </html>
    `);

  registry.http.get('/public')
    .public()
    .cache(cache.store())
    .handle('text/plain', (ctx) => {
      ctx.body = `PUBLIC`;
    });

  registry.http.get('/open')
    .public(testAuthMiddleware)
    .cache(cache.store())
    .handle('text/plain', (ctx) => {
      ctx.body = `OPEN(${ctx.authKey ?? 'unauthenticated'})`;
    });

  registry.http.get('/private')
    .private(testAuthMiddleware)
    .cache(cache.store())
    .handle('text/plain', (ctx) => {
      ctx.body = `PRIVATE(${ctx.authKey})`;
    });

  return {
    registry,
    cache,
  };
}

describe('FileSystemCache', () => {
  it('preserves cached values', async () => {
    const { registry, cache } = await makeRegistry();
    const res1 = await registry.handleRequest(
      new Request('https://example.com')
    );
    const res2 = await registry.handleRequest(
      new Request('https://example.com/')
    );
  
    assert.notEqual(res1.headers.get('X-Cache'), 'HIT');
    assert.equal(res1.headers.get('Content-Type'), 'text/plain');
    assert.equal(res2.headers.get('X-Cache'), 'HIT');
    assert.equal(res2.headers.get('Content-Type'), 'text/plain');
    
    await cache.flush();
  });
  
  it('varies on content type', async () => {
    const { registry, cache } = await makeRegistry();
    const res1 = await registry.handleRequest(
      new Request('https://example.com')
    );
    const res2 = await registry.handleRequest(
      new Request('https://example.com?#', { headers: { accept: 'text/html' }})
    );
  
    assert.notEqual(res1.headers.get('X-Cache'), 'HIT');
    assert.equal(res1.headers.get('Content-Type'), 'text/plain');
    assert.notEqual(res2.headers.get('X-Cache'), 'HIT');
    assert.equal(res2.headers.get('Content-Type'), 'text/html');

    await cache.flush();
  });
});
