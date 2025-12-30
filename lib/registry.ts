import { Accept } from "./accept.ts";
import { ActionAuth, HandlerDefinition } from "./actions/actions.ts";
import { type ActionMatchResult, ActionSet } from "./actions/actionSets.ts";
import { ActionCore, MiddlewareRefs } from "./actions/core.ts";
import type { CacheHitHeader, ImplementedAction } from "./actions/types.ts";
import { ResponseWriter } from "./actions/writer.ts";
import { Scope } from './scopes.ts';
import { IncomingMessage, type ServerResponse } from "node:http";
import type { Merge } from "./actions/spec.ts";
import type { ContextState, Middleware } from "./actions/spec.ts";
import {ProblemDetailsError} from "./errors.ts"
import {WrappedRequest} from "./request.ts";
import {type CacheOperationResult} from "./mod.ts";
import type {Extension, StaticExtension} from "./types.ts";


export interface Callable<
  State extends ContextState = ContextState,
> {
  method(method: string, name: string, path: string): ActionAuth<State>;
}

export class HTTP<
  State extends ContextState = ContextState,
> {

  #callable: Callable<State>;

  constructor(callable: Callable<State>) {
    this.#callable = callable;
  }

  options(name: string, path: string): ActionAuth<State> {
    return this.#callable.method('options', name, path);
  }

  head(name: string, path: string): ActionAuth<State> {
    return this.#callable.method('head', name, path);
  }

  get(name: string, path: string): ActionAuth<State> {
    return this.#callable.method('get', name, path);
  }

  put(name: string, path: string): ActionAuth<State> {
    return this.#callable.method('put', name, path);
  }

  patch(name: string, path: string): ActionAuth<State> {
    return this.#callable.method('patch', name, path);
  }

  post(name: string, path: string): ActionAuth<State> {
    return this.#callable.method('post', name, path);
  }

  delete(name: string, path: string): ActionAuth<State> {
    return this.#callable.method('delete', name, path);
  }

  query(name: string, path: string): ActionAuth<State> {
    return this.#callable.method('query', name, path);
  }

}


export type IndexMatchArgs = {
  debug?: boolean;
};

export class IndexEntry {
  #actionSets: ActionSet[];

  constructor(actionSets: ActionSet[]) {
    this.#actionSets = actionSets;
  }

