import type { AuthState, ImplementedAction } from "../actions/types.ts";
import type { CacheContext } from "../mod.ts";
export type CacheStrategyType = 'http' | 'etag' | 'store';
export type CacheSemantics = 'options' | 'head' | 'get' | 'post' | 'put' | 'delete' | 'query';
export interface CacheEntryDescriptor {
    contentType: string;
    semantics: CacheSemantics;
    action: ImplementedAction;
    request: Request;
    args: CacheInstanceArgs;
}
export type CacheWhenFn<Auth extends AuthState = AuthState> = (ctx: CacheContext<Auth>) => boolean;
export type CacheRuleArgs = {
    /**
     * A version which should increment every when a new release
     * causes the existing cache to become stale.
     */
    version?: number;
    lock?: boolean;
    /**
     * Defaults to varying on the authorization header
     * when authenticated.
     */
    vary?: string;
    varyOnAuth?: boolean;
    varyOnCapabilities?: string | string[];
    /**
     * Overrides the semantics of the cache.
     */
    semantics?: CacheSemantics;
    /**
     * Defaults to false when a querystring is present
     * or the request is authenticated.
     *
     * @default 'public-no-query'
     */
    when?: 'always' | 'public' | 'private' | 'no-query' | 'public-no-query' | 'private-no-query' | CacheWhenFn;
};
export type CacheControlArgs = {
    private?: boolean;
    publicWhenAuthenticated?: true;
    noCache?: true;
    noStore?: true;
    mustRevalidate?: true;
    mustUndestand?: true;
    noTransform?: true;
    immutable?: true;
    proxyRevalidate?: true;
    expires?: () => number | Date;
    maxAge?: number | Date | (() => number | Date);
    etag?: string;
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
     * Pushes a representation to the upstream cache.
     */
    push(args: {
        url: string;
        headers: Headers;
        data: Blob;
    }): Promise<void>;
    /**
     * Invalidates a representation in the upstream cache.
     */
    invalidate(url: string): Promise<void>;
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
    meta: CacheMeta;
    storage: CacheStorage;
    upstream: UpstreamCache | undefined;
    http(args?: CacheHTTPArgs): CacheInstanceArgs;
    etag(args?: CacheETagArgs): CacheInstanceArgs;
    store(args?: CacheStoreArgs): CacheInstanceArgs;
    /**
     * Removes an item from the cache.
     */
    invalidate(key: string, url: string): void | Promise<void>;
    push?(request: Request): Promise<void>;
}
