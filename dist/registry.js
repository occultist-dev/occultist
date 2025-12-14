import { Accept } from "./accept.js";
import { ActionAuth } from "./actions/actions.js";
import { ActionSet } from "./actions/actionSets.js";
import { ActionMeta } from "./actions/meta.js";
import { ResponseWriter } from "./actions/writer.js";
import { Scope } from './scopes.js';
import { ProblemDetailsError } from "./errors.js";
import { WrappedRequest } from "./request.js";
export class HTTP {
    #callable;
    constructor(callable) {
        this.#callable = callable;
    }
    trace(name, path) {
        return this.#callable.method('trace', name, path);
    }
    options(name, path) {
        return this.#callable.method('options', name, path);
    }
    head(name, path) {
        return this.#callable.method('head', name, path);
    }
    get(name, path) {
        return this.#callable.method('get', name, path);
    }
    put(name, path) {
        return this.#callable.method('put', name, path);
    }
    patch(name, path) {
        return this.#callable.method('patch', name, path);
    }
    post(name, path) {
        return this.#callable.method('post', name, path);
    }
    delete(name, path) {
        return this.#callable.method('delete', name, path);
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
export class Registry {
    #finalized = false;
    #path;
    #rootIRI;
    #serverTiming;
    #http;
    #scopes = [];
    #children = [];
    #index;
    #writer = new ResponseWriter();
    #eventTarget = new EventTarget();
    #middleware = [];
    #actions = null;
    #handlers = null;
    constructor(args) {
        const url = new URL(args.rootIRI);
        this.#rootIRI = args.rootIRI;
        this.#path = url.pathname;
        this.#serverTiming = args.serverTiming ?? false;
        this.#http = new HTTP(this);
    }
    scope(path) {
        const scope = new Scope({
            path,
            serverTiming: this.#serverTiming,
            registry: this,
            writer: this.#writer,
            propergateMeta: (meta) => this.#children.push(meta),
        });
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
    method(method, name, path) {
        const meta = new ActionMeta(this.#rootIRI, method.toUpperCase(), name, path, this, this.#writer);
        meta.serverTiming = this.#serverTiming;
        this.#children.push(meta);
        return new ActionAuth(meta);
    }
    use(middleware) {
        this.#middleware.push(middleware);
        return this;
    }
    finalize() {
        if (this.#finalized)
            throw new Error('Registry has already been finalized');
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
            const normalized = meta.path.normalized;
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
    async handleRequest(req, res) {
        const startTime = performance.now();
        const wrapped = new WrappedRequest(this.#rootIRI, req);
        const writer = new ResponseWriter(res);
        const accept = Accept.from(wrapped);
        const match = this.#index?.match(req.method ?? 'GET', wrapped.url.toString(), accept);
        let err;
        try {
            if (match?.type === 'match') {
                return await match.action.handleRequest({
                    url: wrapped.url,
                    contentType: match.contentType,
                    req: wrapped,
                    writer,
                    startTime,
                });
            }
        }
        catch (err2) {
            if (err2 instanceof ProblemDetailsError) {
                err = err2;
            }
            else {
                err = new ProblemDetailsError(500, 'Internal server error');
            }
        }
        if (err == null) {
            err = new ProblemDetailsError(404, 'Not found');
        }
        if (err instanceof ProblemDetailsError && req instanceof Request) {
            return new Response(err.toContent('application/problem+json'), {
                status: err.status,
                headers: {
                    'Content-Type': 'application/problem+json',
                },
            });
        }
        else if (err instanceof ProblemDetailsError && res != null) {
            res.writeHead(err.status, {
                'Content-Type': 'application/problem+json',
            });
            res.end(err.toContent('application/problem+json'));
            return res;
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
