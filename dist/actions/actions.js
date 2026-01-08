import { getActionContext } from "../utils/getActionContext.js";
import { getPropertyValueSpecifications } from "../utils/getPropertyValueSpecifications.js";
import { isPopulatedObject } from "../utils/isPopulatedObject.js";
import { joinPaths } from "../utils/joinPaths.js";
import { AfterDefinition, BeforeDefinition } from "./core.js";
function isHandlerObj(handler) {
    return isPopulatedObject(handler);
}
/**
 * A handler definition which can be pulled from a registry, scope or action
 * after an action is defined.
 */
export class HandlerDefinition {
    name;
    contentType;
    handler;
    meta;
    action;
    cache;
    constructor(name, contentType, handler, meta, action, actionMeta) {
        this.name = name;
        this.contentType = contentType;
        this.handler = handler;
        this.action = action;
        this.meta = Object.freeze({ ...meta ?? {} });
        const cache = [];
        for (let i = 0; i < actionMeta.cache.length; i++) {
            cache.push(Object.freeze({ ...actionMeta.cache[i] }));
        }
        this.cache = Object.freeze(cache);
        Object.freeze(this);
    }
    get [Symbol.toStringTag]() {
        return `name=${this.name ?? 'anon'} contentType=${this.contentType}`;
    }
}
export class FinalizedAction {
    #spec;
    #core;
    #typeDef;
    #handlers;
    constructor(typeDef, spec, core, handlerArgs) {
        this.#typeDef = typeDef;
        this.#spec = spec ?? {};
        this.#core = core;
        this.#core.action = this;
        const handlers = new Map();
        if (typeof handlerArgs.contentType === 'string') {
            handlers.set(handlerArgs.contentType, new HandlerDefinition(this.name, handlerArgs.contentType, handlerArgs.handler, handlerArgs.meta, this, this.#core));
        }
        else if (isPopulatedObject(handlerArgs)) {
            for (let i = 0; i < handlerArgs.contentType.length; i++) {
                handlers.set(handlerArgs.contentType[i], new HandlerDefinition(this.name, handlerArgs.contentType[i], handlerArgs.handler, handlerArgs.meta, this, this.#core));
            }
        }
        this.#handlers = handlers;
    }
    static fromHandlers(typeDef, spec, core, arg3, arg4) {
        if (Array.isArray(arg3) || typeof arg3 === 'string') {
            return new FinalizedAction(typeDef, spec, core, {
                contentType: arg3,
                handler: arg4,
            });
        }
        return new FinalizedAction(typeDef, spec, core, arg3);
    }
    static async toJSONLD(action, scope) {
        if (scope == null || action.typeDef == null || action.name == null) {
            return null;
        }
        const apiSpec = await getPropertyValueSpecifications(action.spec);
        return {
            '@context': action.context,
            '@id': joinPaths(action.registry.rootIRI, scope.path, action.name),
            '@type': action.term,
            target: {
                '@type': 'https://schema.org/EntryPoint',
                httpMethod: action.method,
                urlTemplate: action.template,
                contentType: 'application/ld+json',
            },
            ...apiSpec,
        };
    }
    get public() {
        return this.#core.public;
    }
    get method() {
        return this.#core.method;
    }
    get term() {
        return this.#typeDef?.term;
    }
    get type() {
        return this.#typeDef?.type;
    }
    get typeDef() {
        return this.#typeDef;
    }
    get name() {
        return this.#core.name;
    }
    get template() {
        return this.#core.uriTemplate;
    }
    get route() {
        return this.#core.route;
    }
    get spec() {
        return this.#spec;
    }
    get scope() {
        return this.#core.scope;
    }
    get registry() {
        return this.#core.registry;
    }
    get handlers() {
        return Array.from(this.#handlers.values());
    }
    get contentTypes() {
        return Array.from(this.#handlers.keys());
    }
    get context() {
        return getActionContext({
            spec: this.#spec,
            //vocab: this.#vocab,
            //aliases: this.#aliases,
        });
    }
    url() {
        return joinPaths(this.#core.registry.rootIRI, this.#core.route.normalized);
    }
    /**
     * Retrives the handler configured for the given content type.
     *
     * @param contentType   The content type.
     */
    handlerFor(contentType) {
        return this.#handlers.get(contentType);
    }
    jsonld() {
        const scope = this.#core.scope;
        return FinalizedAction.toJSONLD(this, scope);
    }
    jsonldPartial() {
        const scope = this.#core.scope;
        const typeDef = this.#typeDef;
        if (scope == null || typeDef == null) {
            return null;
        }
        return {
            '@type': typeDef.type,
            '@id': joinPaths(scope.url(), this.#core.name),
        };
    }
    handle(arg1, arg2) {
        let contentType;
        let handler;
        let meta;
        if (isHandlerObj(arg1)) {
            contentType = arg1.contentType;
            handler = arg1.handler;
            meta = Object.assign(Object.create(null), arg1.meta);
            if (arg1.meta != null) {
                for (const sym of Object.getOwnPropertySymbols(arg1.meta)) {
                    meta[sym] = arg1.meta[sym];
                }
            }
        }
        else {
            contentType = arg1;
            handler = arg2;
            meta = Object.create(null);
        }
        if (!Array.isArray(contentType)) {
            this.#handlers.set(contentType, new HandlerDefinition(this.#core.name, contentType, handler, meta, this, this.#core));
        }
        else {
            for (let i = 0; i < contentType.length; i++) {
                this.#handlers.set(contentType[i], new HandlerDefinition(this.#core.name, contentType[i], handler, meta, this, this.#core));
            }
        }
        return this;
    }
    handleRequest(refs) {
        const handler = this.#handlers.get(refs.contentType);
        refs.spec = this.#spec;
        refs.handler = handler;
        return this.#core.handleRequest(refs);
    }
    primeCache(refs) {
        const handler = this.#handlers.get(refs.contentType);
        refs.spec = this.#spec;
        refs.handler = handler;
        return this.#core.primeCache(refs);
    }
    refreshCache(refs) {
        const handler = this.#handlers.get(refs.contentType);
        refs.spec = this.#spec;
        refs.handler = handler;
        return this.#core.refreshCache(refs);
    }
    invalidateCache(refs) {
        const handler = this.#handlers.get(refs.contentType);
        refs.spec = this.#spec;
        refs.handler = handler;
        return this.#core.invalidateCache(refs);
    }
}
export class DefinedAction {
    #spec;
    #core;
    #typeDef;
    constructor(typeDef, spec, core) {
        this.#spec = spec ?? {};
        this.#core = core;
        this.#typeDef = typeDef;
        this.#core.action = this;
    }
    get public() {
        return this.#core.public;
    }
    get method() {
        return this.#core.method;
    }
    get term() {
        return this.#typeDef?.term;
    }
    get type() {
        return this.#typeDef?.type;
    }
    get typeDef() {
        return this.#typeDef;
    }
    get name() {
        return this.#core.name;
    }
    get template() {
        return this.#core.uriTemplate;
    }
    get route() {
        return this.#core.route;
    }
    get path() {
        return this.#core.route.normalized;
    }
    get spec() {
        return this.#spec;
    }
    get scope() {
        return this.#core.scope;
    }
    get registry() {
        return this.#core.registry;
    }
    get handlers() {
        return [];
    }
    get contentTypes() {
        return [];
    }
    url() {
        return '';
    }
    /**
     * Retrives the handler configured for the given content type.
     *
     * @param contentType   The content type.
     */
    handlerFor(_contentType) { }
    get context() {
        return getActionContext({
            spec: this.#spec,
            // vocab: this.#vocab,
            // aliases: this.#aliases,
        });
    }
    jsonld() {
        const scope = this.#core.scope;
        return FinalizedAction.toJSONLD(this, scope);
    }
    jsonldPartial() {
        const scope = this.#core.scope;
        const typeDef = this.#typeDef;
        if (scope == null || typeDef == null) {
            return null;
        }
        return {
            '@type': typeDef.type,
            '@id': joinPaths(scope.url(), this.#core.name),
        };
    }
    /**
     * Defines a cache handling rule for this action.
     *
     * Defining caching rules after the `action.define()` method is safer
     * if validating and transforming the action payload might cause
     * auth sensitive checks to be run which might reject the request.
     */
    cache(args) {
        if (this.#core.cache.length !== 0 &&
            this.#core.cacheOccurance === BeforeDefinition) {
            throw new Error('Action cache may be defined either before or after ' +
                'the definition method is called, but not both.');
        }
        else if (this.#core.cacheOccurance === BeforeDefinition) {
            this.#core.cacheOccurance = AfterDefinition;
        }
        this.#core.cache.push(args);
        return this;
    }
    meta() {
        return this;
    }
    use() {
        return this;
    }
    handle(arg1, arg2) {
        return FinalizedAction.fromHandlers(this.#typeDef, this.#spec, this.#core, arg1, arg2);
    }
    handleRequest(refs) {
        refs.spec = this.#spec;
        return this.#core.handleRequest(refs);
    }
    primeCache(refs) {
        refs.spec = this.#spec;
        return this.#core.primeCache(refs);
    }
    refreshCache(refs) {
        refs.spec = this.#spec;
        return this.#core.refreshCache(refs);
    }
    invalidateCache(refs) {
        refs.spec = this.#spec;
        return this.#core.invalidateCache(refs);
    }
}
export class Action {
    #spec = {};
    #core;
    constructor(core) {
        this.#core = core;
        this.#core.action = this;
    }
    get public() {
        return this.#core.public;
    }
    get method() {
        return this.#core.method;
    }
    get term() {
        return undefined;
    }
    get type() {
        return undefined;
    }
    get typeDef() {
        return undefined;
    }
    get name() {
        return this.#core.name;
    }
    get template() {
        return this.#core.uriTemplate;
    }
    get route() {
        return this.#core.route;
    }
    get path() {
        return this.#core.route.normalized;
    }
    get spec() {
        return this.#spec;
    }
    get scope() {
        return this.#core.scope;
    }
    get registry() {
        return this.#core.registry;
    }
    get handlers() {
        return [];
    }
    get contentTypes() {
        return [];
    }
    get context() {
        return getActionContext({
            spec: this.#spec,
            //vocab: this.#vocab,
            //aliases: this.#aliases,
        });
    }
    url() {
        return '';
    }
    /**
     * Retrives the handler configured for the given content type.
     *
     * @param contentType   The content type.
     */
    handlerFor(_contentType) { }
    jsonld() {
        return Promise.resolve(null);
    }
    jsonldPartial() {
        return null;
    }
    use() {
        return this;
    }
    define(args) {
        return new DefinedAction(args.typeDef, args.spec ?? {}, this.#core);
    }
    handle(arg1, arg2) {
        return FinalizedAction.fromHandlers(null, this.#spec, this.#core, arg1, arg2);
    }
    handleRequest(refs) {
        refs.spec = this.#spec;
        return this.#core.handleRequest(refs);
    }
    primeCache(refs) {
        refs.spec = this.#spec;
        return this.#core.primeCache(refs);
    }
    refreshCache(refs) {
        refs.spec = this.#spec;
        return this.#core.refreshCache(refs);
    }
    invalidateCache(refs) {
        refs.spec = this.#spec;
        return this.#core.refreshCache(refs);
    }
}
export class PreAction {
    #core;
    constructor(core) {
        this.#core = core;
    }
    use() {
        return new Action(this.#core);
    }
    define(args) {
        return new DefinedAction(args.typeDef, args.spec, this.#core);
    }
    handle(arg1, arg2) {
        return FinalizedAction.fromHandlers(null, {}, this.#core, arg1, arg2);
    }
}
export class Endpoint {
    #core;
    constructor(core) {
        this.#core = core;
    }
    hint(hints) {
        this.#core.hints.push(hints);
        return this;
    }
    compress() {
        return this;
    }
    cache(args) {
        this.#core.cache.push(args);
        return this;
    }
    etag() {
        return this;
    }
    use() {
        return new Action(this.#core);
    }
    define(args) {
        return new DefinedAction(args.typeDef, args.spec, this.#core);
    }
    handle(arg1, arg2) {
        return FinalizedAction.fromHandlers(undefined, {}, this.#core, arg1, arg2);
    }
}
export class ActionAuth {
    #core;
    constructor(core) {
        this.#core = core;
    }
    public(authMiddleware) {
        if (authMiddleware != null && typeof authMiddleware !== 'function')
            throw new Error('Public action given invalid auth middleware');
        this.#core.public = true;
        this.#core.auth = authMiddleware;
        return new Endpoint(this.#core);
    }
    private(authMiddleware) {
        if (typeof authMiddleware !== 'function')
            throw new Error('Private action given invalid auth middleware');
        this.#core.auth = authMiddleware;
        return new Endpoint(this.#core);
    }
}
