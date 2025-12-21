import {createHash} from 'node:crypto';
import {CacheContext, type NextFn, Registry} from '../mod.ts';
import {EtagConditions} from './etag.ts';
import type {CacheBuilder, CacheEntryDescriptor, CacheETagArgs, CacheETagInstanceArgs, CacheHitHandle, CacheHTTPArgs, CacheHTTPInstanceArgs, CacheMeta, CacheMissHandle, CacheSemantics, CacheStorage, CacheStoreArgs, CacheStoreInstanceArgs, LockedCacheMissHandle, UpstreamCache} from './types.ts';

const supportedSemantics: CacheSemantics[] = [
  'options',
  'head',
  'get',
  'post',
  'put',
  'delete',
  'query',
];

export class Cache implements CacheBuilder {
  #registry: Registry;
  #cacheMeta: CacheMeta;
  #storage: CacheStorage;
  #upstream?: UpstreamCache;

  constructor(
    registry: Registry,
    cacheMeta: CacheMeta,
    storage: CacheStorage,
    upstream?: UpstreamCache,
  ) {
    this.#registry = registry;
    this.#cacheMeta = cacheMeta;
    this.#storage = storage;
    this.#upstream = upstream;
  }

  get registry(): Registry {
    return this.#registry;
  }

  get meta(): CacheMeta {
    return this.#cacheMeta;
  }

  get storage(): CacheStorage {
    return this.#storage;
  }

  get upstream(): UpstreamCache {
    return this.#upstream;
  }

  /**
   * Add HTTP headers to the request.
   */
  http(args?: CacheHTTPArgs): CacheHTTPInstanceArgs {
    return Object.assign(Object.create(null), args, {
      strategy: 'http',
      cache: this,
    });
  }

  /**
   * Stores an etag value of the response and adds HTTP headers to the request.
   * Requests made to an endpoint implementing etag cache can use `If-None-Match`
   * or `If-Modified-Since` headers to test 
   */
  etag(args?: CacheETagArgs): CacheETagInstanceArgs {
    return Object.assign(Object.create(null), args, {
      strategy: 'etag',
      cache: this,
    });
  }

  /**
   * Caches the body of the response, stores and etag and adds HTTP headers to the request.
   */
  store(args?: CacheStoreArgs): CacheStoreInstanceArgs {
    return Object.assign(Object.create(null), args, {
      strategy: 'store',
      cache: this,
    });
  }

  async push(_req: Request): Promise<void> {

  }

  async invalidate(key: string, url: string): Promise<void> {
    const promises = [
      this.#cacheMeta.invalidate(key),
      this.#storage.invalidate(key),
    ];

    if (this.#upstream != null)
      promises.push(this.upstream.invalidate(url));

    await Promise.all(promises);
  }
}

export class CacheMiddleware {
  async use(
    descriptors: CacheEntryDescriptor[],
    ctx: CacheContext,
    next: NextFn,
  ): Promise<void> {
    const descriptor = descriptors.find((descriptor) => {
      const when = descriptor.args.when;

      if (when == null) {
        return true;
      } else if (when === 'always') {
        return true;
      } else if (when === 'public' && ctx.authKey == null) {
        return true;
      } else if (when === 'private' && ctx.authKey != null) {
        return true;
      } else if (typeof when === 'function') {
        return when(ctx);
      }

      return false;
    });

    if (descriptor == null || !supportedSemantics.includes(descriptor.semantics)) {
      return await next();
    }

    if (descriptor.semantics === 'put' || descriptor.semantics === 'delete') {
      this.#useInvalidate(descriptor, ctx, next);
      return;
    }

    switch (descriptor.args.strategy) {
      case 'http': {
        await this.#useHTTP(descriptor, ctx, next);
        break;
      }
      case 'etag': {
        await this.#useEtag(descriptor, ctx, next);
        break;
      }
      case 'store': {
        await this.#useStore(descriptor, ctx, next);
        break;
      }
    }
  }

  /**
   * @todo Implement vary rules.
   */
  #makeKey(
    descriptor: CacheEntryDescriptor,
    ctx: CacheContext,
  ): string {
    const { authKey } = ctx;
    const { contentType } = descriptor;
    const { version } = descriptor.args;
    const { name } = descriptor.action;
    const { url } = descriptor.request;

    if (authKey == null)
      return 'v' + (version ?? 0) + '|' + name + '|' + contentType.toLowerCase() + '|' + url.toString();
    
    return 'v' + (version ?? 0) + '|' + name + '|' + contentType.toLowerCase() + '|' + url.toString() + '|' + authKey;
  }


