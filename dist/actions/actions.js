import { getActionContext } from "../utils/getActionContext.js";
import { getPropertyValueSpecifications } from "../utils/getPropertyValueSpecifications.js";
import { isPopulatedObject } from '../utils/isPopulatedObject.js';
import { joinPaths } from "../utils/joinPaths.js";
import { AfterDefinition, BeforeDefinition } from "./meta.js";
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
        return `name=${this.name} contentType=${this.contentType}`;
    }
}
export class FinalizedAction {
    #spec;
    #meta;
    #typeDef;
    #handlers;
    constructor(typeDef, spec, meta, handlerArgs) {
        this.#typeDef = typeDef;
        this.#spec = spec ?? {};
        this.#meta = meta;
        this.#meta.action = this;
        const handlers = new Map();
        if (typeof handlerArgs.contentType === 'string') {
            handlers.set(handlerArgs.contentType, new HandlerDefinition(this.name, handlerArgs.contentType, handlerArgs.handler, handlerArgs.meta, this, this.#meta));
        }
        else if (isPopulatedObject(handlerArgs)) {
            for (let i = 0; i < handlerArgs.contentType.length; i++) {
                handlers.set(handlerArgs.contentType[i], new HandlerDefinition(this.name, handlerArgs.contentType[i], handlerArgs.handler, handlerArgs.meta, this, this.#meta));
            }
        }
        this.#handlers = handlers;
    }
    static fromHandlers(typeDef, spec, meta, arg3, arg4) {
        if (Array.isArray(arg3) || typeof arg3 === 'string') {
            return new FinalizedAction(typeDef, spec, meta, {
                contentType: arg3,
                handler: arg4,
            });
        }
        return new FinalizedAction(typeDef, spec, meta, arg3);
    }
    static async toJSONLD(action, scope) {
        if (scope == null || action.typeDef == null) {
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
        return this.#meta.public;
    }
    get method() {
        return this.#meta.method;
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
        return this.#meta.name;
    }
    get template() {
        return this.#meta.uriTemplate;
    }
    get pattern() {
        return this.#meta.path.pattern;
    }
    get spec() {
        return this.#spec;
    }
    get scope() {
        return this.#meta.scope;
    }
    get registry() {
        return this.#meta.registry;
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
        return joinPaths(this.#meta.registry.rootIRI, this.#meta.path.normalized);
    }
    jsonld() {
        const scope = this.#meta.scope;
        return FinalizedAction.toJSONLD(this, scope);
    }
    jsonldPartial() {
        const scope = this.#meta.scope;
        const typeDef = this.#typeDef;
        if (scope == null || typeDef == null) {
            return null;
        }
        return {
            '@type': typeDef.type,
            '@id': joinPaths(scope.url(), this.#meta.name),
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
            this.#handlers.set(contentType, new HandlerDefinition(this.#meta.name, contentType, handler, meta, this, this.#meta));
        }
        else {
            for (let i = 0; i < contentType.length; i++) {
                this.#handlers.set(contentType[i], new HandlerDefinition(this.#meta.name, contentType[i], handler, meta, this, this.#meta));
            }
        }
        return this;
    }
    async handleRequest(args) {
        const handler = this.#handlers.get(args.contentType);
        return this.#meta.handleRequest({
            ...args,
            spec: this.#spec,
            handler,
        });
    }
}
export class DefinedAction {
    #spec;
    #meta;
    #typeDef;
    constructor(typeDef, spec, meta) {
        this.#spec = spec ?? {};
        this.#meta = meta;
        this.#typeDef = typeDef;
        this.#meta.action = this;
    }
    get public() {
        return this.#meta.public;
    }
    get method() {
        return this.#meta.method;
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
        return this.#meta.name;
    }
    get template() {
        return this.#meta.uriTemplate;
    }
    get pattern() {
        return this.#meta.path.pattern;
    }
    get path() {
        return this.#meta.path.normalized;
    }
    get spec() {
        return this.#spec;
    }
    get scope() {
        return this.#meta.scope;
    }
    get registry() {
        return this.#meta.registry;
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
    get context() {
        return getActionContext({
            spec: this.#spec,
            // vocab: this.#vocab,
            // aliases: this.#aliases,
        });
    }
    jsonld() {
        const scope = this.#meta.scope;
        return FinalizedAction.toJSONLD(this, scope);
    }
    jsonldPartial() {
        const scope = this.#meta.scope;
        const typeDef = this.#typeDef;
        if (scope == null || typeDef == null) {
            return null;
        }
        return {
            '@type': typeDef.type,
            '@id': joinPaths(scope.url(), this.#meta.name),
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
        if (this.#meta.cache.length !== 0 &&
            this.#meta.cacheOccurance === BeforeDefinition) {
            throw new Error('Action cache may be defined either before or after ' +
                'the definition method is called, but not both.');
        }
        else if (this.#meta.cacheOccurance === BeforeDefinition) {
            this.#meta.cacheOccurance = AfterDefinition;
        }
        this.#meta.cache.push(args);
        return this;
    }
    meta() {
        return this;
    }
    use() {
        return this;
    }
    handle(arg1, arg2) {
        return FinalizedAction.fromHandlers(this.#typeDef, this.#spec, this.#meta, arg1, arg2);
    }
    async handleRequest(args) {
        return this.#meta.handleRequest({
            ...args,
            spec: this.#spec,
        });
    }
}
export class Action {
    #spec = {};
    #meta;
    constructor(meta) {
        this.#meta = meta;
        this.#meta.action = this;
    }
    get public() {
        return this.#meta.public;
    }
    get method() {
        return this.#meta.method;
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
        return this.#meta.name;
    }
    get template() {
        return this.#meta.uriTemplate;
    }
    get pattern() {
        return this.#meta.path.pattern;
    }
    get path() {
        return this.#meta.path.normalized;
    }
    get spec() {
        return this.#spec;
    }
    get scope() {
        return this.#meta.scope;
    }
    get registry() {
        return this.#meta.registry;
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
        return new DefinedAction(args.typeDef, args.spec ?? {}, this.#meta);
    }
    handle(arg1, arg2) {
        return FinalizedAction.fromHandlers(null, this.#spec, this.#meta, arg1, arg2);
    }
    async handleRequest(args) {
        return this.#meta.handleRequest({
            ...args,
            spec: this.#spec,
        });
    }
}
export class PreAction {
    #meta;
    constructor(meta) {
        this.#meta = meta;
    }
    use() {
        return new Action(this.#meta);
    }
    define(args) {
        return new DefinedAction(args.typeDef, args.spec, this.#meta);
    }
    handle(arg1, arg2) {
        return FinalizedAction.fromHandlers(null, {}, this.#meta, arg1, arg2);
    }
}
export class Endpoint {
    #meta;
    constructor(meta) {
        this.#meta = meta;
    }
    hint(hints) {
        this.#meta.hints.push(hints);
        return this;
    }
    compress() {
        return this;
    }
    cache(args) {
        this.#meta.cache.push(args);
        return this;
    }
    etag() {
        return this;
    }
    use() {
        return new Action(this.#meta);
    }
    define(args) {
        return new DefinedAction(args.typeDef, args.spec, this.#meta);
    }
    handle(arg1, arg2) {
        return FinalizedAction.fromHandlers(undefined, {}, this.#meta, arg1, arg2);
    }
}
export class ActionAuth {
    #meta;
    constructor(meta) {
        this.#meta = meta;
    }
    public() {
        this.#meta.public = true;
        return new Endpoint(this.#meta);
    }
    private() {
        return new Endpoint(this.#meta);
    }
}
