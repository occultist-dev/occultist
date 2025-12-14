import type { CacheDetails, CacheHitHandle, CacheMeta, CacheStorage, CacheMissHandle } from './types.js';
export declare class InMemoryCacheMeta implements CacheMeta {
    #private;
    get(key: string): Promise<CacheHitHandle | CacheMissHandle>;
    set(key: string, details: CacheDetails): Promise<void>;
}
export declare class InMemoryCacheStorage implements CacheStorage {
    #private;
    get(key: string): Blob;
    set(key: string, value: Blob): void;
    invalidate(key: string): void;
}
