import { createHash } from 'node:crypto';
import { open, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
export class FileCacheMeta {
    #filePath;
    #handle;
    #details = {};
    constructor(filePath) {
        this.#filePath = filePath;
    }
    async #init() {
        this.#handle = await open(this.#filePath, 'w+');
        const content = await this.#handle.readFile({ encoding: 'utf-8' });
        this.#details = JSON.parse(content);
    }
    async get(key) {
        if (this.#handle == null) {
            this.#init();
        }
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
    async set(key, details) {
        this.#details[key] = details;
        this.#handle.writeFile(JSON.stringify(details));
    }
}
export class FileSystemCacheStorage {
    #directory;
    #hashes = new Map();
    hash(key) {
        let hash = this.#hashes.get(key);
        if (hash != null)
            return hash;
        hash = createHash('md5').update(key).digest('hex');
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
}
