import { createHash } from 'node:crypto';
import { EtagConditions } from "./etag.js";
const supportedSemantics = [
    'options',
    'head',
    'get',
    'post',
    'put',
    'delete',
];
const safeSemantics = new Set([
    'options',
    'head',
    'get',
    'query',
]);
/**
 * Creates a unique cache key based of the values of the
 * request, auth and cache args.
 *
 * The auth key, if provided is checked to ensure it is
 * a string and it is not empty or only whitespace characters.
 *
 * The action name and cache version are also checked to
 * make sure they have valid values.
 *
 * The cache key uri encodes key segments to and separates
 * them with the pipe character `|`.
 *
 * @param httpMethod The method the action accepts.
 * @param requestURL The url of the request.
 * @param contentType The negotiated content type of the response.
 * @param languageCode The negotiated language of the response.
 * @param encoding The negotiated encoding of the response.
 * @param requestHeaders The request headers.
 * @param authKey The auth key produced by the action's auth middleware.
 * @param publicWhenAuthenticated True if the cache does not vary on the auth key.
 * @param cacheVersion Version of the cached representation. Defaults to 1.
 * @param cacheVary String separated header names to vary on.
 * @returns A unique cache key for the response.
 */
export function makeCacheKey(httpMethod, requestURL, contentType, languageCode, encoding, requestHeaders, authKey, publicWhenAuthenticated, cacheVersion, cacheVary) {
    if (cacheVersion != null && (typeof cacheVersion !== 'number' ||
        cacheVersion < 0)) {
        throw new Error('Invalid version');
    }
    if (authKey != null && (typeof authKey !== 'string' ||
        authKey.trim() === '')) {
        // Make sure the auth key is a string and is populated
        // to prevent bad configuration leaking sensitive data
        throw new Error('Invalid auth key');
    }
    let key = 'v' + (cacheVersion ?? 1) + '|';
    // get and head draw from the same cache entry. Post requests
    // can set the same representation if they have freshness information.
    // Put and delete invalidate the same cache entry if successful.
    if (httpMethod.toLowerCase() === 'get' ||
        httpMethod.toLowerCase() === 'head' ||
        httpMethod.toLowerCase() === 'post' ||
        httpMethod.toLowerCase() === 'put' ||
        httpMethod.toLowerCase() === 'delete') {
        key += '|';
    }
    else {
        key += '|' + encodeURIComponent(httpMethod.toLowerCase());
    }
    if (publicWhenAuthenticated || authKey == null) {
        key += '|';
    }
    else {
        key += '|' + encodeURIComponent(authKey.toLowerCase());
    }
    key += '|' + encodeURIComponent(contentType.toLowerCase());
    key += '|' + encodeURI(requestURL);
    if (languageCode == null || languageCode.trim() === '') {
        key += '|';
    }
    else {
        key += '|' + encodeURIComponent(languageCode.toLowerCase());
    }
    if (encoding == null || encoding.trim() === '') {
        key += '|';
    }
    else {
        key += '|' + encodeURIComponent(encoding.toLowerCase());
    }
    key += '|';
    if (cacheVary == null) {
        return key;
    }
    const parts = cacheVary.split(' ');
    for (let i = 0; i < parts.length; i++) {
        const value = requestHeaders.get(parts[i]);
        if (value == null)
            continue;
        if (i !== 0)
            key += ',';
        key += encodeURIComponent(parts[i].toLowerCase().trim()) + '=';
        if (Array.isArray(value)) {
            for (let j = 0; j < value.length; j++) {
                if (j !== 0)
                    key += ';';
                key += encodeURIComponent(value[j]);
            }
        }
        else {
            key += encodeURIComponent(value);
        }
    }
    return key;
}
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
    http(args) {
        return Object.assign(Object.create(null), args, {
            strategy: 'http',
            cache: this,
        });
    }
    etag(args) {
        return Object.assign(Object.create(null), args, {
            strategy: 'etag',
            cache: this,
        });
    }
    store(args) {
        return Object.assign(Object.create(null), args, {
            strategy: 'store',
            cache: this,
        });
    }
    async invalidate(key, url) {
        const promises = [
            this.#cacheMeta.invalidate(key),
            this.#storage.invalidate(key),
        ];
        if (typeof this.#upstream?.invalidate === 'function')
            promises.push(this.#upstream.invalidate(url));
        await Promise.all(promises);
    }
}
/**
 * Contains information that is used when determining the caching
 * method and building a unique cache key for the request.
 */
export class CacheDescriptor {
    contentType;
    semantics;
    action;
    req;
    args;
    safe;
    lock;
    constructor(contentType, action, req, args) {
        this.contentType = contentType;
        this.semantics = args.semantics ?? req.method.toLowerCase();
        this.action = action;
        this.req = req;
        this.args = args;
        this.safe = safeSemantics.has(this.semantics);
        this.lock = args.lock &&
            args.cache.meta.allowLocking &&
            typeof args.cache.meta.getOrLock === 'function';
    }
}
;
/**
 * Used internally by Occultist to apply caching rules to
 * requests and programmically triggered cache interactions.
 */
export class CacheMiddleware {
    /**
     * Middleware used to apply cacheing logic to
     * requests.
     *
     * @param descriptor The cache descriptor.
     * @param ctx A cache context instance.
     * @param next The next function.
     * @return Promise containing a cache status.
     */
    async middleware(descriptor, ctx, next) {
        if (descriptor == null ||
            !supportedSemantics.includes(descriptor.semantics)) {
            return next();
        }
        if (descriptor.semantics === 'put'
            || descriptor.semantics === 'delete') {
            return this.#useInvalidate(descriptor, ctx, next);
        }
        const upstream = descriptor.args.cache.upstream;
        switch (descriptor.args.strategy) {
            case 'etag': {
                await this.#useEtag(descriptor, ctx, next);
                break;
            }
            case 'store': {
                await this.#useStore(descriptor, ctx, next);
            }
        }
        this.#setHeaders(descriptor, ctx);
        if (typeof upstream?.extendHeaders === 'function') {
            upstream.extendHeaders(ctx.headers, descriptor.args, ctx.req);
        }
    }
    /**
     * Sets response headers based of the cache
     * args and authorization status.
     *
     * @param descriptor The cache descriptor.
     * @param ctx A cache context instance.
     */
    #setHeaders(descriptor, ctx) {
        let date;
        const args = descriptor.args;
        const cacheControl = [];
        if (ctx.authKey != null && args.public) {
            cacheControl.push('public');
        }
        else if (ctx.authKey != null || args.private) {
            cacheControl.push('private');
        }
        else if (args.public) {
            cacheControl.push('public');
        }
        if (args.noCache)
            cacheControl.push('no-cache');
        if (args.noStore)
            cacheControl.push('no-store');
        if (args.mustRevalidate)
            cacheControl.push('must-revalidate');
        if (args.mustUndestand)
            cacheControl.push('must-understand');
        if (args.noTransform)
            cacheControl.push('no-transform');
        if (args.immutable)
            cacheControl.push('immutable');
        if (args.proxyRevalidate)
            cacheControl.push('proxy-revalidate');
        if (args.maxAge != null)
            cacheControl.push(`max-age=${args.maxAge}`);
        if (args.sMaxAge != null)
            cacheControl.push(`s-maxage=${args.sMaxAge}`);
        if (typeof args.expires === 'function') {
            date = args.expires();
            cacheControl.push(`expires=${date.toUTCString()}`);
        }
        if (cacheControl.length !== 0) {
            ctx.headers.set('Cache-Control', cacheControl.join(', '));
        }
    }
    /**
     * Used for PUT and DELETE requests which should invalidate the cache
     * when successful.
     */
    async #useInvalidate(descriptor, ctx, next) {
        await next();
        if (ctx.status != null || ctx.status.toString()[0] !== '2') {
            return;
        }
        const args = descriptor.args;
        const cache = args.cache;
        const key = makeCacheKey(ctx.method, ctx.req.url, ctx.contentType, null, null, ctx.req.headers, ctx.authKey ?? null, descriptor.args.public ?? false, descriptor.args.version ?? null, descriptor.args.vary);
        await cache.invalidate(key, ctx.url);
    }
    async #useEtag(descriptor, ctx, next) {
        const key = makeCacheKey(ctx.method, ctx.req.url, ctx.contentType, null, null, ctx.req.headers, ctx.authKey ?? null, descriptor.args.public ?? false, descriptor.args.version ?? null, descriptor.args.vary);
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
        await next();
    }
    async #useStore(descriptor, ctx, next) {
        const key = makeCacheKey(ctx.method, ctx.req.url, ctx.contentType, null, null, ctx.req.headers, ctx.authKey ?? null, descriptor.args.public ?? false, descriptor.args.version ?? null, descriptor.args.vary);
        let resourceState;
        const args = descriptor.args;
        const cache = args.cache;
        const skipCache = ctx.cacheOperation === 'refresh';
        if (ctx.cacheOperation === 'invalidate') {
            await cache.meta.invalidate(key);
            return;
        }
        if (!skipCache) {
            try {
                // post methods can use #useStore() but are not safe so skip the cache.
                if (descriptor.safe && descriptor.lock) {
                    resourceState = await cache.meta.getOrLock(key);
                }
                else if (descriptor.safe) {
                    resourceState = await cache.meta.get(key);
                }
            }
            catch (err) {
                console.error(err);
                console.log('Error when fetching cached meta content');
            }
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
                    ctx.body = await cache.storage.get(key);
                    for (const [key, value] of Object.entries(resourceState.headers)) {
                        if (Array.isArray(value)) {
                            ctx.headers.delete(key);
                            for (let i = 0; i < value.length; i++) {
                                ctx.headers.append(key, value[i]);
                            }
                        }
                        else {
                            ctx.headers.set(key, value);
                        }
                    }
                    return;
                }
                catch (err) {
                    console.log(err);
                }
            }
        }
        try {
            await next();
            const body = await new Response(ctx.body).blob();
            ctx.etag = ctx.headers.get('Etag') ?? await this.#createEtag(body);
            ctx.headers.set('Etag', ctx.etag);
            await cache.meta.set(key, {
                key,
                authKey: ctx.authKey,
                iri: ctx.url,
                status: ctx.status ?? 200,
                hasContent: ctx.body != null,
                headers: Object.fromEntries(ctx.headers.entries()),
                contentType: ctx.contentType,
                etag: ctx.etag,
            });
            if (ctx.body != null) {
                await cache.storage.set(key, body);
            }
            if (resourceState?.type === 'locked-cache-miss') {
                await resourceState.release();
            }
            if (this.#isNotModified(ctx.req.headers, ctx.etag)) {
                ctx.hit = true;
                ctx.status = 304;
                ctx.body = null;
                return;
            }
        }
        catch (err) {
            if (resourceState?.type === 'locked-cache-miss') {
                await resourceState.release();
            }
        }
    }
    /**
     * Determins if a cache control statement is fresh
     * according to the current time.
     *
     * @param cacheControl The cache control header value.
     * @returns Is fresh state
     */
    #isFresh(cacheControl) {
        const now = new Date();
        const parts = cacheControl.split(',');
        for (const part of parts) {
            const [directive, value] = part.split('=');
            if (value != null && value.trim() !== '') {
                if (directive === 'expires') {
                    const date = new Date(value.trim());
                    return +now > +date;
                }
                else if (directive === 'max-age') {
                    const date = new Date(value.trim());
                    return +now > +date;
                }
            }
        }
        return false;
    }
    /**
     * Returns true if the request has conditional headers
     * which should result in a not modified response.
     */
    #isNotModified(headers, etag) {
        const rules = new EtagConditions(headers);
        return rules.isNotModified(etag);
    }
    /**
     * Creates a strong etag using a sha1 hashing algorithim.
     */
    async #createEtag(body) {
        const buff = await body.bytes();
        const hash = createHash('sha1').update(buff).digest('hex');
        return `"${hash}"`;
    }
}
