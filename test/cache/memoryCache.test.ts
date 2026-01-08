import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {MemoryCache, Registry} from '../../lib/mod.ts';
import {testAuthMiddleware} from '../utils/authMiddleware.ts';
import {setTimeout} from 'node:timers/promises';

function makeRegistry() {
  const registry = new Registry({
    rootIRI: 'https://example.com',
    serverTiming: true,
    cacheHitHeader: true,
  });
  const cache = new MemoryCache(registry);

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

describe('InMemoryCache', () => {
  it('preserves cached values', async () => {
    const { registry } = makeRegistry();
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
    const { registry } = makeRegistry();
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

  it('varies and adds the private cache-control directive when a public endpoint handles authorization', async () => {
    const { registry } = makeRegistry();
    const res1 = await registry.handleRequest(
      new Request('https://example.com/open')
    );
    const res2 = await registry.handleRequest(
      new Request('https://example.com/open', { headers: { 'Authorization': 'admin' } })
    );

    const cc1 = res1.headers.get('Cache-Control');
    const cc2 = res2.headers.get('Cache-Control');
    
    assert.notEqual(res1.headers.get('X-Cache'), 'HIT');
    assert(cc1 == null || !cc1.includes('private'));
    assert.equal(await res1.text(), 'OPEN(unauthenticated)');

    assert.notEqual(res2.headers.get('X-Cache'), 'HIT');
    assert(cc2.includes('private'));
    assert.equal(await res2.text(), 'OPEN(admin)');
  });

  it('reuses cache requested using different authentication methods', async () => {
    const { registry } = makeRegistry();
    const res1 = await registry.handleRequest(
      new Request('https://example.com/open', { headers: { 'Cookie': 'foo=1; auth=admin; baa=QWERTY' } })
    );
    const res2 = await registry.handleRequest(
      new Request('https://example.com/open', { headers: { 'Authorization': 'admin' } })
    );

    assert.notEqual(res1.headers.get('X-Cache'), 'HIT');
    assert.equal(await res1.text(), 'OPEN(admin)');

    assert.equal(res2.headers.get('X-Cache'), 'HIT');
    assert.equal(await res2.text(), 'OPEN(admin)');
  });

  it('does not lock parallel requests when locking not enabled', async () => {
    const { registry, cache } = makeRegistry();

    registry.http.get('/lockable')
      .public()
      .cache(cache.store())
      .handle('text/plain', async (ctx) => {
        await setTimeout(20);

        ctx.body = `LOCK`;
      });

    const responses = await Promise.all([
      registry.handleRequest(new Request('https://example.com/lockable')),
      registry.handleRequest(new Request('https://example.com/lockable')),
      registry.handleRequest(new Request('https://example.com/lockable')),
      registry.handleRequest(new Request('https://example.com/lockable')),
    ]);

    const cacheHits = responses.filter((res) => res.headers.get('X-Cache') === 'HIT');
    assert.equal(cacheHits.length, 0);
  });

  it('locks parallel requests when locking is enabled', async () => {
    const { registry, cache } = makeRegistry();

    registry.http.get('/lockable')
      .public()
      .cache(cache.store({ lock: true }))
      .handle('text/plain', async (ctx) => {
        await setTimeout(20);

        ctx.body = `LOCK`;
      });

    const responses = await Promise.all([
      registry.handleRequest(new Request('https://example.com/lockable')),
      registry.handleRequest(new Request('https://example.com/lockable')),
      registry.handleRequest(new Request('https://example.com/lockable')),
      registry.handleRequest(new Request('https://example.com/lockable')),
    ]);

    const cacheHits = responses.filter((res) => res.headers.get('X-Cache') === 'HIT');
    assert.equal(cacheHits.length, 3);
  });

  it('responds correctly when the cache is flushed between responses', async () => {
    const { registry, cache } = makeRegistry();

    registry.http.get('/not-lockable')
      .public()
      .cache(cache.store())
      .handle('text/plain', async (ctx) => {
        await setTimeout(20);

        ctx.body = `LOCK`;
      });

    registry.http.get('/lockable')
      .public()
      .cache(cache.store({ lock: true }))
      .handle('text/plain', async (ctx) => {
        await setTimeout(20);

        ctx.body = `LOCK`;
      });

    const responses = await Promise.all([
      registry.handleRequest(new Request('https://example.com/lockable')),
      registry.handleRequest(new Request('https://example.com/lockable')),
      registry.handleRequest(new Request('https://example.com/not-lockable')),
      registry.handleRequest(new Request('https://example.com/not-lockable')),
      cache.flush(),
      registry.handleRequest(new Request('https://example.com/lockable')),
      registry.handleRequest(new Request('https://example.com/lockable')),
      registry.handleRequest(new Request('https://example.com/not-lockable')),
      registry.handleRequest(new Request('https://example.com/not-lockable')),
    ]);

    for (const res of responses) {
      if (res instanceof Response) {
        assert.equal(res.status, 200);
        assert.equal(await res.text(), 'LOCK');
      }
    }
  });

});

