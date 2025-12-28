import {CacheDescriptor, CacheMiddleware} from '../cache/cache.ts';
import type {CacheInstanceArgs, CacheWhen} from '../cache/types.ts';
import {ProblemDetailsError} from '../errors.ts';
import type {JSONValue} from '../jsonld.ts';
import {processAction, type ProcessActionResult} from '../processAction.ts';
import type {Registry} from '../registry.ts';
import type {Scope} from "../scopes.ts";
import {joinPaths} from '../utils/joinPaths.ts';
import {HandlerDefinition} from './actions.ts';
import {CacheContext, Context} from './context.ts';
import {Path} from "./path.ts";
import type {ActionSpec, ContextState, FileValue, NextFn, TransformerFn} from './spec.ts';
import type {AuthMiddleware, AuthState, CacheHitHeader, HintArgs, ImplementedAction} from './types.ts';
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


class MiddlewareRefs<
  State extends ContextState,
  Auth extends AuthState,
  Spec extends ActionSpec,
> {
  authKey?: string;
  auth?: Auth;
  state: State = {} as State;
  spec?: Spec;
  cacheCtx?: CacheContext;
  handlerCtx?: Context;
  next: NextFn = (() => {}) as NextFn;
  headers: Headers;
  handler: HandlerDefinition<State, Auth, Spec>;
  contentType: string | null;
  writer: HTTPWriter;
  req: Request;
  recordServerTiming: boolean; 
  prevTime: number | null;

  constructor(
    req: Request,
    writer: HTTPWriter,
    contentType: string | null,
    spec: Spec,
    handler: HandlerDefinition<State, Auth, Spec>,
    headers: Headers,
    recordServerTiming: boolean,
    prevTime: number | null,
  ) {
    this.req = req;
    this.writer = writer;
    this.contentType = contentType;
    this.spec = spec;
    this.handler = handler;
    this.headers = headers;
    this.recordServerTiming = recordServerTiming && prevTime != null;
    this.prevTime = prevTime;
  }

  recordServerTime(name: string): void {
    if (!this.recordServerTiming) return;

    const nextTime = performance.now();
    const duration = nextTime - this.prevTime;

    this.headers.append('Server-Timing', `${name};dur=${duration.toFixed(2)}`);
    this.prevTime = nextTime;
  }
};

export class ActionMeta<
  State extends ContextState = ContextState,
  Auth extends AuthState = AuthState,
  Spec extends ActionSpec = ActionSpec,
