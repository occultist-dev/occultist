import { createHash } from 'node:crypto';
import { EtagConditions } from './etag.js';
export class Cache {
    #registry;
    #cacheMeta;
    #storage;
    #upstream;
    constructor(registry, cacheMeta, storage, upstream) {
        this.#registry = registry;
        this.#cacheMeta = cacheMeta;
        this.#storage = storage;
        this.#upstream = upstream;
    }
    get registry() {
        return this.#registry;
    }
    get meta() {
        return this.#cacheMeta;
    }
    get storage() {
        return this.#storage;
    }
    get upstream() {
        return this.#upstream;
    }
    /**
     * Add HTTP headers to the request.
     */
    http(args) {
        return Object.assign(Object.create(null), args, {
            strategy: 'http',
            cache: this,
        });
    }
    /**
     * Stores an etag value of the response and adds HTTP headers to the request.
     * Requests made to an endpoint implementing etag cache can use `If-None-Match`
     * or `If-Modified-Since` headers to test
     */
    etag(args) {
        return Object.assign(Object.create(null), args, {
            strategy: 'etag',
            cache: this,
        });
    }
    /**
     * Caches the body of the response, stores and etag and adds HTTP headers to the request.
     */
    store(args) {
        return Object.assign(Object.create(null), args, {
            strategy: 'store',
            cache: this,
        });
    }
    async push(_req) {
    }
    async invalidate(_req) {
    }
}
export class CacheMiddleware {
    async use(descriptors, ctx, next) {
        const descriptor = descriptors.find((descriptor) => {
            const when = descriptor.args.when;
            if (when == null) {
                return true;
            }
            else if (when === 'always') {
                return true;
            }
            else if (when === 'public' && ctx.authKey == null) {
                return true;
            }
            else if (when === 'private' && ctx.authKey != null) {
                return true;
            }
            else if (typeof when === 'function') {
                return when(ctx);
            }
            return false;
        });
        if (descriptor == null) {
            return await next();
        }
        switch (descriptor.args.strategy) {
            case 'http': {
                await this.#useHTTP(descriptor, ctx, next);
                break;
            }
            case 'etag': {
                await this.#useEtag(descriptor, ctx, next);
                break;
            }
            case 'store': {
                await this.#useStore(descriptor, ctx, next);
                break;
            }
        }
    }
    /**
     * @todo Implement vary rules.
     */
    #makeKey(descriptor) {
        const { contentType } = descriptor;
        const { version } = descriptor.args;
        const { name } = descriptor.action;
        const { url } = descriptor.request;
        return 'v' + (version ?? 0) + '|' + name + '|' + contentType.toLowerCase() + '|' + url.toString();
    }
    #setHeaders(descriptor, ctx) {
        const {} = descriptor.args;
    }
    async #useHTTP(descriptor, ctx, next) {
        this.#setHeaders(descriptor, ctx);
        await next();
    }
    async #useEtag(descriptor, ctx, next) {
        const key = this.#makeKey(descriptor);
        const rules = new EtagConditions(ctx.req.headers);
        const resourceState = await descriptor.args.cache.meta.get(key);
        if (resourceState.type === 'cache-hit') {
            if (rules.ifMatch(resourceState.etag)) {
                return;
            }
            else if (!rules.ifNoneMatch(resourceState.etag)) {
                ctx.hit = true;
                ctx.status = 304;
                return;
            }
        }
        this.#setHeaders(descriptor, ctx);
        await next();
    }
    async #useStore(descriptor, ctx, next) {
        const key = this.#makeKey(descriptor);
        let resourceState;
        if (typeof descriptor.args.cache.meta.getOrLock === 'function' &&
            descriptor.args.lock) {
            try {
                resourceState = await descriptor.args.cache.meta.getOrLock(key);
            }
            catch (err) {
                resourceState = await descriptor.args.cache.meta.get(key);
            }
        }
        else {
            resourceState = await descriptor.args.cache.meta.get(key);
        }
        if (resourceState?.type === 'cache-hit') {
            if (this.#isNotModified(ctx.req.headers, resourceState.etag)) {
                ctx.hit = true;
                ctx.status = 304;
                return;
            }
            if (resourceState.hasContent) {
                try {
                    ctx.hit = true;
                    ctx.status = resourceState.status;
                    ctx.body = await descriptor.args.cache.storage.get(key);
                    for (const [key, value] of resourceState.headers.entries()) {
                        ctx.headers.set(key, value);
                    }
                    return;
                }
                catch (err) {
                    console.log(err);
                }
            }
        }
        try {
            this.#setHeaders(descriptor, ctx);
            await next();
            const body = await new Response(ctx.body).blob();
            const etag = await this.#createEtag(body);
            ctx.etag = etag;
            ctx.headers.set('Etag', etag);
            await descriptor.args.cache.meta.set(key, {
                key,
                authKey: ctx.authKey,
                iri: ctx.url,
                status: ctx.status ?? 200,
                hasContent: ctx.body != null,
                headers: ctx.headers,
                contentType: ctx.contentType,
                etag,
            });
            if (ctx.body != null) {
                await descriptor.args.cache.storage.set(key, body);
            }
            if (resourceState.type === 'locked-cache-miss') {
                await resourceState.release();
            }
            if (this.#isNotModified(ctx.req.headers, etag)) {
                ctx.hit = true;
                ctx.status = 304;
                ctx.body = null;
                ctx.headers.delete('Etag');
                return;
            }
        }
        catch (err) {
            if (resourceState.type === 'locked-cache-miss') {
                await resourceState.release();
            }
        }
    }
    /**
     * Returns true if the request has conditional headers
     * which should result in a not modified response.
     */
    #isNotModified(headers, etag) {
        const rules = new EtagConditions(headers);
        return rules.isNotModified(etag);
    }
    async #createEtag(body, weak = true) {
        const buff = await body.bytes();
        const hash = createHash('sha1').update(buff).digest('hex');
        const quoted = `"${hash}"`;
        return weak ? `W/${quoted}` : quoted;
    }
}
