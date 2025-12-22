import { Registry } from '../registry.ts';
import type { CacheDetails, CacheHitHandle, CacheMeta, CacheStorage, CacheMissHandle, UpstreamCache, LockedCacheMissHandle } from './types.ts';
import { Cache } from './cache.ts';
export declare class InMemoryCacheMeta implements CacheMeta {
    #private;
    get(key: string): Promise<CacheHitHandle | CacheMissHandle>;
    set(key: string, details: CacheDetails): void;
    getOrLock(key: string): Promise<CacheHitHandle | LockedCacheMissHandle>;
    invalidate(key: string): void;
    flush(): Promise<void>;
}
export declare class InMemoryCacheStorage implements CacheStorage {
    #private;
    get(key: string): Blob;
    set(key: string, value: Blob): void;
    invalidate(key: string): void;
    flush(): void;
}
export declare class InMemoryCache extends Cache {
    constructor(registry: Registry, upstream?: UpstreamCache);
    flush(): Promise<void>;
}