  /**
   * Sets response headers based of the cache args and authorization status.
   */
  #setHeaders(
    descriptor: CacheEntryDescriptor,
    ctx: CacheContext,
  ): void {
    const args = descriptor.args;
    const cacheControl: string[] = [];

    if (ctx.authKey != null && args.publicWhenAuthenticated) {
      cacheControl.push('public');
    } else if (ctx.authKey != null || args.private) {
      cacheControl.push('private');
    } else if (ctx.public) {
      cacheControl.push('public');
    }

    if (cacheControl.length !== 0) {
      ctx.headers.set('Cache-Control', cacheControl.join(', '));
    }
  }

  /**
   * Used for PUT and DELETE requests which should invalidate the cache
   * when successful.
   */
  async #useInvalidate(
    descriptor: CacheEntryDescriptor,
    ctx: CacheContext,
    next: NextFn,
  ): Promise<void> {
    await next();

    if (ctx.status != null || ctx.status.toString()[0] !== '2') {
      return;
    }

    const key = this.#makeKey(descriptor, ctx);
    const args = descriptor.args;
    const cache = args.cache;
    
    await cache.invalidate(
      key,
      ctx.url,
    );
  }

  async #useHTTP(
    descriptor: CacheEntryDescriptor,
    ctx: CacheContext,
    next: NextFn,
  ): Promise<void> {
    this.#setHeaders(descriptor, ctx);

    await next();
  }

  async #useEtag(
    descriptor: CacheEntryDescriptor,
    ctx: CacheContext,
    next: NextFn,
  ): Promise<void> {
    const key = this.#makeKey(descriptor, ctx);
    const rules = new EtagConditions(ctx.req.headers);
    const resourceState = await descriptor.args.cache.meta.get(key);

    this.#setHeaders(descriptor, ctx);

    if (resourceState.type === 'cache-hit') {
      if (rules.ifMatch(resourceState.etag)) {
        return;
      } else if (!rules.ifNoneMatch(resourceState.etag)) {
        ctx.hit = true;
        ctx.status = 304;

        return
      }
    }

    await next();
  }

  async #useStore(
    descriptor: CacheEntryDescriptor,
    ctx: CacheContext,
    next: NextFn,
  ): Promise<void> {
    const key = this.#makeKey(descriptor, ctx);
    let resourceState:  CacheHitHandle | CacheMissHandle | LockedCacheMissHandle | undefined;
    const args = descriptor.args;
    const cache = args.cache;

    this.#setHeaders(descriptor, ctx);

    if (descriptor.semantics === 'get' ||
        descriptor.semantics === 'head' ||
        descriptor.semantics === 'options' ||
        descriptor.semantics === 'query'
    ) {
      if (
        typeof cache.meta.getOrLock === 'function' &&
        args.lock
      ) {
        try {
          resourceState = await cache.meta.getOrLock(key);
        } catch (err) {
          resourceState = await cache.meta.get(key);
        }
      } else {
        resourceState = await cache.meta.get(key);
      }

      if (resourceState?.type === 'cache-hit') {
        if (this.#isNotModified(ctx.req.headers, resourceState.etag)) {
          ctx.hit = true;
          ctx.status = 304;

          return;
        }

        if (resourceState.hasContent) {
          try {
            ctx.hit = true;
            ctx.status = resourceState.status;
            ctx.body = await cache.storage.get(key);

            for (const [key, value] of resourceState.headers.entries()) {
              ctx.headers.set(key, value);
            }

            return;
          } catch (err) {
            console.log(err);
          }
        }
      }
    }

    try {
      await next();

      const body = await new Response(ctx.body).blob();
      const etag = await this.#createEtag(body);

      ctx.etag = etag;
      ctx.headers.set('Etag', etag);

      await cache.meta.set(key, {
        key,
        authKey: ctx.authKey,
        iri: ctx.url,
        status: ctx.status ?? 200,
        hasContent: ctx.body != null,
        headers: ctx.headers,
        contentType: ctx.contentType,
        etag,
      });

      if (ctx.body != null) {
        await cache.storage.set(key, body);
      }

      if (resourceState.type === 'locked-cache-miss') {
        await resourceState.release();
      }

      if (this.#isNotModified(ctx.req.headers, etag)) {
        ctx.hit = true;
        ctx.status = 304;
        ctx.body = null;
        
        return;
      }
    } catch (err) {
      if (resourceState.type === 'locked-cache-miss') {
        await resourceState.release();
      }
    }
  }

  /**
   * Returns true if the request has conditional headers
   * which should result in a not modified response.
   */
  #isNotModified(headers: Headers, etag: string): boolean {
    const rules = new EtagConditions(headers);

    return rules.isNotModified(etag);
  }

  /**
   * Creates a strong etag using a sha1 hashing algorithim.
   */
  async #createEtag(body: Blob): Promise<string> {
    const buff = await body.bytes();
    const hash = createHash('sha1').update(buff).digest('hex');

    return `"${hash}"`;
  }

}
