import type { NextFn } from '../types.ts';
import { ConditionalRequestRules } from './etag.ts';
import type { CacheHTTPArgs, CacheETagArgs, CacheStoreArgs, CacheEntryDescriptor, CacheMeta, CacheStorage, CacheContext } from './types.ts';


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

  http(args?: CacheHTTPArgs): CacheArgs {
    return Object.assign(Object.create(null), args, { cache: this });
  }

  etag(args?: CacheETagArgs): CacheArgs {
    return Object.assign(Object.create(null), args, { cache: this });
  }

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
    const key = this.makeKey(descriptor);
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
    const key = this.makeKey(descriptor);
    const rules = new ConditionalRequestRules(ctx.req);
    const storage = descriptor.args.storage == null
      ? this.#defaultStorage
      : this.#alternatives.get(descriptor.args.storage as StorageKey);

    if (storage == null) {
      return this.#useHTTP(descriptor, ctx, next)
    }

    let resourceState: CachedLockHandle | UncachedLockHandle | undefined;

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

      // resourceState?.set(key);
    } catch (err) {
      console.error(err);
      await resourceState.release();
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

