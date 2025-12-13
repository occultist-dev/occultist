import type {CacheDetails, CacheHitHandle, CacheMeta, CacheStorage, CacheMissHandle} from './types.js';


export class InMemoryCacheMeta implements CacheMeta {
  #details: Map<string, CacheDetails> = new Map();

  async get(key: string): Promise<CacheHitHandle| CacheMissHandle> {
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

  async set(key: string, details: CacheDetails) {
    this.#details.set(key, details);
  }

}

export class InMemoryCacheStorage implements CacheStorage {
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

}


