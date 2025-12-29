import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {Registry} from '../../lib/registry.ts';
import {MemoryCache} from '../../lib/mod.ts';


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

describe('registry.primeCache()', () => {
  it('Creates a cache entry for a requests when none exists', async () => {
    let hitCount = 0;
    const { registry, cache } = await makeRegistry();

    registry.http.get('cachable', '/cacheable')
      .public()
      .cache(cache.store())
      .handle('text/plain', (ctx) => {
        hitCount++;
        ctx.body = 'Cacheable';
      });

    const result = await registry.primeCache(
      new Request('https://example.com/cacheable')
    );
    const res = await registry.handleRequest(
      new Request('https://example.com/cacheable')
    );

    assert.equal(hitCount, 1);
    assert.equal(result, 'cached');
    assert.equal(res.headers.get('X-Cache'), 'HIT');
    assert.equal(await res.text(), 'Cacheable');
  });
});
