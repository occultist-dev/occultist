import { IncomingMessage, type ServerResponse } from "node:http";
import { Accept } from "./accept.ts";
import { ActionAuth, HandlerDefinition } from "./actions/actions.ts";
import { type ActionMatchResult, ActionSet } from "./actions/actionSets.ts";
import type { ContextState, Merge, Middleware } from "./actions/spec.ts";
import type { CacheHitHeader, ImplementedAction } from "./actions/types.ts";
import { Scope } from './scopes.ts';
import type { EndpointArgs, Extension, StaticAsset, StaticAssetExtension } from "./types.ts";
import { type CacheOperationResult } from "./mod.ts";
export declare const defaultFileExtensions: {
    readonly txt: "text/plain";
    readonly html: "text/html";
    readonly js: "application/javascript";
    readonly json: "application/json";
    readonly svg: "application/svg+xml";
    readonly xml: "application/xml";
};
export interface Callable<State extends ContextState = ContextState> {
    endpoint(method: string, path: string, args: EndpointArgs): ActionAuth<State>;
}
export declare class HTTP<State extends ContextState = ContextState> {
    #private;
    constructor(callable: Callable<State>);
    options(path: string, args?: EndpointArgs): ActionAuth<State>;
    head(path: string, args?: EndpointArgs): ActionAuth<State>;
    get(path: string, args?: EndpointArgs): ActionAuth<State>;
    put(path: string, args?: EndpointArgs): ActionAuth<State>;
    patch(path: string, args?: EndpointArgs): ActionAuth<State>;
    post(path: string, args?: EndpointArgs): ActionAuth<State>;
    delete(path: string, args?: EndpointArgs): ActionAuth<State>;
    query(path: string, args?: EndpointArgs): ActionAuth<State>;
}
export type IndexMatchArgs = {
    debug?: boolean;
};
export declare class IndexEntry {
    #private;
    constructor(actionSets: ActionSet[]);
    match(method: string, path: string, accept: Accept): null | ActionMatchResult;
}
export type RegistryEvents = 'beforefinalize' | 'afterfinalize';
export type RegistryArgs = {
    /**
     * The public root endpoint the registry is bound to.
     */
    rootIRI: string;
    /**
     * Set to `true` if a cache header should be added to the response when
     * cache is successfully hit. Or assign custom header values.
     */
    cacheHitHeader?: CacheHitHeader;
    /**
     * Enables adding server timing headers to the response.
     */
    serverTiming?: boolean;
    /**
     * Map of file extensions to their content types. Used by the auto route file extensions
     * feature to pick the related action for a given file extension.
     */
    extensions?: Record<string, string>;
    /**
     * Enables language tag and file extension route params for all actions
     * in this registry.
     */
    autoRouteParams?: boolean;
    /**
     * Enables the language tag route param for all actions.
     */
    autoLanguageTags?: boolean;
    /**
     * Enables the file extension route param for all actions.
     */
    autoFileExtensions?: boolean;
};
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
 * @param args.autoRouteParams Enables language tag and file extension route
 *   params for all actions in this registry. When enabled all actions will
 *   have `{.languageTag,fileExtension}` added to the pathname part of their
 *   route's URI template as optional parameters. If an action is called using
 *   these parameters the URI value takes precedence over the related accept
 *   header.
 *
 * @param args.autoLanguageTags Enables the language tag route param for all
 *   actions.
 *
 * @param args.autoFileExtensions Enables the file extension route param for
 *   all actions.
 */
export declare class Registry<State extends ContextState = ContextState> implements Callable<State> {
    #private;
    constructor(args: RegistryArgs);
    scope(path: string): Scope<State>;
    get rootIRI(): string;
    get path(): string;
    get http(): HTTP<State>;
    get actions(): Array<ImplementedAction>;
    /**
     * Returns the first action using the given action name. A content type
     * can be provided to select another action going by the same name
     * and returning a different content type.
     *
     * @param name        - The name of the action.
     * @param contentType - The action's content type.
     */
    get(name: string, contentType?: string): ImplementedAction | undefined;
    /**
     * Returns a list of all action handler definitions.
     */
    get handlers(): HandlerDefinition[];
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
    query({ method, contentType, meta, }?: {
        method?: string | string[];
        contentType?: string | string[];
        meta?: string | symbol;
    }): HandlerDefinition[];
    /**
     * Creates an action for any HTTP method.
     *
     * @param method The HTTP method name.
     * @param name   Name for the action being produced.
     * @param path   Path the action responds to.
     */
    endpoint(method: string, path: string, args?: EndpointArgs): ActionAuth<State>;
    use<const MiddlewareState extends ContextState = ContextState>(middleware: Middleware<MiddlewareState>): Registry<Merge<State, MiddlewareState>>;
    finalize(): void;
    /**
     * Matches a request against the action configured to handle
     * it by path and content type.
     *
     * @param The request to match.
     * @returns Match information.
     */
    matchRequest(req: Request): ActionMatchResult | null;
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
    primeCache(req: Request): Promise<CacheOperationResult>;
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
    refreshCache(req: Request): Promise<CacheOperationResult>;
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
    invalidateCache(req: Request): Promise<CacheOperationResult>;
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
     * @param req A web standard request instance.
     * @returns A web standard response instance.
     */
    handleRequest(req: Request): Promise<Response>;
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
     *   web standard `Request` instance.
     * @param res A `createServer()` server response instance.
     * @returns A NodeJS server response instance.
     */
    handleRequest(req: IncomingMessage, res: ServerResponse): Promise<ServerResponse>;
    /**
     * Retrieves a static extension by one of the static aliases it uses.
     *
     * @param staticAlias A static alias used to create paths to files served
     *   by the static extension.
     */
    getStaticExtension(staticAlias: string): StaticAssetExtension | undefined;
    /**
     * Retrieves a static asset by its alias.
     *
     * @param staticAlias The alias of the static asset to retrieve.
     */
    getStaticAsset(staticAlias: string): StaticAsset | undefined;
    /**
     * Lists all static assets.
     */
    listStaticAssets(): StaticAsset[];
    /**
     * Queries all assets within a set of directories.
     */
    queryStaticDirectories(staticAliases: string[]): StaticAsset[];
    /**
     * Queries static assets by name.
     */
    queryStaticAssets(staticAliases: string[]): StaticAsset[];
    /**
     * Registers an Occultist extension. This is usually done
     * by extensions when they are created.
     *
     * @param The Occultist extension to register.
     */
    registerExtension(extension: Extension): void;
    /**
     * Must be called after all Occultist extensions have been registered.
     * When some of the extensions have async setup tasks.
     */
    setupExtensions(): Promise<void>;
    addEventListener(type: RegistryEvents, callback: EventListener): void;
    removeEventListener(type: RegistryEvents, callback: EventListener): void;
}
