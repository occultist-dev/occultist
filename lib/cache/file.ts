import {createHash} from 'node:crypto';
import type {CacheDetails, CacheHitHandle, CacheMeta, CacheStorage, CacheMissHandle, UpstreamCache} from './types.js';
import {readFile, writeFile, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {type StatWatcher, watchFile} from 'node:fs';
import {Registry} from '../registry.ts';
import {Cache} from './cache.ts';


/**
 * Stores cache meta information in a file on the filesystem.
 *
 * This is not robust enough for multi-process use.
 */
export class FileCacheMeta implements CacheMeta {
  
  #filePath: string;
  #details: Record<string, CacheDetails> = {};
  #watcher: StatWatcher | undefined;
  #writing: boolean = false;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  async #init(): Promise<void> {
    try {
      const content = await readFile(this.#filePath, 'utf-8');

      
      this.#details = JSON.parse(content);
    } catch (err) {
      await writeFile(this.#filePath, JSON.stringify(this.#details));
    }

    this.#watcher = watchFile(this.#filePath, async () => {
      if (this.#writing) return;

      const content = await readFile(this.#filePath, 'utf-8');
      this.#details = JSON.parse(content);
    });
  }

  async get(key: string): Promise<CacheHitHandle| CacheMissHandle> {
    if (this.#watcher == null) {
      this.#init();
    }
    
    const details = this.#details[key];
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
    this.#details[key] = details;

    await this.#write();
  }

  async invalidate(key: string): Promise<void> {
    delete this.#details[key];

    await this.#write();
  }

  /**
   * Resets the meta object to an empty value.
   */
  async reset(): Promise<void> {
    this.#details = {};
    await this.#write();
  }

  async #write(): Promise<void> {
    this.#writing = true;
    
    try {
      await writeFile(this.#filePath, JSON.stringify(this.#details));
    } catch {}

    this.#writing = false;
  }
}

export class FileSystemCacheStorage implements CacheStorage {

  #directory: string;
  #hashes: Map<string, string> = new Map();

  constructor(directory: string) {
    this.#directory = directory;
  }
  
  hash(key: string): string {
    let hash = this.#hashes.get(key);
    
    if (hash != null) return hash;

    hash = createHash('md5').update(key).digest('hex');

    this.#hashes.set(key, hash);

    return hash;
  }
  
  async get(key: string): Promise<Blob> {
    const buffer = await readFile(join(this.#directory, this.hash(key)));

    return new Blob([buffer]);
  }

  async set(key: string, value: Blob): Promise<void> {
    await writeFile(join(this.#directory, this.hash(key)), value.stream());
  }

  async invalidate(key: string): Promise<void> {
    await rm(join(this.#directory, this.hash(key)));
  }

  async reset(): Promise<void> {
    const promises: Array<Promise<void>> = [];

    for (const hash of this.#hashes.values()) {
      promises.push(rm(join(this.#directory, hash)));
    }
    
    this.#hashes = new Map();
    await Promise.all(promises);
  }
}

export class FileSystemCache extends Cache {
  #fileMeta: FileCacheMeta;
  #fileSystemStorage: FileSystemCacheStorage;

  constructor(registry: Registry, filePath: string, directory: string, upstream?: UpstreamCache) {
    const meta = new FileCacheMeta(filePath);
    const storage = new FileSystemCacheStorage(directory);

    super(
      registry,
      meta,
      storage,
      upstream,
    );

    this.#fileMeta = meta;
    this.#fileSystemStorage = storage;
  }

  async reset() {
    return Promise.all([
      this.#fileMeta.reset(),
      this.#fileSystemStorage.reset(),
    ]);
  }
}
