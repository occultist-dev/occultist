import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {Registry} from '../../lib/registry.ts';
import {MemoryCache} from '../../lib/mod.ts';


async function makeRegistry() {
  const registry = new Registry({
    rootURL: 'https://example.com',
    cacheHitHeader: true,
  });

  const cache = new MemoryCache(registry);

  return {
    registry,
    cache,
  };
}

describe('registry.invalidateCache()', () => {
  it('Invalidates a cache entry', async () => {
    let body = 'Cache 1';
    let hitCount = 0;
    const { registry, cache } = await makeRegistry();

    registry.http.get('cachable', '/cacheable')
      .public()
      .cache(cache.store())
      .handle('text/plain', (ctx) => {
        hitCount++;
        ctx.body = body;
      });

    const res1 = await registry.handleRequest(
      new Request('https://example.com/cacheable')
    );
    body = 'Cache 2';
    const res2 = await registry.handleRequest(
      new Request('https://example.com/cacheable')
    );
    const result = await registry.invalidateCache(
      new Request('https://example.com/cacheable')
    );
    assert.equal(hitCount, 1);

    const res3 = await registry.handleRequest(
      new Request('https://example.com/cacheable')
    );

    assert.equal(hitCount, 2);
    assert.equal(result, 'invalidated');
    assert.equal(res1.headers.get('X-Cache'), null);
    assert.equal(res2.headers.get('X-Cache'), 'HIT');
    assert.equal(res3.headers.get('X-Cache'), null);
    assert.equal(await res1.text(), 'Cache 1');
    assert.equal(await res2.text(), 'Cache 1');
    assert.equal(await res3.text(), 'Cache 2');
  });

  it('Treats any method as having get semantics when overridden', async () => {
    let body = 'Cache 1';
    let hitCount = 0;
    const { registry, cache } = await makeRegistry();

    registry.http.post('cachable', '/cacheable')
      .public()
      .cache(cache.store({ semantics: 'get' }))
      .handle('text/plain', (ctx) => {
        hitCount++;
        ctx.body = body;
      });

    const res1 = await registry.handleRequest(
      new Request('https://example.com/cacheable', { method: 'POST' })
    );
    body = 'Cache 2';
    const res2 = await registry.handleRequest(
      new Request('https://example.com/cacheable', { method: 'POST' })
    );
    const result = await registry.invalidateCache(
      new Request('https://example.com/cacheable', { method: 'POST' })
    );
    assert.equal(hitCount, 1);

    const res3 = await registry.handleRequest(
      new Request('https://example.com/cacheable', { method: 'POST' })
    );

    assert.equal(hitCount, 2);
    assert.equal(result, 'invalidated');
    assert.equal(res1.headers.get('X-Cache'), null);
    assert.equal(res2.headers.get('X-Cache'), 'HIT');
    assert.equal(res3.headers.get('X-Cache'), null);
    assert.equal(await res1.text(), 'Cache 1');
    assert.equal(await res2.text(), 'Cache 1');
    assert.equal(await res3.text(), 'Cache 2');
  });

  it('Does not run action middleware following the cache middleware', async () => {
    const { registry, cache } = await makeRegistry();

    let handlerCalled = false;

    registry.http.get('cachable-1', '/cacheable')
      .public()
      .cache(cache.store())
      .handle('text/plain', (ctx) => {
        handlerCalled = false;
        ctx.body = 'Cacheable';
      });

    await registry.invalidateCache(new Request('https://example.com/cacheable'));

    assert(!handlerCalled);
  });
});
