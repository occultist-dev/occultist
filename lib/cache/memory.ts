import {Registry} from '../registry.ts';
import type {CacheDetails, CacheHitHandle, CacheMeta, CacheStorage, CacheMissHandle, UpstreamCache} from './types.js';
import {Cache} from './cache.ts';


export class InMemoryCacheMeta implements CacheMeta {
  #details: Map<string, CacheDetails> = new Map();

  get(key: string): CacheHitHandle | CacheMissHandle {
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

  invalidate(key: string): void {
    this.#details.delete(key);
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

export class InMemoryCache extends Cache {
  constructor(registry: Registry, upstream?: UpstreamCache) {
    super(
      registry,
      new InMemoryCacheMeta(),
      new InMemoryCacheStorage(),
      upstream,
    );
  }
}
