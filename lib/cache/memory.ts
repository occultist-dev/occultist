import {Registry} from '../registry.ts';
import type {CacheDetails, CacheHitHandle, CacheMeta, CacheStorage, CacheMissHandle, UpstreamCache, LockedCacheMissHandle} from './types.ts';
import {Cache} from './cache.ts';


export class MemoryCacheMeta implements CacheMeta {
  #details: Map<string, CacheDetails> = new Map();
  #locks: Map<string, Promise<void>> = new Map();
  #flushLock: Promise<void> | undefined;
  allowLocking?: boolean = true;

  async get(key: string): Promise<CacheHitHandle | CacheMissHandle> {
    if (this.#flushLock) {
      await this.#flushLock;
    }

    const details = this.#details.get(key);
    async function set(details: CacheDetails) {
      this.#details.set(key, details);
    }

    if (details == null) {
      return {
        type: 'cache-miss',
        set,
      };
    }
    
    return {
      ...details,
      type: 'cache-hit',
      set,
    };
  }

  set(key: string, details: CacheDetails): void {
    this.#details.set(key, details);
  }

  async getOrLock(key: string): Promise<CacheHitHandle | LockedCacheMissHandle> {
    if (this.#flushLock) {
      await this.#flushLock;
    }

    const lock = this.#locks.get(key);

    if (lock != null) {
      await lock;
    }

    const details = this.#details.get(key);
    
    function set(details: CacheDetails) {
      this.#details.set(key, details);
    }

    if (details == null) {
      const { resolve, promise } = Promise.withResolvers<void>();
      const release = () => {
        resolve();
        this.#locks.delete(key);
      }

      this.#locks.set(key, promise);
      
      return {
        type: 'locked-cache-miss',
        set,
        release,
      };
    }

    return {
      ...details,
      type: 'cache-hit',
      set,
    };
  }

  invalidate(key: string): void {
    this.#details.delete(key);
  }

  async flush(): Promise<void> {
    const { resolve, promise } = Promise.withResolvers<void>();
    this.#flushLock = promise;

    // there could be a race condition here where the values are
    // flused before queued requests can get them.
    await Promise.all(this.#locks.values());

    this.#details = new Map();
    this.#locks = new Map();

    resolve();
  }
}

export class MemoryCacheStorage implements CacheStorage {
  #cache: Map<string, Blob> = new Map();

  get(key: string): Blob {
    const value = this.#cache.get(key);

    return value as Blob;
  }

  set(key: string, value: Blob): void {
    this.#cache.set(key, value);
  }

  invalidate(key: string): void {
    this.#cache.delete(key);
  }

  flush(): void {
    this.#cache = new Map();
  }
}

export class MemoryCache extends Cache {
  constructor(registry: Registry, upstream?: UpstreamCache) {
    super(
      registry,
      new MemoryCacheMeta(),
      new MemoryCacheStorage(),
      upstream,
    );
  }

  async flush() {
    await this.meta.flush();
    this.storage.flush();
  }
}
