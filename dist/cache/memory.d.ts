import { Registry } from '../registry.ts';
import type { CacheDetails, CacheHitHandle, CacheMeta, CacheStorage, CacheMissHandle, UpstreamCache, LockedCacheMissHandle } from './types.ts';
import { Cache } from './cache.ts';
export type MemoryCacheMetaArgs = {
    allowLocking?: boolean;
};
export declare class MemoryCacheMeta implements CacheMeta {
    #private;
    allowLocking: boolean;
    constructor(args?: MemoryCacheMetaArgs);
    get(key: string): Promise<CacheHitHandle | CacheMissHandle>;
    set(key: string, details: CacheDetails): void;
    getOrLock(key: string): Promise<CacheHitHandle | LockedCacheMissHandle>;
    invalidate(key: string): void;
    flush(): Promise<void>;
}
export type MemoryCacheArgs = {
    upstream?: UpstreamCache;
    allowLocking?: boolean;
};
export declare class MemoryCacheStorage implements CacheStorage {
    #private;
    get(key: string): Blob;
    set(key: string, value: Blob): void;
    invalidate(key: string): void;
    flush(): void;
}
export declare class MemoryCache extends Cache {
    constructor(registry: Registry, args?: MemoryCacheArgs);
    flush(): Promise<void>;
}
