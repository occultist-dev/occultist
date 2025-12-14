export class InMemoryCacheMeta {
    #details = new Map();
    async get(key) {
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
    async set(key, details) {
        this.#details.set(key, details);
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
}
