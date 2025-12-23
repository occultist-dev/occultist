import { Cache } from "./cache.js";
export class InMemoryCacheMeta {
    #details = new Map();
    #locks = new Map();
    #flushLock;
    async get(key) {
        if (this.#flushLock) {
            await this.#flushLock;
        }
        const details = this.#details.get(key);
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
    set(key, details) {
        this.#details.set(key, details);
    }
    async getOrLock(key) {
        if (this.#flushLock) {
            await this.#flushLock;
        }
        const lock = this.#locks.get(key);
        if (lock != null) {
            await lock;
        }
        const details = this.#details.get(key);
        function set(details) {
            this.#details.set(key, details);
        }
        if (details == null) {
            const { resolve, promise } = Promise.withResolvers();
            const release = () => {
                resolve();
                this.#locks.delete(key);
            };
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
    invalidate(key) {
        this.#details.delete(key);
    }
    async flush() {
        const { resolve, promise } = Promise.withResolvers();
        this.#flushLock = promise;
        // there could be a race condition here where the values are
        // flused before queued requests can get them.
        await Promise.all(this.#locks.values());
        this.#details = new Map();
        this.#locks = new Map();
        resolve();
    }
}
export class InMemoryCacheStorage {
    #cache = new Map();
    get(key) {
        const value = this.#cache.get(key);
        return value;
    }
    set(key, value) {
        this.#cache.set(key, value);
    }
    invalidate(key) {
        this.#cache.delete(key);
    }
    flush() {
        this.#cache = new Map();
    }
}
export class InMemoryCache extends Cache {
    constructor(registry, upstream) {
        super(registry, new InMemoryCacheMeta(), new InMemoryCacheStorage(), upstream);
    }
    async flush() {
        await this.meta.flush();
        this.storage.flush();
    }
}