  match(method: string, path: string, accept: Accept): null | ActionMatchResult {
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


export type RegistryEvents =
  | 'beforefinalize'
  | 'afterfinalize'
;

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
 */
export class Registry<
  State extends ContextState = ContextState,
> implements Callable<State> {

  #finalized: boolean = false;
  #path: string;
  #rootIRI: string;
  #serverTiming: boolean;
  #cacheHitHeader: CacheHitHeader;
  #http: HTTP<State>;
  #scopes: Scope[] = [];
  #children: ActionCore[] = [];
  #index?: IndexEntry;
  #writer = new ResponseWriter();
  #eventTarget = new EventTarget();
  #middleware: Middleware[] = [];
  #actions: ImplementedAction[] | null = null;
  #handlers: HandlerDefinition[] | null = null;
  #extensions: Extension[] = [];
  #staticExtensions: Map<string, StaticExtension> = new Map();

  constructor(args: RegistryArgs) {
    const url = new URL(args.rootIRI);

    this.#rootIRI = args.rootIRI;
    this.#path = url.pathname;
    this.#serverTiming = args.serverTiming ?? false;
    this.#cacheHitHeader = args.cacheHitHeader ?? false;
    this.#http = new HTTP<State>(this);
  }

  scope(path: string): Scope<State> {
    const scope = new Scope<State>({
      path,
      serverTiming: this.#serverTiming,
      registry: this,
      writer: this.#writer,
      propergateMeta: (meta) => this.#children.push(meta),
    });

    this.#scopes.push(scope);
    
    return scope;
  }

  get rootIRI(): string {
    return this.#rootIRI;
  }

  get path(): string {
    return this.#path;
  }

  get http(): HTTP<State> {
    return this.#http;
  }

  get actions(): Array<ImplementedAction> {
    if (this.#finalized && this.#actions != null) {
      return this.#actions;
    }
    
    const actions: ImplementedAction[] = [];

    for (let i = 0; i < this.#children.length; i++) {
      if (this.#children[i].action == null) continue;

      actions.push(this.#children[i].action);
    }

    for (let i = 0; i < this.#scopes.length; i++) {
      for (let j = 0; j < this.#scopes[i].actions.length; j++) {
        actions.push(this.#scopes[i].actions[j]);
      }
    }

    if (this.#finalized) this.#actions = actions;

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
  get(name: string, contentType?: string): ImplementedAction | undefined {
    const actions = this.actions;

    for (let i = 0; i < actions.length; i++) {
      if (actions[i].name !== name) {
        continue;
      } else if (contentType == null && !this.actions[i].contentTypes.includes(contentType)) {
        continue;
      }

      return actions[i];
    }
  }

  /**
   * Returns a list of all action handler definitions.
   */
  get handlers(): HandlerDefinition[] {
    if (this.#finalized && this.#handlers != null) {
      return this.#handlers;
    }

    const actions = this.actions;
    const handlers: HandlerDefinition[] = [];

    for (let i = 0; i < actions.length; i++) {
      for (let j = 0; j < actions[i].handlers.length; j++) {
        handlers.push(actions[i].handlers[j]);
      }
    }

    if (this.#finalized) this.#handlers = handlers;

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
  query({
    method,
    contentType,
    meta,
  }: {
    method?: string | string[];
    contentType?: string | string[]
    meta?: string | symbol;
  } = {}): HandlerDefinition[] {
    const source = this.handlers;
    const handlers: HandlerDefinition[] = [];
    let handler: HandlerDefinition;

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
      } else if (contentType != null && contentType !== handler.contentType) {
        continue;
      }

      if (Array.isArray(method)) {
        if (!method.includes(handler.action.method)) {
          continue;
        }
      } else if (method != null && method !== handler.action.method) {
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
  public method(method: string, name: string, path: string): ActionAuth<State> {
    const meta = new ActionCore<State>(
      this.#rootIRI,
      method.toUpperCase(),
      name,
      path,
      this,
      this.#writer,
    );

    meta.recordServerTiming = this.#serverTiming;

    this.#children.push(meta);
    
    return new ActionAuth<State>(meta);
  }

  public use<
    const MiddlewareState extends ContextState = ContextState,
  >(
    middleware: Middleware<MiddlewareState>,
  ): Registry<Merge<State, MiddlewareState>> {
    this.#middleware.push(middleware);

    return this as unknown as Registry<Merge<State, MiddlewareState>>;
  }

  /**
   *
   */
  finalize() {
    if (this.#finalized) return;
      
    const actionSets: ActionSet[] = [];
    const groupedMeta = new Map<string, Map<string, ActionCore[]>>();

    this.#eventTarget.dispatchEvent(
      new Event('beforefinalize', { bubbles: true, cancelable: false })
    );

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
      } else if (group != null) {
        group.set(method, [meta]);
      } else {
        groupedMeta.set(normalized, new Map([[method, [meta]]]));
      }
    }

    for (const [normalized, methodSet] of groupedMeta.entries()) {
      for (const [method, meta] of methodSet.entries()) {
        const actionSet = new ActionSet(
          this.#rootIRI,
          method,
          normalized,
          meta,
        );

        actionSets.push(actionSet);
      }
    }

    this.#finalized = true;
    this.#index = new IndexEntry(actionSets);
    this.#eventTarget.dispatchEvent(
      new Event('afterfinalize', { bubbles: true, cancelable: false })
    );

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
  matchRequest(req: Request): ActionMatchResult | null {
    if (this.#index == null) {
      console.warn(
        'Registry index not built. Did you forget to run ' +
        'registry.finalize()?');
      return null;
    }

    const accept = Accept.from(req);
    return this.#index?.match(
      req.method,
      req.url.toString(),
      accept,
    );
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
  primeCache(req: Request): Promise<CacheOperationResult> {
    if (!this.#finalized) {
      this.finalize();
    }

    const startTime = performance.now();
    const wrapped = new WrappedRequest(this.#rootIRI, req);
    const writer = new ResponseWriter();
    const match = this.matchRequest(wrapped);

    if (match == null) {
      return Promise.resolve('not-found');
    } else if (match.type === 'unsupported-content-type') {
      return Promise.resolve('skipped');
    }

    const refs = new MiddlewareRefs(
      wrapped,
      writer,
      match.contentType ?? null,
      startTime,
    );

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
  refreshCache(req: Request): Promise<CacheOperationResult> {
    if (!this.#finalized) {
      this.finalize();
    }

    const startTime = performance.now();
    const wrapped = new WrappedRequest(this.#rootIRI, req);
    const writer = new ResponseWriter();
    const match = this.matchRequest(wrapped);

    if (match == null) {
      return Promise.resolve('not-found');
    } else if (match.type === 'unsupported-content-type') {
      return Promise.resolve('skipped');
    }

    const refs = new MiddlewareRefs(
      wrapped,
      writer,
      match.contentType ?? null,
      startTime,
    );

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
  invalidateCache(req: Request): Promise<CacheOperationResult> {
    if (!this.#finalized) {
      this.finalize();
    }

    const wrapped = new WrappedRequest(this.#rootIRI, req);
    const writer = new ResponseWriter();
    const match = this.matchRequest(wrapped);

    if (match == null) {
      return Promise.resolve('not-found');
    } else if (match.type === 'unsupported-content-type') {
      return Promise.resolve('skipped');
    }

    const refs = new MiddlewareRefs(
      wrapped,
      writer,
      match.contentType ?? null,
      null,
    );

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
   * @param req A web standard request instance.
   * @returns A web standard response instance.
   */
  handleRequest(
    req: Request,
  ): Promise<Response>;
  
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
  handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<ServerResponse>;

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
  async handleRequest(
    req: Request | IncomingMessage,
    res?: ServerResponse,
  ): Promise<Response | ServerResponse> {
    if (!this.#finalized) {
      this.finalize();
    }

    const startTime = performance.now();
    const wrapped = new WrappedRequest(this.#rootIRI, req);
    const writer = new ResponseWriter(res);
    const match = this.matchRequest(wrapped);

    let err: ProblemDetailsError;

    try {
      if (match?.type === 'match') {
        const refs = new MiddlewareRefs(
          wrapped,
          writer,
          match.contentType ?? null,
          startTime,
        );

        refs.cacheHitHeader = this.#cacheHitHeader;

        return await match.action.handleRequest(refs);
      }
    } catch (err2) {
      if (err2 instanceof ProblemDetailsError) {
        err = err2;
      } else {
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
    } else if (err instanceof ProblemDetailsError && res != null) {
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
  getStaticExtension(staticAlias: string): StaticExtension | undefined {
    return this.#staticExtensions.get(staticAlias);
  }

  /**
   * Registers an Occultist extension. This is usually done
   * by extensions when they are created.
   *
   * @param The Occultist extension to register.
   */
  registerExtension(extension: Extension): void {
    let staticAlias: string;
    if (
      typeof extension.getAsset === 'function' &&
      Array.isArray(extension.staticAliases)
    ) {
      for (let i = 0; i < extension.staticAliases.length; i++) {
        staticAlias = extension.staticAliases[i];

        if (this.#staticExtensions.has(staticAlias)) {
          throw new Error(`Static alias '${staticAlias}' already used by other extension`);
        }

        this.#staticExtensions.set(staticAlias, extension as StaticExtension);
      }
    }

    this.#extensions.push(extension);
  }

  /**
   * Must be called after all Occultist extensions have been registered.
   * When some of the extensions have async setup tasks.
   */
  async setupExtensions(): Promise<void> {
    const setupStreams: ReadableStream[] = [];

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

  addEventListener(type: RegistryEvents, callback: EventListener) {
    this.#eventTarget.addEventListener(type, callback);
  };

  removeEventListener(type: RegistryEvents, callback: EventListener) {
    this.#eventTarget.removeEventListener(type, callback)
  }
}
