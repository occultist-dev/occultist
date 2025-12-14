import { CacheMiddleware } from '../cache/cache.js';
import { processAction } from '../processAction.js';
import { joinPaths } from '../utils/joinPaths.js';
import { CacheContext, Context } from './context.js';
import { Path } from "./path.js";
export const BeforeDefinition = 0;
export const AfterDefinition = 1;
const cacheMiddleware = new CacheMiddleware();
export class ActionMeta {
    rootIRI;
    method;
    name;
    uriTemplate;
    public = false;
    authKey;
    path;
    hints = [];
    transformers = new Map();
    scope;
    registry;
    writer;
    action;
    acceptCache = new Set();
    compressBeforeCache = false;
    cacheOccurance = BeforeDefinition;
    cache = [];
    serverTiming = false;
    constructor(rootIRI, method, name, uriTemplate, registry, writer, scope) {
        this.rootIRI = rootIRI;
        this.method = method.toUpperCase();
        this.name = name;
        this.uriTemplate = joinPaths(rootIRI, uriTemplate);
        this.registry = registry;
        this.writer = writer;
        this.scope = scope;
        this.path = new Path(uriTemplate, rootIRI);
    }
    /**
     * Called when the API is defined to compute all uncomputed values.
     */
    finalize() {
        this.#setAcceptCache();
    }
    async handleRequest({ startTime, contentType, language: _language, encoding: _encoding, url, req, writer, spec, handler, }) {
        const state = {};
        const headers = new Headers();
        let ctx;
        let cacheCtx;
        let prevTime = startTime;
        const serverTiming = (name) => {
            const nextTime = performance.now();
            const duration = nextTime - prevTime;
            headers.append('Server-Timing', `${name};dur=${duration.toPrecision(2)}`);
            prevTime = nextTime;
        };
        if (this.serverTiming)
            serverTiming('enter');
        // add auth check
        if (this.hints.length !== 0) {
            await Promise.all(this.hints.map((hint) => writer.writeEarlyHints(hint)));
        }
        let next = async () => {
            if (typeof handler.handler === 'function') {
                await handler.handler(ctx);
            }
            else {
                ctx.status = 200;
                ctx.body = handler.handler;
            }
            if (this.serverTiming)
                serverTiming('handle');
        };
        {
            const upstream = next;
            next = async () => {
                const res = await processAction({
                    iri: url,
                    req,
                    spec: spec ?? {},
                    state,
                    action: this.action,
                });
                ctx = new Context({
                    req,
                    url,
                    contentType,
                    public: this.public,
                    handler,
                    params: res.params,
                    query: res.query,
                    payload: res.payload,
                });
                if (contentType != null) {
                    ctx.headers.set('Content-Type', contentType);
                }
                if (this.serverTiming)
                    serverTiming('payload');
                await upstream();
            };
        }
        if (this.cache.length > 0) {
            cacheCtx = new CacheContext({
                req,
                url,
                contentType,
                public: this.public,
                handler,
                params: {},
                query: {},
            });
            const descriptors = this.cache.map(args => {
                return {
                    contentType,
                    action: this.action,
                    request: req,
                    args,
                };
            });
            const upstream = next;
            next = async () => {
                await cacheMiddleware.use(descriptors, cacheCtx, async () => {
                    // cache was not hit if in this function
                    await upstream();
                    // the cache middleware requires these values are set 
                    cacheCtx.status = ctx.status;
                    if (ctx.body instanceof ReadableStream) {
                        const [a, b] = ctx.body.tee();
                        ctx.body = a;
                        cacheCtx.body = b;
                    }
                    else {
                        cacheCtx.body = ctx.body;
                    }
                    for (const [key, value] of ctx.headers.entries()) {
                        cacheCtx.headers.set(key, value);
                    }
                });
            };
        }
        try {
            await next();
            if (cacheCtx?.hit) {
                if (this.serverTiming)
                    serverTiming('hit');
                // set the ctx so the writer has access to the cached values.
                ctx = cacheCtx;
            }
            else if (cacheCtx?.etag != null) {
                ctx.headers.set('Etag', cacheCtx.etag);
            }
            writer.mergeHeaders(headers);
        }
        catch (err) {
            writer.mergeHeaders(headers);
            throw err;
        }
        writer.writeHead(ctx.status ?? 200, ctx.headers);
        if (ctx.body != null) {
            writer.writeBody(ctx.body);
        }
        return writer.response();
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
