import { CacheContext, NextFn, Registry } from '../mod.js';
import type { CacheBuilder, CacheEntryDescriptor, CacheETagArgs, CacheETagInstanceArgs, CacheHTTPArgs, CacheHTTPInstanceArgs, CacheMeta, CacheStorage, CacheStoreArgs, CacheStoreInstanceArgs, UpstreamCache } from './types.js';
export declare class Cache implements CacheBuilder {
    #private;
    constructor(registry: Registry, cacheMeta: CacheMeta, storage: CacheStorage, upstream?: UpstreamCache);
    get registry(): Registry;
    get meta(): CacheMeta;
    get storage(): CacheStorage;
    get upstream(): UpstreamCache;
    /**
     * Add HTTP headers to the request.
     */
    http(args?: CacheHTTPArgs): CacheHTTPInstanceArgs;
    /**
     * Stores an etag value of the response and adds HTTP headers to the request.
     * Requests made to an endpoint implementing etag cache can use `If-None-Match`
     * or `If-Modified-Since` headers to test
     */
    etag(args?: CacheETagArgs): CacheETagInstanceArgs;
    /**
     * Caches the body of the response, stores and etag and adds HTTP headers to the request.
     */
    store(args?: CacheStoreArgs): CacheStoreInstanceArgs;
    push(_req: Request): Promise<void>;
    invalidate(_req: Request): Promise<void>;
}
export declare class CacheMiddleware {
    #private;
    use(descriptors: CacheEntryDescriptor[], ctx: CacheContext, next: NextFn): Promise<void>;
}
