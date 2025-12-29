import { createHash } from 'node:crypto';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { watchFile } from 'node:fs';
import { Cache } from "./cache.js";
/**
 * Stores cache meta information in a file on the filesystem.
 *
 * This is not robust enough for multi-process use.
 */
export class FileCacheMeta {
    #filePath;
    #details = {};
    #watcher;
    #writing = false;
    constructor(filePath) {
        this.#filePath = filePath;
    }
    async #init() {
        try {
            const content = await readFile(this.#filePath, 'utf-8');
            this.#details = JSON.parse(content);
        }
        catch (err) {
            await writeFile(this.#filePath, JSON.stringify(this.#details));
        }
        this.#watcher = watchFile(this.#filePath, async () => {
            if (this.#writing)
                return;
            const content = await readFile(this.#filePath, 'utf-8');
            this.#details = JSON.parse(content);
        });
        this.#watcher.unref();
    }
    async get(key) {
        if (this.#watcher == null)
            await this.#init();
        const details = this.#details[key];
        async function set(details) {
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
    /**
     * Sets a cached value.
     *
     * @param key Unique key for this cached value.
     * @param details Details of the cache to store.
     */
    async set(key, details) {
        if (this.#watcher == null)
            await this.#init();
        this.#details[key] = details;
        await this.#write();
    }
    /**
     * Invalidates a cached value by key.
     *
     * @param key Unique key for this cached value.
     */
    async invalidate(key) {
        if (this.#watcher == null)
            await this.#init();
        delete this.#details[key];
        await this.#write();
    }
    /**
     * Flushes the entire cache of values.
     *
     * @param key Unique key for this cached value.
     */
    async flush() {
        this.#details = {};
        await this.#write();
    }
    async #write() {
        this.#writing = true;
        try {
            await writeFile(this.#filePath, JSON.stringify(this.#details));
        }
        catch { }
        this.#writing = false;
    }
}
export class FileCacheStorage {
    #directory;
    #hashes = new Map();
    constructor(directory) {
        this.#directory = directory;
    }
    hash(key) {
        let hash = this.#hashes.get(key);
        if (hash != null)
            return hash;
        hash = createHash('sha256').update(key).digest('hex');
        this.#hashes.set(key, hash);
        return hash;
    }
    async get(key) {
        const buffer = await readFile(join(this.#directory, this.hash(key)));
        return new Blob([buffer]);
    }
    async set(key, value) {
        await writeFile(join(this.#directory, this.hash(key)), value.stream());
    }
    async invalidate(key) {
        await rm(join(this.#directory, this.hash(key)));
    }
    async flush() {
        const promises = [];
        for (const hash of this.#hashes.values()) {
            promises.push(rm(join(this.#directory, hash)));
        }
        this.#hashes = new Map();
        await Promise.all(promises);
    }
}
export class FileCache extends Cache {
    #fileMeta;
    #fileSystemStorage;
    constructor(registry, filePath, directory, upstream) {
        const meta = new FileCacheMeta(filePath);
        const storage = new FileCacheStorage(directory);
        super(registry, meta, storage, upstream);
        this.#fileMeta = meta;
        this.#fileSystemStorage = storage;
    }
    async flush() {
        return Promise.all([
            this.#fileMeta.flush(),
            this.#fileSystemStorage.flush(),
        ]);
    }
}
