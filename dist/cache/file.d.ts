import type { CacheDetails, CacheHitHandle, CacheMeta, CacheStorage, CacheMissHandle } from './types.js';
export declare class FileCacheMeta implements CacheMeta {
    #private;
    constructor(filePath: string);
    get(key: string): Promise<CacheHitHandle | CacheMissHandle>;
    set(key: string, details: CacheDetails): Promise<void>;
}
export declare class FileSystemCacheStorage implements CacheStorage {
    #private;
    constructor(directory: string);
    hash(key: string): string;
    get(key: string): Promise<Blob>;
    set(key: string, value: Blob): Promise<void>;
    invalidate(key: string): Promise<void>;
}
