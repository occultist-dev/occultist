import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {Registry, InMemoryCache, type AuthMiddleware} from '../lib/mod.ts';

const cookieRe = /^auth\s*=(.*)/;
const auth: AuthMiddleware = (req) => {
  let authKey: string;
  const authorization = req.headers.get('Authorization');
  const cookies = req.headers.get('Cookie');
  const singleUseToken = new URL(req.url).searchParams.get('single-use-token');

  if (singleUseToken != null) {
    authKey = singleUseToken;
  }
  
  if (authKey == null && cookies != null) {
    const values = cookies.split(';');

    let cookie: string;
    for (let i = 0; i < values.length; i++) {
      cookie = values[i].trim();

      if (cookieRe.test(cookie)) {
        cookieRe.lastIndex = 0;
        authKey = cookieRe.exec(cookie)[1].trim();
      }
    }
  }
  
  if (authKey == null && authorization != null) {
    authKey = authorization.replace('Bearer ', '');
  }

  if (typeof authKey !== 'string' || authKey.length === 0) {
    return;
  } else if (authKey === 'BADBADBAD') {
    return;
  }

  return [authKey, Object.create(null)];
};

function makeRegistry() {
  const registry = new Registry({
    rootIRI: 'https://example.com',
    serverTiming: true,
    cacheHitHeader: true,
  });
  const cache = new InMemoryCache(registry);
  
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
    .public(auth)
    .cache(cache.store())
    //.define({
    //  spec: {
    //    singleUseToken: {
    //      dataType: 'string',
    //      valueName: 'singleUseToken',
    //    },
    //  }
    //})
    .handle('text/plain', (ctx) => {
      ctx.body = `OPEN(${ctx.authKey ?? 'unauthenticated'})`;
    });

  registry.http.get('private', '/private')
    .private(auth)
    .cache(cache.store())
    .handle('text/plain', (ctx) => {
      ctx.body = `PRIVATE(${ctx.authKey})`;
    });

  return {
    registry,
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
});

