import type { CacheDetails, CacheHitHandle, CacheMeta, CacheStorage, CacheMissHandle, UpstreamCache } from './types.ts';
import { Registry } from '../registry.ts';
import { Cache } from './cache.ts';
/**
 * Stores cache meta information in a file on the filesystem.
 *
 * This is not robust enough for multi-process use.
 */
export declare class FileCacheMeta implements CacheMeta {
    #private;
    constructor(filePath: string);
    get(key: string): Promise<CacheHitHandle | CacheMissHandle>;
    /**
     * Sets a cached value.
     *
     * @param key Unique key for this cached value.
     * @param details Details of the cache to store.
     */
    set(key: string, details: CacheDetails): Promise<void>;
    /**
     * Invalidates a cached value by key.
     *
     * @param key Unique key for this cached value.
     */
    invalidate(key: string): Promise<void>;
    /**
     * Flushes the entire cache of values.
     *
     * @param key Unique key for this cached value.
     */
    flush(): Promise<void>;
}
export declare class FileCacheStorage implements CacheStorage {
    #private;
    constructor(directory: string);
    hash(key: string): string;
    get(key: string): Promise<Blob>;
    set(key: string, value: Blob): Promise<void>;
    invalidate(key: string): Promise<void>;
    flush(): Promise<void>;
}
export declare class FileCache extends Cache {
    #private;
    constructor(registry: Registry, filePath: string, directory: string, upstream?: UpstreamCache);
    flush(): Promise<[void, void]>;
}
