import {ImplementedAction} from "../actions/types.js";


export type CacheContext = {
  hit: boolean;
  headers: Headers;
  authKey?: string;
  req: Request;
  status?: number;
  bodyStream?: ReadableStream;
};

export type CacheStrategyType =
  | 'http'
  | 'etag'
  | 'store'
;

export interface CacheEntryDescriptor {
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
   */
  when?: 'always' | 'public' | 'private' | 'noQuery' | CacheWhenFn;
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
  status: number;
  hasContent: boolean;
  authKey: string;
  etag: string;
  header: ReadableStream;
  contentType: string;
  contentLength: number;
  contentEncoding: string;
  contentLanguage: string;
  contentRange: string;
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
  get(key: string): ReadableStream | Promise<ReadableStream>;

  /**
   * Sets a cache entry.
   */
  set(key: string, data: ReadableStream): void | Promise<void>;

  invalidate(key: string): void | Promise<void>;
};

export type CacheSetter = (data: ReadableStream) => Promise<void>;

export interface ICacheGetter {
  get(descriptor: CacheEntryDescriptor): Promise<
    | CacheSetter
    | ReadableStream
  >;
}

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
