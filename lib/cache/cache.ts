import {createHash} from 'node:crypto';
import {CacheContext, ImplementedAction, type NextFn, Registry} from '../mod.ts';
import {EtagConditions} from './etag.ts';
import type {CacheBuilder, CacheETagArgs, CacheETagInstanceArgs, CacheHitHandle, CacheHTTPArgs, CacheHTTPInstanceArgs, CacheInstanceArgs, CacheMeta, CacheMissHandle, CacheSemantics, CacheStorage, CacheStoreArgs, CacheStoreInstanceArgs, LockedCacheMissHandle, UpstreamCache} from './types.ts';


const supportedSemantics: CacheSemantics[] = [
  'options',
  'head',
  'get',
  'post',
  'put',
  'delete',
  'query',
] as const;

const safeSemantics = new Set<CacheSemantics>([
  'options',
  'head',
  'get',
  'query',
]);

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

  get upstream(): UpstreamCache | undefined {
    return this.#upstream;
  }

  http(args?: CacheHTTPArgs): CacheHTTPInstanceArgs {
    return Object.assign(Object.create(null), args, {
      strategy: 'http',
      cache: this,
    });
  }

  etag(args?: CacheETagArgs): CacheETagInstanceArgs {
    return Object.assign(Object.create(null), args, {
      strategy: 'etag',
      cache: this,
    });
  }

  store(args?: CacheStoreArgs): CacheStoreInstanceArgs {
    return Object.assign(Object.create(null), args, {
      strategy: 'store',
      cache: this,
    });
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

/**
 * Contains information that is used when determining the caching
 * method and building a unique cache key for the request.
 */
export class CacheDescriptor {
  contentType: string;
  semantics: CacheSemantics;
  action: ImplementedAction;
  req: Request;
  args: CacheInstanceArgs;
  safe: boolean;
  lock: boolean;

  constructor(
    contentType: string,
    action: ImplementedAction,
    req: Request,
    args: CacheInstanceArgs,
  ) {
    this.contentType = contentType;
    this.semantics = args.semantics ?? req.method.toLowerCase() as CacheSemantics;
    this.action = action;
    this.req = req;
    this.args = args;
    this.safe = safeSemantics.has(this.semantics);
    this.lock = args.lock &&
        args.cache.meta.allowLocking &&
        typeof args.cache.meta.getOrLock === 'function';
  }

};

export class CacheMiddleware {
  
  /**
   *
   */
  async prime(
    descriptor: CacheDescriptor,
    ctx: CacheContext,
    next: NextFn,
  ): Promise<boolean> {

  }

  async use(
    descriptor: CacheDescriptor,
    ctx: CacheContext,
    next: NextFn,
  ): Promise<void> {
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

    if (typeof descriptor.args.cache.upstream?.extendHeaders === 'function') {
      descriptor.args.cache.upstream.extendHeaders(
        ctx.headers,
        descriptor.args,
        ctx.req,
      );
    }
  }

  /**
   * @todo Implement vary rules.
   */
  #makeKey(
    descriptor: CacheDescriptor,
    ctx: CacheContext,
  ): string {
    const { authKey } = ctx;
    const { contentType } = descriptor;
    const { version } = descriptor.args;
    const { name } = descriptor.action;
    const { url } = descriptor.req;

    if (authKey == null)
      return 'v' + (version ?? 0) + '|' + name + '|' + contentType.toLowerCase() + '|' + url.toString();
    
    return 'v' + (version ?? 0) + '|' + name + '|' + contentType.toLowerCase() + '|' + url.toString() + '|' + authKey;
  }


  /**
   * Sets response headers based of the cache args and authorization status.
   */
  #setHeaders(
    descriptor: CacheDescriptor,
    ctx: CacheContext,
  ): void {
    let date: Date;
    const args = descriptor.args;
    const cacheControl: string[] = [];

    if (ctx.authKey != null && args.public) {
      cacheControl.push('public');
    } else if (ctx.authKey != null || args.private) {
      cacheControl.push('private');
    } else if (args.public) {
      cacheControl.push('public');
    }

    if (args.noCache)
      cacheControl.push('no-cache');
    if (args.noStore) 
      cacheControl.push('no-store');
    if (args.mustRevalidate)
      cacheControl.push('must-revalidate');
    if (args.mustUndestand)
      cacheControl.push('must-understand');
    if (args.noTransform)
      cacheControl.push('no-transform');
    if (args.immutable)
      cacheControl.push('immutable');
    if (args.proxyRevalidate)
      cacheControl.push('proxy-revalidate');
    if (args.maxAge != null)
      cacheControl.push(`max-age=${args.maxAge}`);
    if (args.sMaxAge != null)
      cacheControl.push(`s-maxage=${args.sMaxAge}`);
    
    if (typeof args.expires === 'function') {
      date = args.expires();
      cacheControl.push(`expires=${date.toUTCString()}`);
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
    descriptor: CacheDescriptor,
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
    descriptor: CacheDescriptor,
    ctx: CacheContext,
    next: NextFn,
  ): Promise<void> {
    this.#setHeaders(descriptor, ctx);

    await next();
  }

  async #useEtag(
    descriptor: CacheDescriptor,
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
    descriptor: CacheDescriptor,
    ctx: CacheContext,
    next: NextFn,
  ): Promise<void> {
    const key = this.#makeKey(descriptor, ctx);
    let resourceState:  CacheHitHandle | CacheMissHandle | LockedCacheMissHandle | undefined;
    const args = descriptor.args;
    const cache = args.cache;

    this.#setHeaders(descriptor, ctx);

    try {
      // post methods can use #useStore() but are not safe so skip the cache.
      if (descriptor.safe && descriptor.lock) {
        resourceState = await cache.meta.getOrLock(key);
      } else if (descriptor.safe) {
        resourceState = await cache.meta.get(key);
      }
    } catch (err) {
      console.error(err);
      console.log('Error when fetching cached meta content');
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

          for (const [key, value] of Object.entries(resourceState.headers)) {
            if (Array.isArray(value)) {
              ctx.headers.delete(key);

              for (let i = 0; i < value.length; i++) {
                ctx.headers.append(key, value[i]);
              }
            } else {
              ctx.headers.set(key, value);
            }
          }

          return;
        } catch (err) {
          console.log(err);
        }
      }
    }

    try {
      await next();

      const body = await new Response(ctx.body).blob();

      ctx.etag = ctx.headers.get('Etag') ?? await this.#createEtag(body);
      ctx.headers.set('Etag', ctx.etag);

      await cache.meta.set(key, {
        key,
        authKey: ctx.authKey,
        iri: ctx.url,
        status: ctx.status ?? 200,
        hasContent: ctx.body != null,
        headers: Object.fromEntries(ctx.headers.entries()),
        contentType: ctx.contentType,
        etag: ctx.etag,
      });

      if (ctx.body != null) {
        await cache.storage.set(key, body);
      }

      if (resourceState.type === 'locked-cache-miss') {
        await resourceState.release();
      }

      if (this.#isNotModified(ctx.req.headers, ctx.etag)) {
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
