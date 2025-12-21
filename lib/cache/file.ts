import {createHash} from 'node:crypto';
import type {CacheDetails, CacheHitHandle, CacheMeta, CacheStorage, CacheMissHandle} from './types.js';
import {type FileHandle, open, readFile, writeFile, rm} from 'node:fs/promises';
import {join} from 'node:path';



export class FileCacheMeta implements CacheMeta {
  
  #filePath: string;
  #handle: FileHandle | undefined;
  #details: Record<string, CacheDetails> = {};

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  async #init(): Promise<void> {
    this.#handle = await open(this.#filePath, 'w+');
    const content = await this.#handle.readFile({ encoding: 'utf-8' });

    this.#details = JSON.parse(content);
  }

  async get(key: string): Promise<CacheHitHandle| CacheMissHandle> {
    if (this.#handle == null) {
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
    this.#handle.writeFile(JSON.stringify(details));
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
}
