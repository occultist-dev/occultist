import { CacheDescriptor, CacheMiddleware } from "../cache/cache.js";
import { ProblemDetailsError } from "../errors.js";
import { processAction } from "../processAction.js";
import { joinPaths } from "../utils/joinPaths.js";
import { CacheContext, Context } from "./context.js";
import { Route } from "./route.js";
const safeMethods = new Set([
    'OPTIONS',
    'HEAD',
    'GET',
    'QUERY',
]);
export const BeforeDefinition = 0;
export const AfterDefinition = 1;
const cacheMiddleware = new CacheMiddleware();
/**
 * Internal accumulator object used to hold values request / response
 * middleware setup needs to access.
 */
export class MiddlewareRefs {
    authKey;
    auth;
    state = {};
    spec;
    cacheOperation;
    cacheCtx;
    handlerCtx;
    next = (() => { });
    headers;
    handler;
    contentType;
    languageTag;
    writer;
    req;
    recordServerTiming;
    prevTime;
    serverTimes = [];
    cacheHitHeader;
    constructor(req, writer, contentType, languageTag, prevTime) {
        this.req = req;
        this.writer = writer;
        this.contentType = contentType;
        this.languageTag = languageTag;
        this.prevTime = prevTime;
        this.headers = new Headers();
        if (this.contentType != null) {
            this.headers.set('Content-Type', contentType);
        }
    }
    recordServerTime(name) {
        if (!this.recordServerTiming)
            return;
        const nextTime = performance.now();
        const duration = nextTime - this.prevTime;
        this.headers.append('Server-Timing', `${name};dur=${duration.toFixed(2)}`);
        this.prevTime = nextTime;
    }
}
;
/**
 * Internal object that holds shared information action
 * building classes reference.
 */
