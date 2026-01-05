import { Accept } from "./accept.js";
import { ActionAuth } from "./actions/actions.js";
import { ActionSet } from "./actions/actionSets.js";
import { ActionCore, MiddlewareRefs } from "./actions/core.js";
import { ResponseWriter } from "./actions/writer.js";
import { ProblemDetailsError } from "./errors.js";
import { WrappedRequest } from "./request.js";
import { Scope } from "./scopes.js";
export class HTTP {
    #callable;
    constructor(callable) {
        this.#callable = callable;
    }
    options(path, args) {
        return this.#callable.endpoint('options', path, args);
    }
    head(path, args) {
        return this.#callable.endpoint('head', path, args);
    }
    get(path, args) {
        return this.#callable.endpoint('get', path, args);
    }
    put(path, args) {
        return this.#callable.endpoint('put', path, args);
    }
    patch(path, args) {
        return this.#callable.endpoint('patch', path, args);
    }
    post(path, args) {
        return this.#callable.endpoint('post', path, args);
    }
    delete(path, args) {
        return this.#callable.endpoint('delete', path, args);
    }
    query(path, args) {
        return this.#callable.endpoint('query', path, args);
    }
}
export class IndexEntry {
    #actionSets;
    constructor(actionSets) {
        this.#actionSets = actionSets;
    }
    match(method, path, accept) {
        for (let index = 0; index < this.#actionSets.length; index++) {
            const actionSet = this.#actionSets[index];
            const match = actionSet.matches(method, path, accept);
            if (match != null) {
                return match;
            }
        }
        return null;
    }
}
/**
 * All actions of an Occultist based API are created through an action registry.
 * The registry exposes an interface for querying registered actions and emits events
 * when userland actions have all been defined. Extensions can register themselves
 * with the registry and create more actions and endpoints using the actions defined
 * in userland. Userland code might also use the registry's querying functionality
 * to programically make API calls as though they were made over the network via HTTP.
 *
 * @example <caption>Creates a simple registry that responds with a HTML document</caption>
 *
 * ```
 * import {createServer} from 'node:http':
 * import {Registry} from '@occultist/occultist';
 *
 * const server = createServer();
 * const registry = new Registry({ rootIRI: 'https://example.com' });
 *
 * registry.http.get('get-root', '/')
 *   .handle('text/html', `
 *     <!doctype html>
 *     <html>
 *       <head><title>Hello, World!</title></head>
 *       <body>
 *         <h1>Hello, World!</h1>
 *       </body>
 *     </body>
 *   `);
 *
 *
 * server.on('request', (req, res) => registry.handleRequest(req, res));
 * server.listen(3000);
 *
 * // makes a call programically to the registry
 * const res = await registry.handleRequest(new Request('https://example.com'));
 * ```
 *
 * @param args.rootIRI The public root endpoint the registry is bound to. If the
 *   registry responds to requests on a subpath, the subpath should be included
 *   in the `rootIRI` value.
 *
 * @param args.cacheHitHeader A custom cache hit header. If set to true Occultist
 *   will use the standard `X-Cache` header and the value `HIT`. If a string is
 *   provided the header name will be set to the value of the string. If an array
 *   is provided the header name will be set to the first item in the array, and
 *   the header value the second. Occultist does not set the cache header on
 *   cache misses. By default Occultist will not set a cache hit header.
 *
 * @param args.serverTiming Enables server timing headers in responses. When
 *   enabled requests log the duration of the steps Occultist takes when
 *   finding the action to respond to the request, retrieving values from
 *   cache, or calling the handler functions of an action. Browser debug tools
 *   add these values to their network performance charts.
 *   Enabling server timing can leak information and is not recommended for
 *   production environments.
 *
 * @param args.autoRouteParams Enables language code and file extension route
 *   params for all actions in this registry. When enabled all actions will
 *   have `{.languageCode,fileExtension}` added to the pathname part of their
 *   route's URI template as optional parameters. If an action is called using
 *   these parameters the URI value takes precedence over the related accept
 *   header.
 *
 * @param args.autoLanguageCodes Enables the language code route param for all
 *   actions.
 *
 * @param args.autoFileExtensions Enables the file extension route param for
 *   all actions.
 */
