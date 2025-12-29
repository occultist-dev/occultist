import type { AuthState } from "../actions/types.ts";
import type { CacheContext } from "../mod.ts";
export type CacheStrategyType = 'http' | 'etag' | 'store';
export type CacheSemantics = 'options' | 'head' | 'get' | 'post' | 'put' | 'delete' | 'query';
export type CacheOperation = 'prime' | 'refresh' | 'invalidate';
export type CacheOperationResult = 'not-found' | 'unsupported' | 'skipped' | 'cached' | 'invalidated';
/**
 * A predicate function which takes the cache context
 * as an argument and returns true if the response
 * should be cached.
 */
export type CacheWhenFn<Auth extends AuthState = AuthState> = (cacheCtx: CacheContext<Auth>) => boolean;
/**
 * Rules determining if the request should be cached even if
 * the action supports it. An action can have multiple cache
 * rules defined on it incase the first does not match for
 * the request.
 *
 * default:
 *   If there is a query string:
 *     Don't cache
 *   If the request is authenticated:
 *     If the action is private:
 *       Cache
 *     Else:
 *       Don't cache
 *   Else:
 *     Cache
 *
 * always:
 *   Always cache
 *
 * unauthenticated:
 *   Caches unauthenticated requests.
 *
 * authenticated:
 *   Caches authenticated requests.
 *
 * no-query:
 *   Caches when there is no querystring.
 *
 * unauthenticated-no-query:
 *   Caches unauthenticated requests if they
 *   have no querystring.
 *
 * authenticated-no-query:
 *   Caches authenticated requests if they
 *   have no querystring.
 */
export type CacheRules = 'default' | 'always' | 'unauthenticated' | 'authenticated' | 'no-query' | 'unauthenticated-no-query' | 'authenticated-no-query';
/**
 * Predicate or rules determining if the reponse should be cached.
 */
export type CacheWhen = CacheRules | CacheWhenFn;
export type CacheRuleArgs = {
    /**
     * A version number which should increment when a new
     * release causes the existing cache to become stale
     * but previously cached entries might persist.
     *
     * @default 1
     */
    version?: number;
    /**
     * When true, if supported by the caching mechanism, requests
     * will take a lock for update on the cache preventing other
     * requests to the same resource from reading until the
     * first request populates the cache.
     *
     * @default false
     */
    lock?: boolean;
    /**
     * Defaults to varying on the authorization header
     * when authenticated.
     */
    vary?: string;
    /**
     * If set to false authenticated requests will set the same
     * cached responses as unauthenticated requests.
     *
     * @default true
     */
    varyOnAuth?: boolean;
    /**
     * Overrides the semantics of the cache.
     *
     * @default The HTTP method of the action handling the request.
     */
    semantics?: CacheSemantics;
    /**
     * Rule or predicate function determining if the request should
     * be cached even if the action supports it.
     *
     * The default behaviour is:
     *   If there is a query string:
     *     Don't cache
     *   If the request is authenticated:
     *     If the action is private:
     *       Cache
     *     Else:
     *       Don't cache
     *   Else:
     *     Cache
     */
    when?: CacheWhen;
};
export type CacheControlArgs = {
    /**
     * "Cache-Control: private" tells intermediaries not to cache the request.
     *
     * @default true if the request is authenticated, otherwise unset.
     */
    private?: boolean;
    /**
     * If a request has authentication information, such as the
     * "Authorization" header being set, a CDN will not cache it.
     * Setting "Cache-Control: public" directive tells the CDN
     * that it can cache the response.
     *
     * @default false
     */
    public?: boolean;
    noCache?: boolean;
    noStore?: boolean;
    mustRevalidate?: boolean;
    mustUndestand?: boolean;
    noTransform?: boolean;
    immutable?: boolean;
    proxyRevalidate?: boolean;
    expires?: () => Date;
    maxAge?: number;
    sMaxAge?: number;
};
export type CacheHTTPArgs = {
    strong?: undefined;
    fromRequest?: undefined;
} & CacheRuleArgs & CacheControlArgs;
export type CacheHTTPInstanceArgs = CacheHTTPArgs & {
    strategy: 'http';
    cache: CacheBuilder;
};
export type CacheETagArgs = {
    strong?: boolean;
    fromRequest?: boolean;
    etag?: undefined;
} & CacheRuleArgs & Omit<CacheControlArgs, 'etag'>;
export type CacheETagInstanceArgs = CacheETagArgs & {
    strategy: 'etag';
    cache: CacheBuilder;
};
export type CacheStoreArgs = {
    strong?: boolean;
    fromRequest?: boolean;
    etag?: undefined;
} & CacheRuleArgs & Omit<CacheControlArgs, 'etag'>;
export type CacheStoreInstanceArgs = CacheStoreArgs & {
    strategy: 'store';
    cache: CacheBuilder;
};
export type CacheInstanceArgs = CacheHTTPInstanceArgs | CacheETagInstanceArgs | CacheStoreInstanceArgs;
export type CacheDetails = {
    key: string;
    iri: string;
    status?: number;
    hasContent: boolean;
    authKey: string;
    etag: string;
    headers: Record<string, string | string[]>;
    contentType: string;
    contentLength?: number;
    contentEncoding?: string;
    contentLanguage?: string;
    contentRange?: string;
};
export type CacheHitHandle = CacheDetails & {
    type: 'cache-hit';
    set(details: CacheDetails): void | Promise<void>;
};
export type CacheMissHandle = {
    type: 'cache-miss';
    set(details: CacheDetails): void | Promise<void>;
};
export type LockedCacheMissHandle = {
    type: 'locked-cache-miss';
    set(details: CacheDetails): void | Promise<void>;
    release(): void | Promise<void>;
};
/**
 * The cache meta knows how to query a storage for current freshness
 * information on a cache entry without querying the data itself.
 *
 * Meta information might be stored in a separate data store to the
 * cached response bodies. If supported by the storage, the representation
 * can be locked for update preventing other requests for the same
 * resource from proceeding until the cached representation is created.
 */