> {
  rootIRI: string;
  method: string;
  isSafe: boolean = false;
  name: string;
  uriTemplate: string;
  public: boolean = false;
  authKey?: string;
  path: Path;
  hints: HintArgs[] = [];
  transformers: Map<string, TransformerFn<JSONValue | FileValue, State, Spec>> = new Map();
  scope?: Scope;
  registry: Registry;
  writer: HTTPWriter;
  action?: ImplementedAction<State, Spec>;
  acceptCache = new Set<string>();
  compressBeforeCache: boolean = false;
  cacheOccurance: 0 | 1 = BeforeDefinition;
  auth?: AuthMiddleware<Auth>;
  cache: CacheInstanceArgs[] = [];
  recordServerTiming: boolean = false;

  constructor(
    rootIRI: string,
    method: string,
    name: string,
    uriTemplate: string,
    registry: Registry,
    writer: HTTPWriter,
    scope?: Scope,
  ) {
    this.rootIRI = rootIRI;
    this.method = method.toUpperCase()
    this.isSafe = safeMethods.has(this.method);
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
   *
   * @param req The web standard request instance.
   * @param writer A HTTP writer instance.
   * @param contentType The negotiated content type of the response.
   * @param language The negotiated language of the response.
   * @param encoding The negotiated encoding of the response.
   * @param spec The action spec of the response.
   * @param handler The action handler of the response.
   */
  async primeCache(
    req: Request,
    writer: HTTPWriter,
    contentType: string,
    language?: string,
    encoding?: string,
    spec?: Spec,
    handler?: HandlerDefinition<State, Spec>,
  ): Promise<boolean> {
  }

  /**
   * Handles a request.
   *
   * All actions call this method to do the heavy lifting of handling a request.
   */
  async handleRequest({
    contentType,
    req,
    writer,
    spec,
    handler,
    cacheHitHeader,
    startTime,
  }: {
    contentType?: string;
    language?: string;
    encoding?: string;
    url: string;
    req: Request;
    writer: HTTPWriter;
    spec?: Spec;
    handler?: HandlerDefinition<State, Auth, Spec>,
    cacheHitHeader?: CacheHitHeader;
    startTime?: number;
  }): Promise<ResponseTypes> {
    const headers = new Headers();
    const refs = new MiddlewareRefs<State, Auth, Spec>(
      req,
      writer,
      contentType,
      spec,
      handler,
      headers,
      this.recordServerTiming,
      startTime,
    );

    refs.recordServerTiming = this.recordServerTiming;

    refs.recordServerTime('enter');

    // add auth check
    if (this.hints.length !== 0) {
      await Promise.all(
        this.hints.map((hint) => writer.writeEarlyHints(hint))
      );
    }

    this.#applyHandlerMiddleware(refs);
    this.#applyActionProcessing(refs);
    this.#applyCacheMiddleware(refs);
    this.#applyAuthMiddleware(refs);


    try {
      await refs.next();

      if (refs.cacheCtx?.hit) {
        refs.recordServerTime('hit');

        if (Array.isArray(cacheHitHeader)) {
          refs.headers.set(cacheHitHeader[0], cacheHitHeader[1]);
        } else if (typeof cacheHitHeader === 'string') {
          refs.headers.set(cacheHitHeader, 'HIT');
        } else if (cacheHitHeader) {
          refs.headers.set('X-Cache', 'HIT');
        }
        
        // set the ctx so the writer has access to the cached values.
        refs.handlerCtx = refs.cacheCtx as unknown as Context;
      }

      if (refs.cacheCtx?.headers != null) {
        writer.mergeHeaders(refs.cacheCtx.headers);
      } else if (refs.handlerCtx?.headers != null) {
        // The cache merges the handler ctx headers if it is part of the 
        // response. Plus it adds other headers which need to be included.
        // So it is either the cache headers get merged or the handler headers.
        writer.mergeHeaders(refs.handlerCtx.headers);
      }

      writer.mergeHeaders(refs.headers);
    } catch (err) {
      writer.mergeHeaders(refs.headers);

      throw err;
    }

    writer.writeHead(refs.handlerCtx.status ?? 200, refs.handlerCtx.headers);

    if (refs.handlerCtx.body != null) {
      writer.writeBody(refs.handlerCtx.body);
    }

    return writer.response();
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
    const downstream: NextFn = refs.next;
    refs.next = async () => {
      let processed: ProcessActionResult<Spec>;

      if (refs.spec != null) {
        processed = await processAction<State, Spec>({
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
        public: this.public && refs.authKey == null,
        auth: refs.auth,
        authKey: refs.authKey,
        handler: refs.handler,
        params: processed.params ?? {},
        query: processed.query ?? {},
        payload: processed.payload ?? {} as ProcessActionResult<Spec>['payload'],
      });

      if (refs.contentType != null) {
        // must apply to the handler headers so the cache headers can access
        // the value.
        refs.handlerCtx.headers.set('Content-Type', refs.contentType)
      }

      refs.recordServerTime('payload')

      await downstream();
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
        public: this.public && refs.authKey == null,
        auth: refs.auth,
        authKey: refs.authKey,
        handler: refs.handler,
        params: {},
        query: {},
      });

      await cacheMiddleware.middleware(
        this.getCacheDescriptor(refs.contentType, refs.req, refs.cacheCtx),
        refs.cacheCtx,
        async () => {
          // write any cache headers to the response headers.
          // this should be reviewed as it may be unsafe to
          // allow a handler to override these headers.
          refs.writer.mergeHeaders(refs.cacheCtx.headers);

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
      
          for (const [key, value] of refs.handlerCtx.headers.entries()) {
            refs.cacheCtx.headers.set(key, value);
          }
        },
      );
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
