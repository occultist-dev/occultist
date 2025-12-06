import {NextFn} from '../actions/spec.js';
import { ConditionalRequestRules } from './etag.js';
import type { CacheHTTPArgs, CacheETagArgs, CacheStoreArgs, CacheEntryDescriptor, CacheMeta, CacheStorage, CacheContext, CacheHitHandle, CacheMissHandle, LockedCacheMissHandle } from './types.js';


export type CacheArgs<
  StorageKey extends string = string,
> =
  & {
    cache?: Cache;
  }
  & (
    | CacheHTTPArgs
    | CacheETagArgs
    | CacheStoreArgs<StorageKey>
  );


export class Cache<
  StorageKey extends string = string,
> {
  #cacheMeta: CacheMeta;
  #defaultStorage: CacheStorage;
  #alternatives: Map<StorageKey, CacheStorage> = new Map();

  constructor(
    cacheMeta: CacheMeta,
    defaultStorage: CacheStorage,
    alternatives?: Record<StorageKey, CacheStorage>,
  ) {
    this.#cacheMeta = cacheMeta;
    this.#defaultStorage = defaultStorage;

    if (alternatives != null) {
      this.#alternatives = new Map(
        Object.entries(alternatives) as Array<[StorageKey, CacheStorage]>
      );
    }
  }

  get defaultStorage(): CacheStorage {
    return this.#defaultStorage;
  }

  get alternatives(): ReadonlyMap<StorageKey, CacheStorage> {
    return this.#alternatives;
  }

  /**
   * Add HTTP headers to the request.
   */
  http(args?: CacheHTTPArgs): CacheArgs {
    return Object.assign(Object.create(null), args, { cache: this });
  }

  /**
   * Stores an etag value of the response and adds HTTP headers to the request.
   * Requests made to an endpoint implementing etag cache can use `If-None-Match`
   * or `If-Modified-Since` headers to test 
   */
  etag(args?: CacheETagArgs): CacheArgs {
    return Object.assign(Object.create(null), args, { cache: this });
  }

  /**
   * Caches the body of the response, stores and etag and adds HTTP headers to the request.
   */
  store(args?: CacheStoreArgs<StorageKey>): CacheStoreArgs<StorageKey> & { cache: Cache } {
    return Object.assign(Object.create(null), args, { cache: this });
  }

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
      } else if (when === 'authenticated' && ctx.authKey != null) {
        return true;
      } else if (typeof when === 'function') {
        return when(ctx);
      }

      return false;
    });

    if (descriptor == null) {
      return await next();
    }

    switch (descriptor.type) {
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
    const resourceState = await this.#cacheMeta.get(key);

    if (resourceState.type === 'cache-hit') {
      if (rules.ifMatches(resourceState.etag)) {

        return;
      } else if (!rules.ifNoneMatch(resourceState.etag)) {
        ctx.status = 304;

        return

      }
    }

    this.#setHeaders(descriptor, ctx);

    await next();
  }

  async #useStore(
    descriptor: CacheEntryDescriptor<CacheStoreArgs>,
    ctx: CacheContext,
    next: NextFn,
  ): Promise<void> {
    const key = this.#makeKey(descriptor);
    const rules = new ConditionalRequestRules(ctx.req);
    const storage = descriptor.args.storage == null
      ? this.#defaultStorage
      : this.#alternatives.get(descriptor.args.storage as StorageKey);

    if (storage == null) {
      return this.#useHTTP(descriptor, ctx, next)
    }

    let resourceState: CacheHitHandle | LockedCacheMissHandle | undefined;

    try {
      resourceState = await this.#cacheMeta.getOrLock(key);
    } catch (err) {
      console.error(err);
    }

    if (resourceState?.type === 'cache-hit') {
      if (rules.ifMatches(resourceState.etag)) {
        ctx.status = 304;

        return;
      } else if (!rules.ifNoneMatch(resourceState.etag)) {
        ctx.status = 304;

        return;
      }

      if (resourceState.hasContent) {
        try {
          ctx.bodyStream = await storage.get(key);
        } catch (err) {
          console.log(err);
        }
      }
    }

    try {
      this.#setHeaders(descriptor, ctx);

      await next();

      await storage.set(key, ctx.bodyStream);
    } catch (err) {
      console.error(err);
      if (resourceState.type === 'locked-cache-miss') {
        await resourceState.release();
      }
    }
  }
}

export type CacheMiddlewareArgs =
  & { cache: Cache }
  & (
    | CacheHTTPArgs
    | CacheETagArgs
    | CacheStoreArgs
  )
;