export interface CacheMeta {
    /**
     * Actions will only be able to lock for update if allow
     * locking is enabled on the meta instance, even if a
     * `getOrLock()` method is provided.
     */
    allowLocking?: boolean;
    /**
     * Sets the cache details for a representation.
     *
     * @param key Unique key for this cached value.
     * @param details Details of the cache to store.
     */
    set(key: string, details: CacheDetails): void | Promise<void>;
    /**
     * Retrieves the cache details of a representation.
     *
     * @param key Unique key for this cached value.
     */
    get(key: string): CacheHitHandle | CacheMissHandle | Promise<CacheHitHandle | CacheMissHandle>;
    /**
     * Retrieves the cache details of a representation and takes a lock
     * for update if the representation is not current. All concurrent requests
     * targeting the same cached value will wait for the cache to be populated
     * and respond from cache. This can occur across processes if the locking
     * mechanism allows for it.
     *
     * This is an experimental API and its benifits are untested. APIs that
     * have a high failure rate could see degredation in services as requests
     * will queue to take the lock, but fail to set a new cache value causing
     * the queued requests to continue locking.
     *
     * However, this could help protect downstream services from thundering herd
     * like scenarios as only one requester will build the representation that all
     * requesters use.
     *
     * @param key Unique key for this cached value.
     */
    getOrLock?(key: string): Promise<CacheHitHandle | LockedCacheMissHandle>;
    /**
     * Invalidates a cached value by key.
     *
     * @param key Unique key for this cached value.
     */
    invalidate(key: string): void | Promise<void>;
    /**
     * Flushes the entire cache of values.
     */
    flush(): void | Promise<void>;
}
export interface UpstreamCache {
    /**
     * CDN services often support custom headers.
     * If this method is provided, any action using the upstream
     * will have its headers extended after the standard headers
     * for the request have been set.
     *
     * @param headers The headers of the response.
     * @param args Cache args provided to the cache middleware.
     * @param req The HTTP request.
     * @returns Modified headers.
     */
    extendHeaders?(headers: Headers, args: CacheInstanceArgs, req: Request): Headers;
    /**
     * Pushes a pre-rendered representation to the upstream.
     *
     * @param url The URL of the resource to cache.
     * @param content The representation content to cache.
     */
    push?(url: string, content: Blob): Promise<void>;
    /**
     * Triggers an invalidation on a representation in the upstream cache.
     *
     * @param url The URL of the cached resource.
     */
    invalidate?(url: string): Promise<void>;
    /**
     * Triggers a flush of all cached representations on the upstream.
     */
    flush?(): Promise<void>;
}
export interface CacheStorage {
    /**
     * Retrieves a cache entry.
     */
    get(key: string): Blob | Promise<Blob>;
    /**
     * Sets a cache entry.
     */
    set(key: string, data: Blob): void | Promise<void>;
    /**
     * Deletes a cache entry.
     */
    invalidate(key: string): void | Promise<void>;
    /**
     * Flushes the entire cache of values.
     */
    flush(): void | Promise<void>;
}
export interface CacheBuilder {
    /**
     * Stores meta information about the cache. Such as its
     * URL, method, content type and headers.
     */
    meta: CacheMeta;
    /**
     * Stores response content.
     */
    storage: CacheStorage;
    /**
     * Interfaces with a configured upstream, such as a CDN.
     * Allowing programmic cache invalidation and priming
     * depending on what is supported.
     */
    upstream: UpstreamCache;
    /**
     * Configures an action to use the given HTTP cache headers
     * via the cache builder interface. Using this mechanism
     * to set cache headers has some benefits. For example
     * "Cache-Control: prviate" is used by default for any
     * authenticated request.
     *
     * This method does not use any of the storage mechanisms but
     * offers a consistant API like using `cache.etag()` and
     * `cache.store()`. Using `cache.http()` also allows the
     * registry to prime or invalidate upstream cache if the
     * cache instance is configured with an upstream that supports
     * those methods.
     *
     * @param args Cache args.
     */
    http(args?: CacheHTTPArgs): CacheInstanceArgs;
    /**
     * Configures an action to use the given HTTP headers
     * and stores an etag of the response content which
     * is added to the response. Response content is not
     * stored.
     *
     * Actions using this cache strategy automatically
     * support "If-None-Match" conditional requests on
     * supporting methods.
     *
     * @param args Cache args.
     */
    etag(args?: CacheETagArgs): CacheInstanceArgs;
    /**
     * Configures an action to use the given HTTP headers,
     * store an etag and the response content.
     *
     * This action has all the benefits of using `cache.etag()`
     * but can also cache response content. Additionally
     * when a URL is accessed simultaniously, the first requester
     * can lock the cache, complete the response, and then have
     * the response content shared with the other requests instead
     * of doing the work multiple times. This is an experimental
     * solution and must be supported by the cache implementation.
     *
     * @param args Cache args.
     */
    store(args?: CacheStoreArgs): CacheInstanceArgs;
    /**
     * Invalidates a cache entry.
     *
     * This method is used internally by Occultist. The
     * recommended API for invalidating cached content
     * programmically is via the registry with a web standard
     * request instance.
     *
     * ```
     * await registry.invalidateCache(
     *   new Request('https://example.com')
     * );
     * ```
     *
     * @param key The cache key.
     * @param url The url of the request.
     */
    invalidate(key: string, url: string): Promise<void>;
}
