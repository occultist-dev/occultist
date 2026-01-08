import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {type CacheOperation, MemoryCache} from '../../lib/mod.ts';
import {Registry} from '../../lib/registry.ts';


async function makeRegistry() {
  const registry = new Registry({
    rootIRI: 'https://example.com',
    cacheHitHeader: true,
  });

  const cache = new MemoryCache(registry);

  return {
    registry,
    cache,
  };
}

describe('registry.refreshCache()', () => {
  it('Updates a cache entry when it is already cached', async () => {
    let body = 'Cache 1';
    let hitCount = 0;
    const { registry, cache } = await makeRegistry();

    registry.http.get('/cacheable')
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
    const result = await registry.refreshCache(
      new Request('https://example.com/cacheable')
    );
    const res3 = await registry.handleRequest(
      new Request('https://example.com/cacheable')
    );

    assert.equal(hitCount, 2);
    assert.equal(result, 'cached');
    assert.equal(res1.headers.get('X-Cache'), null);
    assert.equal(res2.headers.get('X-Cache'), 'HIT');
    assert.equal(res3.headers.get('X-Cache'), 'HIT');
    assert.equal(await res1.text(), 'Cache 1');
    assert.equal(await res2.text(), 'Cache 1');
    assert.equal(await res3.text(), 'Cache 2');
  });
  it('Treats any method as having get semantics when overridden', async () => {
    let body = 'Cache 1';
    let hitCount = 0;
    const { registry, cache } = await makeRegistry();

    registry.http.post('/cacheable')
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
    const result = await registry.refreshCache(
      new Request('https://example.com/cacheable', { method: 'POST' })
    );
    const res3 = await registry.handleRequest(
      new Request('https://example.com/cacheable', { method: 'POST' })
    );

    assert.equal(hitCount, 2);
    assert.equal(result, 'cached');
    assert.equal(res1.headers.get('X-Cache'), null);
    assert.equal(res2.headers.get('X-Cache'), 'HIT');
    assert.equal(res3.headers.get('X-Cache'), 'HIT');
    assert.equal(await res1.text(), 'Cache 1');
    assert.equal(await res2.text(), 'Cache 1');
    assert.equal(await res3.text(), 'Cache 2');
  });

  it('Sets the context cache run flag', async () => {
    const { registry, cache } = await makeRegistry();

    let cacheRun1: boolean | undefined;
    let cacheOp1: CacheOperation | undefined;
    let cacheRun2: boolean | undefined;
    let cacheOp2: CacheOperation | undefined;

    registry.http.get('/cacheable-1')
      .public()
      .cache(cache.store())
      .handle('text/plain', (ctx) => {
        cacheRun1 = ctx.cacheRun;
        cacheOp1 = ctx.cacheOperation;
        ctx.body = 'Cacheable';
      });

    registry.http.get('/cacheable-2')
      .public()
      .cache(cache.store())
      .handle('text/plain', (ctx) => {
        cacheRun2 = ctx.cacheRun;
        cacheOp2 = ctx.cacheOperation;
        ctx.body = 'Cacheable';
      });

    await Promise.all([
      registry.refreshCache(new Request('https://example.com/cacheable-1')),
      registry.handleRequest(new Request('https://example.com/cacheable-2')),
    ]);

    assert.equal(cacheRun1, true);
    assert.equal(cacheOp1, 'refresh');
    assert.equal(cacheRun2, false);
    assert.equal(cacheOp2, null);
  });
});
