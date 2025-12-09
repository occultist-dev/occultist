import {createHash} from 'node:crypto';
import {NextFn, ParsedIRIValues} from '../actions/spec.js';
import {Context, ImplementedAction, Registry} from '../mod.js';
import {ConditionalRequestRules} from './etag.js';
import type {CacheBuilder, CacheEntryDescriptor, CacheETagArgs, CacheETagInstanceArgs, CacheHitHandle, CacheHTTPArgs, CacheHTTPInstanceArgs, CacheMeta, CacheMissHandle, CacheStorage, CacheStoreArgs, CacheStoreInstanceArgs, LockedCacheMissHandle, UpstreamCache} from './types.js';


export type CacheNextFn = () => Promise<Context>;

export type CacheContextArgs = {
  url: string;
  contentType?: string;
  method: string;
  public: boolean;
  authKey?: string;
  action: ImplementedAction;
  params: ParsedIRIValues;
};

export class CacheContext {
  hit: boolean = false;
  url: string;
  contentType?: string;
  method: string;
  public: boolean;
  authKey?: string;
  action: ImplementedAction;
  registry: Registry;
  params: ParsedIRIValues;
  status?: number;
  body?: Uint8Array;
  headers?: Headers;

  constructor(args: CacheContextArgs) {
    this.url = args.url;
    this.contentType = args.contentType;
    this.method = args.method;
    this.public = args.public;
    this.authKey = args.authKey;
    this.action = args.action;
    this.params = args.params;
  }
}

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

  async invalidate(_req: Request): Promise<void> {

  }
}

export class CacheMiddleware {
  async use(
    descriptors: CacheEntryDescriptor[],
    ctx: CacheContext,
    next: CacheNextFn,
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
      await next();
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
  #makeKey(descriptor: CacheEntryDescriptor): string {
    const { contentType } = descriptor;
    const { version } = descriptor.args;
    const { name } = descriptor.action;
    const { url } = descriptor.request;

    return 'v' + (version ?? 0) + '|' + name + '|' + contentType.toLowerCase() + '|' + url.toString();
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
    next: CacheNextFn,
  ): Promise<void> {
    this.#setHeaders(descriptor, ctx);

    await next();
  }

  async #useEtag(
    descriptor: CacheEntryDescriptor,
    ctx: CacheContext,
    next: CacheNextFn,
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
    next: CacheNextFn,
  ): Promise<void> {
    const key = this.#makeKey(descriptor);
    const rules = new ConditionalRequestRules(ctx.req);
    let resourceState:  CacheHitHandle | CacheMissHandle | LockedCacheMissHandle | undefined;

    if (
      typeof descriptor.args.cache.meta.getOrLock === 'function' &&
      descriptor.args.lock
    ) {
      try {
        resourceState = await descriptor.args.cache.meta.getOrLock(key);
      } catch (err) {
        resourceState = await descriptor.args.cache.meta.get(key);
      }
    } else {
      resourceState = await descriptor.args.cache.meta.get(key);
    }

    if (resourceState?.type === 'cache-hit') {

      //if (rules.ifMatches(resourceState.etag)) {
      //  ctx.status = 304;

      //  return;
      //} else if (!rules.ifNoneMatch(resourceState.etag)) {
      //  ctx.status = 304;

      //  return;
      //}

      if (resourceState.hasContent) {
        try {
          ctx.hit = true;
          ctx.status = resourceState.status;
          ctx.headers = resourceState.headers;
          ctx.body = await descriptor.args.cache.storage.get(key);

          return;
        } catch (err) {
          console.log(err);
        }
      }
    }

    try {
      this.#setHeaders(descriptor, ctx);

      const actionContext = await next();
      let body: Uint8Array;

      if (actionContext.body instanceof ReadableStream) {
        const [t1, t2] = actionContext.body.tee();
        actionContext.body = t1;
        body = await new Response(t2).bytes()
      } else if (actionContext.body != null) {
        body = await new Response(actionContext.body).bytes();
      }

      await descriptor.args.cache.meta.set(key, {
        key,
        authKey: actionContext.authKey,
        iri: actionContext.url,
        status: actionContext.status ?? 200,
        hasContent: actionContext.body != null,
        headers: actionContext.headers,
        contentType: actionContext.contentType,
        etag: this.#createEtag(body),
      });

      if (actionContext.body != null) {
        await descriptor.args.cache.storage.set(key, body);
      }
    } catch (err) {
      if (resourceState.type === 'locked-cache-miss') {
        await resourceState.release();
      }
    }
  }

  #createEtag(body: Uint8Array, weak: boolean = true): string {
    const hash = createHash('sha1').update(body).digest('hex');
    const quoted = `"${hash}"`;
    return weak ? `W/${quoted}` : quoted;
  }

}
