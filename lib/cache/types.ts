import {ImplementedAction} from "../actions/types.js";
import {ParsedIRIValues, Registry} from "../mod.js";

export type CacheStrategyType =
  | 'http'
  | 'etag'
  | 'store'
;

export interface CacheEntryDescriptor {
  contentType: string;
  action: ImplementedAction;
  request: Request;
  args: CacheInstanceArgs;
};

export type CacheWhenFn = (
  ctx: CacheContext,
) => boolean;

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
   * Defaults to false when a querystring is present
   * or the request is authenticated.
   *
   * @default 'public-no-query'
   */
  when?: 'always' | 'public' | 'private' | 'no-query' | 'public-no-query' | 'private-no-query' | CacheWhenFn;
};

export type CacheControlArgs = {
  private?: boolean;
  public?: true;
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

export type CacheHTTPArgs =
  & {
    strategy: 'http';
    strong?: undefined;
    fromRequest?: undefined;
  }
  & CacheRuleArgs
  & CacheControlArgs
;

export type CacheHTTPInstanceArgs =
  & CacheHTTPArgs
  & { strategy: 'http', cache: CacheBuilder }
;

export type CacheETagArgs =
  & {
    strategy: 'etag';
    strong?: boolean;
    fromRequest?: boolean;
    etag?: undefined;
  }
  & CacheRuleArgs
  & Omit<CacheControlArgs, 'etag'>
;

export type CacheETagInstanceArgs =
  & CacheETagArgs
  & { stratey: 'etag', cache: CacheBuilder }
;

export type CacheStoreArgs =
  & {
    strategy: 'store';
    strong?: boolean;
    fromRequest?: boolean;
    etag?: undefined;
  }
  & CacheRuleArgs
  & Omit<CacheControlArgs, 'etag'>
;

export type CacheStoreInstanceArgs =
  & CacheStoreArgs
  & { strategy: 'store', cache: CacheBuilder }
;

export type CacheInstanceArgs =
  | CacheHTTPInstanceArgs
  | CacheETagInstanceArgs
  | CacheStoreInstanceArgs
;

export type CacheDetails = {
  key: string;
  iri: string;
  status?: number;
  hasContent: boolean;
  authKey: string;
  etag: string;
  headers: Headers;
  contentType: string;
  contentLength?: number;
  contentEncoding?: string;
  contentLanguage?: string;
  contentRange?: string;
};

export type CacheHitHandle =
  & CacheDetails
  & {
    type: 'cache-hit';
    set(details: CacheDetails): Promise<void>;
  };

export type CacheMissHandle = {
  type: 'cache-miss';
  set(details: CacheDetails): Promise<void>;
};

export type LockedCacheMissHandle = {
  type: 'locked-cache-miss';
  set(details: CacheDetails): Promise<void>;
  release(): Promise<void>;
};

export interface CacheMeta {
  set(key: string, details: CacheDetails): void | Promise<void>;
  get(key: string): CacheHitHandle | CacheMissHandle | Promise<CacheHitHandle | CacheMissHandle>;
  getOrLock?(key: string): Promise<CacheHitHandle | LockedCacheMissHandle>;
}

export interface UpstreamCache {
  push(key: string): Promise<void>;

}

export interface CacheStorage {
  /**
   * Retrieves a cache entry.
   */
  get(key: string): Uint8Array | Promise<Uint8Array>;

  /**
   * Sets a cache entry.
   */
  set(key: string, data: Uint8Array): void | Promise<void>;

  invalidate(key: string): void | Promise<void>;
};

export interface CacheBuilder {
  meta: CacheMeta;

  storage: CacheStorage;

  upstream: UpstreamCache | undefined;

  http(args?: CacheHTTPArgs): CacheInstanceArgs;

  etag(args?: CacheETagArgs): CacheInstanceArgs;

  store(args?: CacheStoreArgs): CacheInstanceArgs;

  invalidate?(request: Request): Promise<void>;

  push?(request: Request): Promise<void>;
}