export class Registry {
    #finalized = false;
    #path;
    #rootIRI;
    #recordServerTiming;
    #cacheHitHeader;
    #autoLanguageCodes;
    #autoFileExtensions;
    #http;
    #scopes = [];
    #children = [];
    #index;
    #writer = new ResponseWriter();
    #eventTarget = new EventTarget();
    #middleware = [];
    #actions = null;
    #handlers = null;
    #extensions = [];
    #staticExtensions = new Map();
    constructor(args) {
        const url = new URL(args.rootIRI);
        this.#rootIRI = args.rootIRI;
        this.#path = url.pathname;
        this.#recordServerTiming = args.serverTiming ?? false;
        this.#autoLanguageCodes = args.autoLanguageCodes ?? args.autoRouteParams ?? false;
        this.#autoFileExtensions = args.autoFileExtensions ?? args.autoRouteParams ?? false;
        this.#cacheHitHeader = args.cacheHitHeader ?? false;
        this.#http = new HTTP(this);
    }
    scope(path) {
        const scope = new Scope(path, this, this.#writer, (meta) => this.#children.push(meta), this.#recordServerTiming, this.#autoLanguageCodes, this.#autoFileExtensions);
        this.#scopes.push(scope);
        return scope;
    }
    get rootIRI() {
        return this.#rootIRI;
    }
    get path() {
        return this.#path;
    }
    get http() {
        return this.#http;
    }
    get actions() {
        if (this.#finalized && this.#actions != null) {
            return this.#actions;
        }
        const actions = [];
        for (let i = 0; i < this.#children.length; i++) {
            if (this.#children[i].action == null)
                continue;
            actions.push(this.#children[i].action);
        }
        for (let i = 0; i < this.#scopes.length; i++) {
            for (let j = 0; j < this.#scopes[i].actions.length; j++) {
                actions.push(this.#scopes[i].actions[j]);
            }
        }
        if (this.#finalized)
            this.#actions = actions;
        return actions;
    }
    /**
     * Returns the first action using the given action name. A content type
     * can be provided to select another action going by the same name
     * and returning a different content type.
     *
     * @param name        - The name of the action.
     * @param contentType - The action's content type.
     */
    get(name, contentType) {
        const actions = this.actions;
        for (let i = 0; i < actions.length; i++) {
            if (actions[i].name !== name) {
                continue;
            }
            else if (contentType == null && !this.actions[i].contentTypes.includes(contentType)) {
                continue;
            }
            return actions[i];
        }
    }
    /**
     * Returns a list of all action handler definitions.
     */
    get handlers() {
        if (this.#finalized && this.#handlers != null) {
            return this.#handlers;
        }
        const actions = this.actions;
        const handlers = [];
        for (let i = 0; i < actions.length; i++) {
            for (let j = 0; j < actions[i].handlers.length; j++) {
                handlers.push(actions[i].handlers[j]);
            }
        }
        if (this.#finalized)
            this.#handlers = handlers;
        return handlers;
    }
    /**
     * Queries all handler definitions.
     *
     * @param args.method      The HTTP method the action should handle.
     * @param args.contentType A content type, or list of content types the action
     *                         should handle. If a list is given the action
     *                         will be included if it matches one content type
     *                         in the list.
     * @param args.meta        A meta value, such as a unique symbol, which the action
     *                         should have in its meta object.
     */
    query({ method, contentType, meta, } = {}) {
        const source = this.handlers;
        const handlers = [];
        let handler;
        if (method == null &&
            contentType == null &&
            meta == null) {
            return source;
        }
        for (let i = 0; i < source.length; i++) {
            handler = source[i];
            if (Array.isArray(contentType)) {
                if (!contentType.includes(handler.contentType)) {
                    continue;
                }
            }
            else if (contentType != null && contentType !== handler.contentType) {
                continue;
            }
            if (Array.isArray(method)) {
                if (!method.includes(handler.action.method)) {
                    continue;
                }
            }
            else if (method != null && method !== handler.action.method) {
                continue;
            }
            if (meta != null) {
                if (!Reflect.has(handler.meta, meta)) {
                    continue;
                }
            }
            handlers.push(handler);
        }
        return handlers;
    }
    /**
     * Creates an action for any HTTP method.
     *
     * @param method The HTTP method name.
     * @param name   Name for the action being produced.
     * @param path   Path the action responds to.
     */
    endpoint(method, path, args) {
        const meta = new ActionCore(this.#rootIRI, method, args?.name, path, this, this.#writer, undefined, args?.autoLanguageCodes ?? args?.autoRouteParams ?? this.#autoLanguageCodes, args?.autoFileExtensions ?? args?.autoRouteParams ?? this.#autoFileExtensions, this.#recordServerTiming);
        meta.recordServerTiming = this.#recordServerTiming;
        this.#children.push(meta);
        return new ActionAuth(meta);
    }
    use(middleware) {
        this.#middleware.push(middleware);
        return this;
    }
    /**
     *
     */
    finalize() {
        if (this.#finalized)
            return;
        const actionSets = [];
        const groupedMeta = new Map();
        this.#eventTarget.dispatchEvent(new Event('beforefinalize', { bubbles: true, cancelable: false }));
        for (let index = 0; index < this.#scopes.length; index++) {
            const scope = this.#scopes[index];
            scope.finalize();
        }
        for (let index = 0; index < this.#children.length; index++) {
            const meta = this.#children[index];
            const method = meta.method;
            const normalized = meta.route.normalized;
            meta.finalize();
            const group = groupedMeta.get(normalized);
            const methodSet = group?.get(method);
            if (methodSet != null) {
                methodSet.push(meta);
            }
            else if (group != null) {
                group.set(method, [meta]);
            }
            else {
                groupedMeta.set(normalized, new Map([[method, [meta]]]));
            }
        }
        for (const [normalized, methodSet] of groupedMeta.entries()) {
            for (const [method, meta] of methodSet.entries()) {
                const actionSet = new ActionSet(this.#rootIRI, method, normalized, meta);
                actionSets.push(actionSet);
            }
        }
        this.#finalized = true;
        this.#index = new IndexEntry(actionSets);
        this.#eventTarget.dispatchEvent(new Event('afterfinalize', { bubbles: true, cancelable: false }));
        // force actions and handlers to cache.
        this.handlers;
        // freeze all scopes.
        for (let i = 0; i < this.#scopes.length; i++) {
            Object.freeze(this.#scopes[i]);
        }
        // freeze the registry.
        Object.freeze(this);
    }
    /**
     * Matches a request against the action configured to handle
     * it by path and content type.
     *
     * @param The request to match.
     * @returns Match information.
     */
    matchRequest(req) {
        if (this.#index == null) {
            console.warn('Registry index not built. Did you forget to run ' +
                'registry.finalize()?');
            return null;
        }
        const accept = Accept.from(req);
        return this.#index?.match(req.method, req.url.toString(), accept);
    }
    /**
     * Primes a cache entry if the cache currently does not have
     * a value present, or the cached entry is stale.
     *
     * This operation will only succeed on safe HTTP methods supporting
     * caching. An endpoint can opt into being a "safe" endpoint by
     * setting the cache semantics to "get".
     *
     * When called with an auth key this method runs the full action
     * including middleware as that user so it is important that the
     * operation really is safe and does not change data or create
     * logs on the user's behalf.
     *
     * Middleware and handlers can detect if the request is being called
     * via a cache control method by checking `ctx.cacheRun === true`.
     *
     * @param req The request to cache.
     */
    primeCache(req) {
        if (!this.#finalized) {
            this.finalize();
        }
        const startTime = performance.now();
        const wrapped = new WrappedRequest(this.#rootIRI, req);
        const writer = new ResponseWriter();
        const match = this.matchRequest(wrapped);
        if (match == null) {
            return Promise.resolve('not-found');
        }
        else if (match.type === 'unsupported-content-type') {
            return Promise.resolve('skipped');
        }
        const refs = new MiddlewareRefs(wrapped, writer, match.contentType ?? null, startTime);
        refs.cacheHitHeader = this.#cacheHitHeader;
        return match.action.primeCache(refs);
    }
    /**
     * Refreshes a cached entry. If the hit cache is not populated
     * with a value it has the same affect as priming the cache.
     *
     * This operation will only succeed on safe HTTP methods supporting
     * caching. An endpoint can opt into being a "safe" endpoint by
     * setting the cache semantics to "get".
     *
     * When called with an auth key this method runs the full action
     * including middleware as that user so it is important that the
     * operation really is safe and does not change data or create
     * logs on the user's behalf.
     *
     * Middleware and handlers can detect if the request is being called
     * via a cache control method by checking `ctx.cacheRun === true`.
     *
     * @param req The request to cache.
     */
    refreshCache(req) {
        if (!this.#finalized) {
            this.finalize();
        }
        const startTime = performance.now();
        const wrapped = new WrappedRequest(this.#rootIRI, req);
        const writer = new ResponseWriter();
        const match = this.matchRequest(wrapped);
        if (match == null) {
            return Promise.resolve('not-found');
        }
        else if (match.type === 'unsupported-content-type') {
            return Promise.resolve('skipped');
        }
        const refs = new MiddlewareRefs(wrapped, writer, match.contentType ?? null, startTime);
        refs.cacheHitHeader = this.#cacheHitHeader;
        return match.action.refreshCache(refs);
    }
    /**
     * Invalidates a cached entry.
     *
     * This operation will only succeed on safe HTTP methods supporting
     * caching. An endpoint can opt into being a "safe" endpoint by
     * setting the cache semantics to "get".
     *
     * Middleware and handlers can detect if the request is being called
     * via a cache control method by checking `ctx.cacheRun === true`.
     *
     * @param req The request to cache.
     */
    invalidateCache(req) {
        if (!this.#finalized) {
            this.finalize();
        }
        const wrapped = new WrappedRequest(this.#rootIRI, req);
        const writer = new ResponseWriter();
        const match = this.matchRequest(wrapped);
        if (match == null) {
            return Promise.resolve('not-found');
        }
        else if (match.type === 'unsupported-content-type') {
            return Promise.resolve('skipped');
        }
        const refs = new MiddlewareRefs(wrapped, writer, match.contentType ?? null, null);
        return match.action.invalidateCache(refs);
    }
    /**
     * Handles a request.
     *
     * This method supports Node's `http.createServer()` request and
     * response interface and the web standard `Request` and
     * `Response` interfaces.
     *
     * Occultist wraps the `IncomingMessage` object created by Node's
     * `createServer()` in a generic `Request` object which may have
     * overheads. Node's `createServer()` API is the only method
     * supporting HTTP early hints, so it does have some advantages
     * even though in many cases the other runtimes have better
     * ergonomics.
     *
     * @param req A `createServer()` incoming message insance, or a
     *   web standard request instance.
     * @param res A `createServer()` server response instance.
     * @returns A NodeJS server response instance or a web standard
     *   request instance.
     */
    async handleRequest(req, res) {
        if (!this.#finalized) {
            this.finalize();
        }
        const startTime = performance.now();
        const wrapped = new WrappedRequest(this.#rootIRI, req);
        const writer = new ResponseWriter(res);
        const match = this.matchRequest(wrapped);
        let err;
        try {
            if (match?.type === 'match') {
                const refs = new MiddlewareRefs(wrapped, writer, match.contentType ?? null, startTime);
                refs.cacheHitHeader = this.#cacheHitHeader;
                return await match.action.handleRequest(refs);
            }
        }
        catch (err2) {
            if (err2 instanceof ProblemDetailsError) {
                err = err2;
            }
            else {
                console.log(err2);
                err = new ProblemDetailsError(500, 'Internal server error');
            }
        }
        if (err == null) {
            err = new ProblemDetailsError(404, 'Not found');
        }
        if (err instanceof ProblemDetailsError && req instanceof Request) {
            return new Response(err.toContent('application/problem.json'), {
                status: err.status,
                headers: {
                    'Content-Type': 'application/problem.json',
                },
            });
        }
        else if (err instanceof ProblemDetailsError && res != null) {
            res.writeHead(err.status, {
                'Content-Type': 'application/problem.json',
            });
            res.end(err.toContent('application/problem.json'));
            return res;
        }
    }
    /**
     * Retrieves a static extension by one of the static aliases it uses.
     *
     * @param staticAlias A static alias used to create paths to files served
     *   by the static extension.
     */
    getStaticExtension(staticAlias) {
        return this.#staticExtensions.get(staticAlias);
    }
    /**
     * Registers an Occultist extension. This is usually done
     * by extensions when they are created.
     *
     * @param The Occultist extension to register.
     */
    registerExtension(extension) {
        let staticAlias;
        if (typeof extension.getAsset === 'function' &&
            Array.isArray(extension.staticAliases)) {
            for (let i = 0; i < extension.staticAliases.length; i++) {
                staticAlias = extension.staticAliases[i];
                if (this.#staticExtensions.has(staticAlias)) {
                    throw new Error(`Static alias '${staticAlias}' already used by other extension`);
                }
                this.#staticExtensions.set(staticAlias, extension);
            }
        }
        this.#extensions.push(extension);
    }
    /**
     * Must be called after all Occultist extensions have been registered.
     * When some of the extensions have async setup tasks.
     */
    async setupExtensions() {
        const setupStreams = [];
        for (let i = 0; i < this.#extensions.length; i++) {
            if (typeof this.#extensions[i].setup === 'function') {
                setupStreams.push(this.#extensions[i].setup());
            }
        }
        for (let i = 0; i < setupStreams.length; i++) {
            for await (const message of setupStreams[i]) {
                console.log(message);
            }
        }
    }
    addEventListener(type, callback) {
        this.#eventTarget.addEventListener(type, callback);
    }
    ;
    removeEventListener(type, callback) {
        this.#eventTarget.removeEventListener(type, callback);
    }
}