export class ActionCore {
    rootIRI;
    method;
    isSafe;
    name;
    uriTemplate;
    public = false;
    authKey;
    route;
    hints = [];
    transformers = new Map();
    scope;
    registry;
    writer;
    action;
    acceptCache = new Set();
    compressBeforeCache = false;
    cacheOccurrence = BeforeDefinition;
    auth;
    cache = [];
    autoLanguageTags;
    autoFileExtensions;
    recordServerTiming;
    constructor(rootIRI, method, name, uriTemplate, registry, writer, scope, autoLanguageTags, autoFileExtensions, recordServerTiming) {
        this.rootIRI = rootIRI;
        this.method = method.toUpperCase();
        this.isSafe = safeMethods.has(this.method);
        this.name = name;
        this.uriTemplate = joinPaths(rootIRI, uriTemplate);
        this.registry = registry;
        this.writer = writer;
        this.scope = scope;
        this.route = new Route(uriTemplate, rootIRI, autoLanguageTags, autoFileExtensions);
        this.autoLanguageTags = autoLanguageTags;
        this.autoFileExtensions = autoFileExtensions;
        this.recordServerTiming = recordServerTiming ?? false;
    }
    /**
     * Called when the API is defined to compute all uncomputed values.
     */
    finalize() {
        this.#setAcceptCache();
    }
    /**
     * Selects the cache entry descriptor which is best used for this requert.
     *
     * @param contentType The content type of the response.
     * @param req The request instance.
     * @param cacheCtx A cache context instance.
     * @returns A cache descriptor object or null if no cache entry matches.
     */
    getCacheDescriptor(contentType, req, cacheCtx) {
        let found = false;
        let when;
        const hasQuery = new URLSearchParams(req.url).size !== 0;
        for (let i = 0; i < this.cache.length; i++) {
            when = this.cache[i].when;
            if (when == null || when === 'always') {
                found = true;
            }
            else if (when === 'no-query' && !hasQuery) {
                found = true;
            }
            else if (when === 'unauthenticated' && cacheCtx.authKey == null) {
                found = true;
            }
            else if (when === 'authenticated' && cacheCtx.authKey != null) {
                found = true;
            }
            else if (when === 'unauthenticated-no-query' &&
                cacheCtx.authKey == null &&
                !hasQuery) {
                found = true;
            }
            else if (when === 'authenticated-no-query' &&
                cacheCtx.authKey != null &&
                !hasQuery) {
                found = true;
            }
            else if (typeof when === 'function') {
                found = when(cacheCtx);
            }
            if (found) {
                return new CacheDescriptor(contentType, cacheCtx.languageTag, this.action, req, this.cache[i]);
            }
        }
        return null;
    }
    /**
     * Primes a cache entry.
     */
    async primeCache(refs) {
        // Action's handling authentication will eventually
        // support cache priming and refreshing.
        if (this.auth != null)
            return 'unsupported';
        refs.cacheOperation = 'prime';
        refs.recordServerTime('enter');
        this.#applyHandlerMiddleware(refs);
        this.#applyActionProcessing(refs);
        this.#applyCacheMiddleware(refs);
        this.#applyEarlyHints(refs);
        this.#applyAuthMiddleware(refs);
        await refs.next();
        if (refs.cacheCtx?.hit)
            return 'skipped';
        await this.#writeResponse(refs);
        return 'cached';
    }
    /**
     * Refreshes a cache entry.
     */
    async refreshCache(refs) {
        // Action's handling authentication will eventually
        // support cache priming and refreshing.
        if (this.auth != null)
            return 'unsupported';
        refs.cacheOperation = 'refresh';
        refs.recordServerTime('enter');
        this.#applyHandlerMiddleware(refs);
        this.#applyActionProcessing(refs);
        this.#applyCacheMiddleware(refs);
        this.#applyEarlyHints(refs);
        this.#applyAuthMiddleware(refs);
        await refs.next();
        await this.#writeResponse(refs);
        return 'cached';
    }
    /**
     * Invalidates a cache entry.
     */
    async invalidateCache(refs) {
        // Action's handling authentication will eventually
        // support cache priming and refreshing.
        if (this.auth != null)
            return 'unsupported';
        refs.cacheOperation = 'invalidate';
        this.#applyCacheMiddleware(refs);
        this.#applyEarlyHints(refs);
        this.#applyAuthMiddleware(refs);
        await refs.next();
        return 'invalidated';
    }
    /**
     * Handles a request.
     *
     * All actions call this method to do the heavy lifting of handling a request.
     */
    async handleRequest(refs) {
        refs.recordServerTime('enter');
        refs.cacheOperation = null;
        this.#applyHandlerMiddleware(refs);
        this.#applyActionProcessing(refs);
        this.#applyCacheMiddleware(refs);
        this.#applyEarlyHints(refs);
        this.#applyAuthMiddleware(refs);
        await refs.next();
        await this.#writeResponse(refs);
        return refs.writer.response();
    }
    /**
     * Writes status, headers and body to the response once
     * all middleware has been handled.
     */
    async #writeResponse(refs) {
        if (refs.cacheCtx == null && refs.handlerCtx == null) {
            throw new Error('Unhandled');
        }
        if (refs.cacheCtx?.hit) {
            refs.recordServerTime('hit');
            if (Array.isArray(refs.cacheHitHeader)) {
                refs.headers.set(refs.cacheHitHeader[0], refs.cacheHitHeader[1]);
            }
            else if (typeof refs.cacheHitHeader === 'string') {
                refs.headers.set(refs.cacheHitHeader, 'HIT');
            }
            else if (refs.cacheHitHeader) {
                refs.headers.set('X-Cache', 'HIT');
            }
            // set the ctx so the writer has access to the cached values.
            refs.handlerCtx = refs.cacheCtx;
            refs.writer.writeHead(refs.cacheCtx.status ?? 200, refs.headers);
            if (refs.cacheCtx.body != null) {
                await refs.writer.writeBody(refs.cacheCtx.body);
            }
        }
        else {
            refs.writer.writeHead(refs.handlerCtx.status ?? 200, refs.headers);
            if (refs.handlerCtx.body != null) {
                await refs.writer.writeBody(refs.handlerCtx.body);
            }
        }
    }
    #applyHandlerMiddleware(refs) {
        refs.next = async () => {
            if (typeof refs.handler.handler === 'function') {
                await refs.handler.handler(refs.handlerCtx);
            }
            else {
                refs.handlerCtx.status = 200;
                refs.handlerCtx.body = refs.handler.handler;
            }
            refs.recordServerTime('handle');
        };
    }
    /**
     * Creates the requests `ctx.payload` value based off the spec
     * provided in the action's define method if called.
     */
    #applyActionProcessing(refs) {
        const downstream = refs.next;
        refs.next = async () => {
            let processed;
            if (refs.spec != null) {
                try {
                    processed = await processAction({
                        iri: refs.req.url,
                        req: refs.req,
                        spec: refs.spec ?? {},
                        state: refs.state,
                        action: this.action,
                    });
                }
                catch (err) {
                    console.log(err);
                    throw err;
                }
            }
            refs.handlerCtx = new Context({
                req: refs.req,
                contentType: refs.contentType,
                languageTag: refs.languageTag,
                public: this.public && refs.authKey == null,
                auth: refs.auth,
                authKey: refs.authKey,
                cacheOperation: refs.cacheOperation,
                handler: refs.handler,
                params: processed.params ?? {},
                query: processed.query ?? {},
                payload: processed.payload ?? {},
                headers: refs.headers,
            });
            if (refs.contentType != null) {
                // must apply to the handler headers so the cache headers can access
                // the value.
                refs.handlerCtx.headers.set('Content-Type', refs.contentType);
            }
            refs.recordServerTime('payload');
            await downstream();
        };
    }
    /**
     * Applies configured caching middleware to the response if
     * one of the configured cache descriptors matches the request.
     */
    #applyCacheMiddleware(refs) {
        if (this.cache.length === 0)
            return;
        const downstream = refs.next;
        refs.next = async () => {
            refs.cacheCtx = new CacheContext({
                req: refs.req,
                contentType: refs.contentType,
                languageTag: refs.languageTag,
                public: this.public && refs.authKey == null,
                cacheOperation: refs.cacheOperation,
                auth: refs.auth,
                authKey: refs.authKey,
                handler: refs.handler,
                params: {},
                query: {},
                headers: refs.headers,
            });
            await cacheMiddleware.middleware(this.getCacheDescriptor(refs.contentType, refs.req, refs.cacheCtx), refs.cacheCtx, async () => {
                // cache was not hit if in this function
                await downstream();
                // the cache middleware requires these values are set 
                refs.cacheCtx.status = refs.handlerCtx.status;
                if (refs.handlerCtx.body instanceof ReadableStream) {
                    const [a, b] = refs.handlerCtx.body.tee();
                    refs.handlerCtx.body = a;
                    refs.cacheCtx.body = b;
                }
                else {
                    refs.cacheCtx.body = refs.handlerCtx.body;
                }
            });
        };
    }
    /**
     * Applies all early hints to the response.
     */
    #applyEarlyHints(refs) {
        // add auth check
        if (this.hints.length !== 0) {
            const downstream = refs.next;
            refs.next = async () => {
                for (let i = 0; i < this.hints.length; i++) {
                    refs.writer.writeEarlyHints(this.hints[i]);
                }
                await downstream();
            };
        }
    }
    #applyAuthMiddleware(refs) {
        if (this.auth == null)
            return;
        const downstream = refs.next;
        refs.next = async () => {
            const authValues = await this.auth(refs.req);
            if (Array.isArray(authValues) &&
                typeof authValues[0] === 'string' &&
                authValues.length > 0) {
                refs.authKey = authValues[0];
                refs.auth = authValues[1];
                await downstream();
            }
            else if (this.public) {
                await downstream();
            }
            else {
                // Failed authentication on a private endpoint.
                throw new ProblemDetailsError(404, {
                    title: 'Not found',
                });
            }
        };
    }
    #setAcceptCache() {
        const action = this.action;
        if (action == null) {
            return;
        }
        this.acceptCache.add('*/*');
        for (const contentType of action.contentTypes) {
            this.acceptCache.add(contentType);
            this.acceptCache.add(contentType.replace(/[^/]+$/, '*'));
        }
    }
    get [Symbol.toStringTag]() {
        return `[Meta ${this.name} ${this.uriTemplate}]`;
    }
}
