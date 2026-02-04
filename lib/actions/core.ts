import {CacheDescriptor, CacheMiddleware} from '../cache/cache.ts';
import type {CacheInstanceArgs, CacheOperation, CacheOperationResult, CacheWhen} from '../cache/types.ts';
import {InternalServerError, ProblemDetailsError} from '../errors.ts';
import type {JSONValue} from '../jsonld.ts';
import {processAction, type ProcessActionResult} from '../processAction.ts';
import type {Registry} from '../registry.ts';
import type {Scope} from "../scopes.ts";
import {joinPaths} from '../utils/joinPaths.ts';
import {HandlerDefinition} from './actions.ts';
import {CacheContext, Context} from './context.ts';
import {Route} from "./route.ts";
import type {ActionSpec, ContextState, FileValue, NextFn, TransformerFn} from './spec.ts';
import type {AuthMiddleware, AuthState, CacheHitHeader, HintArgs, ImplementedAction, PostMiddlewareFn, PreMiddlewareFn} from './types.ts';
import {type HTTPWriter, type ResponseTypes} from "./writer.ts";


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
export class MiddlewareRefs<
  State extends ContextState,
  Auth extends AuthState,
  Spec extends ActionSpec,
> {
  authKey?: string;
  auth?: Auth;
  state: State = {} as State;
  spec?: Spec;
  cacheOperation?: CacheOperation;
  cacheCtx?: CacheContext;
  handlerCtx?: Context;
  next: NextFn = (() => {}) as NextFn;
  headers: Headers;
  handler?: HandlerDefinition<State, Auth, Spec>;
  contentType: string | null;
  languageTag: string | null;
  writer: HTTPWriter;
  req: Request;
  recordServerTiming: boolean; 
  prevTime: number | null;
  serverTimes: string[] = [];
  cacheHitHeader: CacheHitHeader;

  constructor(
    req: Request,
    writer: HTTPWriter,
    contentType: string | null,
    languageTag: string | null,
    prevTime: number | null,
  ) {
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

  recordServerTime(name: string): void {
    if (!this.recordServerTiming) return;

    const nextTime = performance.now();
    const duration = nextTime - this.prevTime;

    this.headers.append('Server-Timing', `${name};dur=${duration.toFixed(2)}`);
    this.prevTime = nextTime;
  }
};

/**
 * Internal object that holds shared information action
 * building classes reference.
 */
export class ActionCore<
  State extends ContextState = ContextState,
  Auth extends AuthState = AuthState,
  Spec extends ActionSpec = ActionSpec,
> {
  rootIRI: string;
  method: string;
  isSafe: boolean;
  name?: string;
  uriTemplate: string;
  public: boolean = false;
  authKey?: string;
  route: Route;
  hints: HintArgs[] = [];
  transformers: Map<string, TransformerFn<JSONValue | FileValue, State, Spec>> = new Map();
  scope?: Scope;
  registry: Registry;
  writer: HTTPWriter;
  action?: ImplementedAction<State, Auth, Spec>;
  acceptCache = new Set<string>();
  compressBeforeCache: boolean = false;
  cacheOccurrence: 0 | 1 = BeforeDefinition;
  auth?: AuthMiddleware<Auth>;
  cache: CacheInstanceArgs[] = [];
  preMiddleware: PreMiddlewareFn[] = [];
  postMiddleware: PostMiddlewareFn[] = [];
  autoLanguageTags: boolean;
  autoFileExtensions: boolean;
  recordServerTiming: boolean;

  constructor(
    rootIRI: string,
    method: string,
    name: string | undefined,
    uriTemplate: string,
    registry: Registry,
    writer: HTTPWriter,
    scope: Scope | undefined,
    autoLanguageTags: boolean,
    autoFileExtensions: boolean,
    recordServerTiming: boolean | undefined,
  ) {
    this.rootIRI = rootIRI;
    this.method = method.toUpperCase()
    this.isSafe = safeMethods.has(this.method);
    this.name = name;
    this.uriTemplate = joinPaths(rootIRI, uriTemplate);
    this.registry = registry;
    this.writer = writer;
    this.scope = scope;
    this.route = new Route(
      uriTemplate,
      rootIRI,
      autoLanguageTags,
      autoFileExtensions,
    );
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
  getCacheDescriptor(
    contentType: string,
    req: Request,
    cacheCtx: CacheContext,
  ): CacheDescriptor | null {
    let found = false;
    let when: CacheWhen;
    const hasQuery = new URLSearchParams(req.url).size !== 0;

    for (let i = 0; i < this.cache.length; i++) {
      when = this.cache[i].when;
      
      if (when == null || when === 'always') {
        found = true;
      } else if (when === 'no-query' && !hasQuery) {
        found = true;
      } else if (when === 'unauthenticated' && cacheCtx.authKey == null) {
        found = true;
      } else if (when === 'authenticated' && cacheCtx.authKey != null) {
        found = true;
      } else if (when === 'unauthenticated-no-query' &&
                 cacheCtx.authKey == null &&
                 !hasQuery) {
        found = true;
      } else if (when === 'authenticated-no-query' &&
        cacheCtx.authKey != null &&
        !hasQuery) {
        found = true;
      } else if (typeof when === 'function') {
        found = when(cacheCtx);
      }
      
      if (found) {
        return new CacheDescriptor(
          contentType,
          cacheCtx.languageTag,
          this.action,
          req,
          this.cache[i],
        );
      }
    }

    return null;
  }

  /**
   * Primes a cache entry.
   */
  async primeCache(
    refs: MiddlewareRefs<State, Auth, Spec>,
  ): Promise<CacheOperationResult> {
    // Action's handling authentication will eventually
    // support cache priming and refreshing.
    if (this.auth != null) return 'unsupported';
    
    refs.cacheOperation = 'prime';
    refs.recordServerTime('enter');

    this.#applyHandlerMiddleware(refs);
    this.#applyActionProcessing(refs);
    this.#applyCacheMiddleware(refs);
    this.#applyEarlyHints(refs);
    this.#applyAuthMiddleware(refs);

    await refs.next();

    if (refs.cacheCtx?.hit) return 'skipped';

    await this.#writeResponse(refs);

    return 'cached';
  }

  /**
   * Refreshes a cache entry.
   */
  async refreshCache(
    refs: MiddlewareRefs<State, Auth, Spec>,
  ): Promise<CacheOperationResult> {
    // Action's handling authentication will eventually
    // support cache priming and refreshing.
    if (this.auth != null) return 'unsupported';

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
  async invalidateCache(
    refs: MiddlewareRefs<State, Auth, Spec>,
  ): Promise<CacheOperationResult> {
    // Action's handling authentication will eventually
    // support cache priming and refreshing.
    if (this.auth != null) return 'unsupported';

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
  async handleRequest(
    refs: MiddlewareRefs<State, Auth, Spec>,
  ): Promise<ResponseTypes> {
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
  async #writeResponse(refs: MiddlewareRefs<State, Auth, Spec>): Promise<void> {
    if (refs.cacheCtx == null && refs.handlerCtx == null) {
      throw new InternalServerError('Request was not handled by middleware');
    }

    if (refs.cacheCtx?.hit) {
      refs.recordServerTime('hit');

      if (Array.isArray(refs.cacheHitHeader)) {
        refs.headers.set(refs.cacheHitHeader[0], refs.cacheHitHeader[1]);
      } else if (typeof refs.cacheHitHeader === 'string') {
        refs.headers.set(refs.cacheHitHeader, 'HIT');
      } else if (refs.cacheHitHeader) {
        refs.headers.set('X-Cache', 'HIT');
      }
      
      // set the ctx so the writer has access to the cached values.
      refs.handlerCtx = refs.cacheCtx as unknown as Context;
      refs.writer.writeHead(
        refs.cacheCtx.status ?? 200,
        refs.headers,
      );

      if (refs.cacheCtx.body != null) {
        await refs.writer.writeBody(refs.cacheCtx.body);
      }
    } else {
      if (refs.handlerCtx == null) {
        throw new InternalServerError('Request was not handled by middleware');
      }

      refs.writer.writeHead(
        refs.handlerCtx.status ?? 200,
        refs.headers,
      );

      if (refs.handlerCtx.body != null) {
        await refs.writer.writeBody(refs.handlerCtx.body);
      }
    }
  }

  #applyHandlerMiddleware(
    refs: MiddlewareRefs<State, Auth, Spec>,
  ): void {
    refs.next = async () => {
      if (typeof refs.handler.handler === 'function') {
        await refs.handler.handler(refs.handlerCtx as Context<State, Auth, Spec>);
      } else {
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
  #applyActionProcessing(refs: MiddlewareRefs<State, Auth, Spec>): void {
    for (let i = this.postMiddleware.length - 1; i >= 0; i--) {
      const middleware = this.postMiddleware[i];
      const downstream = refs.next;
      refs.next = async () => {
        await middleware(refs.handlerCtx, downstream);
      };
    }

    const downstream = refs.next;
    refs.next = async () => {
      let processed: ProcessActionResult<Spec>;

      if (refs.spec != null) {
        processed = await processAction<State, Auth, Spec>({
          iri: refs.req.url,
          req: refs.req,
          spec: refs.spec ?? {} as Spec,
          state: refs.state,
          action: this.action,
        });
      }

      refs.handlerCtx = new Context<State, Auth, Spec>({
        req: refs.req,
        contentType: refs.contentType,
        languageTag: refs.languageTag,
        public: this.public && refs.authKey == null,
        auth: refs.auth,
        authKey: refs.authKey,
        state: refs.state,
        cacheOperation: refs.cacheOperation,
        handler: refs.handler,
        params: processed?.params ?? {},
        query: processed?.query ?? {},
        payload: processed?.payload ?? {} as ProcessActionResult<Spec>['payload'],
        headers: refs.headers,
      });

      if (refs.contentType != null) {
        // must apply to the handler headers so the cache headers can access
        // the value.
        refs.handlerCtx.headers.set('Content-Type', refs.contentType)
      }

      refs.recordServerTime('payload')

      await downstream();
    }

    for (let i = this.preMiddleware.length - 1; i >= 0; i--) {
      const middleware = this.preMiddleware[i];
      const downstream = refs.next;
      refs.next = async () => {
        await middleware(refs.cacheCtx, downstream);
      };
    }
  }

  /**
   * Applies configured caching middleware to the response if
   * one of the configured cache descriptors matches the request.
   */
  #applyCacheMiddleware(
    refs: MiddlewareRefs<State, Auth, Spec>,
  ): void {
    if (this.cache.length === 0) return;

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
        state: refs.state,
        handler: refs.handler,
        params: {},
        query: {},
        headers: refs.headers,
      });

      await cacheMiddleware.middleware(
        this.getCacheDescriptor(refs.contentType, refs.req, refs.cacheCtx),
        refs.cacheCtx,
        async () => {
          // cache was not hit if in this function
          await downstream();

          // the cache middleware requires these values are set 
          refs.cacheCtx.status = refs.handlerCtx.status;

          if (refs.handlerCtx.body instanceof ReadableStream) {
            const [a, b] = refs.handlerCtx.body.tee();
            
            refs.handlerCtx.body = a;
            refs.cacheCtx.body = b;
          } else {
            refs.cacheCtx.body = refs.handlerCtx.body;
          }
        },
      );
    }
  }

  /**
   * Applies all early hints to the response.
   */
  #applyEarlyHints(refs: MiddlewareRefs<State, Auth, Spec>): void {
    // add auth check
    if (this.hints.length !== 0) {
      const downstream = refs.next;
      refs.next = async () => {
        for (let i = 0; i < this.hints.length; i++) {
          refs.writer.writeEarlyHints(this.hints[i]);
        }

        await downstream();
      }
    }
  }

  #applyAuthMiddleware(
    refs: MiddlewareRefs<State, Auth, Spec>,
  ): void {
    if (this.auth == null) return;

    const downstream = refs.next;
    refs.next = async () => {
      const authValues = await this.auth(refs.req);

      if (Array.isArray(authValues) &&
          typeof authValues[0] === 'string' &&
          authValues.length > 0) {
        refs.authKey = authValues[0];
        refs.auth = authValues[1];

        await downstream();
      } else if (this.public) {
        await downstream();
      } else {
  
        // Failed authentication on a private endpoint.
        throw new ProblemDetailsError(404, {
          title: 'Not found',
        });
      }
    };
  }

  #setAcceptCache(): void {
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
