import {resolve} from "path";
import {FileSystemCache} from "../lib/mod.ts";
import {Registry} from "../lib/registry.ts";
import {testAuthMiddleware} from "./utils/authMiddleware.ts";
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';


async function makeRegistry() {
  const registry = new Registry({
    rootIRI: 'https://example.com',
    serverTiming: true,
    cacheHitHeader: true,
  });

  const cache = new FileSystemCache(
    registry,
    resolve(import.meta.dirname, 'cache/info.json'),
    resolve(import.meta.dirname, 'cache'),
  );

  registry.http.get('root', '/')
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

  registry.http.get('public', '/public')
    .public()
    .cache(cache.store())
    .handle('text/plain', (ctx) => {
      ctx.body = `PUBLIC`;
    });

  registry.http.get('open', '/open')
    .public(testAuthMiddleware)
    .cache(cache.store())
    .handle('text/plain', (ctx) => {
      ctx.body = `OPEN(${ctx.authKey ?? 'unauthenticated'})`;
    });

  registry.http.get('private', '/private')
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
  });
  
  it('varies on content type', async () => {
    const { registry } = await makeRegistry();
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
  });
});
