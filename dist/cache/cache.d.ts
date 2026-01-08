import type { CacheContext, ImplementedAction, NextFn, Registry } from '../mod.ts';
import type { CacheBuilder, CacheETagArgs, CacheETagInstanceArgs, CacheHTTPArgs, CacheHTTPInstanceArgs, CacheInstanceArgs, CacheMeta, CacheSemantics, CacheStorage, CacheStoreArgs, CacheStoreInstanceArgs, UpstreamCache } from './types.ts';
/**
 * Creates a unique cache key based of the values of the
 * request, auth and cache args.
 *
 * The auth key, if provided is checked to ensure it is
 * a string and it is not empty or only whitespace characters.
 *
 * The action name and cache version are also checked to
 * make sure they have valid values.
 *
 * The cache key uri encodes key segments to and separates
 * them with the pipe character `|`.
 *
 * @param httpMethod The method the action accepts.
 * @param requestURL The url of the request.
 * @param contentType The negotiated content type of the response.
 * @param languageCode The negotiated language of the response.
 * @param encoding The negotiated encoding of the response.
 * @param requestHeaders The request headers.
 * @param authKey The auth key produced by the action's auth middleware.
 * @param publicWhenAuthenticated True if the cache does not vary on the auth key.
 * @param cacheVersion Version of the cached representation. Defaults to 1.
 * @param cacheVary String separated header names to vary on.
 * @returns A unique cache key for the response.
 */
export declare function makeCacheKey(httpMethod: string, requestURL: string, contentType: string, languageCode: string | null, encoding: string | null, requestHeaders: Headers, authKey: string | null, publicWhenAuthenticated: boolean, cacheVersion: number | null, cacheVary: string | null): string;
export declare class Cache implements CacheBuilder {
    #private;
    constructor(registry: Registry, cacheMeta: CacheMeta, storage: CacheStorage, upstream?: UpstreamCache);
    get registry(): Registry;
    get meta(): CacheMeta;
    get storage(): CacheStorage;
    get upstream(): UpstreamCache | undefined;
    http(args?: CacheHTTPArgs): CacheHTTPInstanceArgs;
    etag(args?: CacheETagArgs): CacheETagInstanceArgs;
    store(args?: CacheStoreArgs): CacheStoreInstanceArgs;
    invalidate(key: string, url: string): Promise<void>;
}
/**
 * Contains information that is used when determining the caching
 * method and building a unique cache key for the request.
 */
export declare class CacheDescriptor {
    contentType: string;
    languageCode: string;
    semantics: CacheSemantics;
    action: ImplementedAction;
    req: Request;
    args: CacheInstanceArgs;
    safe: boolean;
    lock: boolean;
    constructor(contentType: string, languageCode: string | undefined, action: ImplementedAction, req: Request, args: CacheInstanceArgs);
}
/**
 * Used internally by Occultist to apply caching rules to
 * requests and programmically triggered cache interactions.
 */
export declare class CacheMiddleware {
    #private;
    /**
     * Middleware used to apply cacheing logic to
     * requests.
     *
     * @param descriptor The cache descriptor.
     * @param ctx A cache context instance.
     * @param next The next function.
     * @return Promise containing a cache status.
     */
    middleware(descriptor: CacheDescriptor, ctx: CacheContext, next: NextFn): Promise<void>;
}
