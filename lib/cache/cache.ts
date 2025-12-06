import {NextFn} from '../actions/spec.js';
import {Registry} from '../mod.js';
import {ConditionalRequestRules} from './etag.js';
import type {CacheBuilder, CacheContext, CacheEntryDescriptor, CacheETagArgs, CacheETagInstanceArgs, CacheHitHandle, CacheHTTPArgs, CacheHTTPInstanceArgs, CacheMeta, CacheStorage, CacheStoreArgs, CacheStoreInstanceArgs, LockedCacheMissHandle, UpstreamCache} from './types.js';


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
      stratey: 'http',
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
      stratey: 'etag',
      cache: this,
    });
  }

  /**
   * Caches the body of the response, stores and etag and adds HTTP headers to the request.
   */
  store(args?: CacheStoreArgs): CacheStoreInstanceArgs {
    return Object.assign(Object.create(null), args, {
      stratey: 'store',
      cache: this,
    });
  }

  async push(_req: Request): Promise<void> {

  }

  async invalidate(_req: Request): Promise<void> {

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

    if (descriptor == null) {
      return await next();
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
  #makeKey(descriptor: CacheEntryDescriptor): string {
    const { version } = descriptor.args;
    const { name, method } = descriptor.action;
    const { url } = descriptor.request;

    return method.toLowerCase() + '|' + name + '|v' + (version ?? 0) + '|' + url.toString();
  }

  #setHeaders(
    descriptor: CacheEntryDescriptor,
    ctx: CacheContext,
  ): void {
    const {
      
    } = descriptor.args;
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
    const key = this.#makeKey(descriptor);
    const rules = new ConditionalRequestRules(ctx.req);
    const resourceState = await descriptor.args.cache.meta.get(key);

    if (resourceState.type === 'cache-hit') {
      if (rules.ifMatches(resourceState.etag)) {
        return;
      } else if (!rules.ifNoneMatch(resourceState.etag)) {
        ctx.hit = true;
        ctx.status = 304;

        return
      }
    }

    this.#setHeaders(descriptor, ctx);

    await next();
  }

  async #useStore(
    descriptor: CacheEntryDescriptor,
    ctx: CacheContext,
    next: NextFn,
  ): Promise<void> {
    const key = this.#makeKey(descriptor);
    const rules = new ConditionalRequestRules(ctx.req);
    let resourceState: CacheHitHandle | LockedCacheMissHandle | undefined;

    try {
      resourceState = await descriptor.args.cache.meta.getOrLock(key);
    } catch (err) {
      console.error(err);
    }

    console.log('RESOURCE STATE', resourceState);

    if (resourceState?.type === 'cache-hit') {
      ctx.hit = true;
      ctx.headers.set('Server-Timing', 'cache-hit');

      if (rules.ifMatches(resourceState.etag)) {
        ctx.status = 304;

        return;
      } else if (!rules.ifNoneMatch(resourceState.etag)) {
        ctx.status = 304;

        return;
      }

      if (resourceState.hasContent) {
        try {
          ctx.bodyStream = await descriptor.args.cache.storage.get(key);
        } catch (err) {
          console.log(err);
        }
      }
    }

    try {
      this.#setHeaders(descriptor, ctx);

      await next();

      await descriptor.args.cache.storage.set(key, ctx.bodyStream);
    } catch (err) {
      if (resourceState.type === 'locked-cache-miss') {
        await resourceState.release();
      }
    }
  }

}
