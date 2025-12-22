import {Accept} from '../accept.ts';
import {CacheMiddleware} from '../cache/cache.ts';
import type {CacheEntryDescriptor, CacheInstanceArgs, CacheSemantics} from '../cache/types.ts';
import {ProblemDetailsError} from '../errors.ts';
import type {JSONValue} from '../jsonld.ts';
import {processAction, type ProcessActionResult} from '../processAction.ts';
import type {Registry} from '../registry.ts';
import {WrappedRequest} from '../request.ts';
import type {Scope} from "../scopes.ts";
import {joinPaths} from '../utils/joinPaths.ts';
import {HandlerDefinition} from './actions.ts';
import {ActionSet} from './actionSets.ts';
import {CacheContext, Context} from './context.ts';
import {Path} from "./path.ts";
import type {ActionSpec, ContextState, FileValue, NextFn, TransformerFn} from './spec.ts';
import type {AuthMiddleware, AuthState, CacheHitHeader, HintArgs, ImplementedAction} from './types.ts';
import {ResponseWriter, type HTTPWriter, type ResponseTypes} from "./writer.ts";


export const BeforeDefinition = 0;
export const AfterDefinition = 1;

const cacheMiddleware = new CacheMiddleware();

export class ActionMeta<
  State extends ContextState = ContextState,
  Auth extends AuthState = AuthState,
  Spec extends ActionSpec = ActionSpec,
> {
  rootIRI: string;
  method: string;
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
  serverTiming: boolean = false;

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

  async perform(req: Request): Promise<Response> {
    const actionSet = new ActionSet(this.rootIRI, this.method, this.path.normalized, [this]);
    const wrapped = new WrappedRequest(this.rootIRI, req);
    const writer = new ResponseWriter();
    const accept = Accept.from(req);
    const url = new URL(wrapped.url);
    const result = actionSet.matches(wrapped.method, url.pathname, accept);

    if (result.type === 'match') {
      const handler = this.action.handlerFor(result.contentType);

      return this.handleRequest({
        startTime: performance.now(),
        contentType: result.contentType,
        url: url.toString(),
        req: wrapped,
        writer,
        spec: this.action.spec as Spec,
        handler,
      }) as Promise<Response>;
    }
    
    return new Response(null, { status: 404 });
  }

  /**
   *
   */
  async handleRequest({
    contentType,
    url,
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
    handler?: HandlerDefinition<State, Spec>,
    cacheHitHeader?: CacheHitHeader;
    startTime?: number;
  }): Promise<ResponseTypes> {
    const state: State = {} as State;
    const headers = new Headers();

    let authKey: string | undefined;
    let auth: Auth = {} as Auth;
    let ctx: CacheContext<Auth> | Context<State, Auth, Spec>;
    let cacheCtx: CacheContext<Auth>;
    let prevTime = startTime;
    let performServerTiming = this.serverTiming && startTime != null;

    const serverTiming = (name: string) => {
      const nextTime = performance.now();
      const duration = nextTime - prevTime;

      headers.append('Server-Timing', `${name};dur=${duration.toFixed(2)}`);
      prevTime = nextTime;
    }

    if (performServerTiming) serverTiming('enter');

    // add auth check
    if (this.hints.length !== 0) {
      await Promise.all(
        this.hints.map((hint) => writer.writeEarlyHints(hint))
      );
    }

    let next: NextFn = async () => {
      if (typeof handler.handler === 'function') {
        await handler.handler(ctx as Context<State, Auth, Spec>);
      } else {
        ctx.status = 200;
        ctx.body = handler.handler;
      }

      if (performServerTiming) serverTiming('handle');
    };

    {
      const upstream: NextFn = next;
      next = async () => {
        let processed: ProcessActionResult<Spec>;

        if (spec != null) {
          processed = await processAction<State, Spec>({
            iri: url,
            req,
            spec: spec ?? {} as Spec,
            state,
            action: this.action,
          });
        }

        ctx = new Context<State, Auth, Spec>({
          req,
          url,
          contentType,
          public: this.public && authKey == null,
          auth,
          authKey,
          handler,
          params: processed.params ?? {},
          query: processed.query ?? {},
          payload: processed.payload ?? {} as ProcessActionResult<Spec>['payload'],
        });

        if (contentType != null) {
          ctx.headers.set('Content-Type', contentType)
        }

        if (performServerTiming) serverTiming('payload');

        await upstream();
      }
    }

    if (this.cache.length > 0) {
      const upstream = next;
      next = async () => {
        cacheCtx = new CacheContext({
          req,
          url,
          contentType,
          public: this.public && authKey == null,
          auth,
          authKey,
          handler,
          params: {},
          query: {},
        });
        const descriptors: CacheEntryDescriptor[] = this.cache.map(args => {
          return {
            contentType,
            semantics: args.semantics ?? req.method.toLowerCase() as CacheSemantics,
            action: this.action as ImplementedAction,
            request: req,
            args,
          };
        });

        await cacheMiddleware.use(
          descriptors,
          cacheCtx,
          async () => {
            // write any cache headers to the response headers.
            // this should be reviewed as it may be unsafe to
            // allow a handler to override these headers.
            writer.mergeHeaders(cacheCtx.headers);

            // cache was not hit if in this function
            await upstream();

            // the cache middleware requires these values are set 
            cacheCtx.status = ctx.status;

            if (ctx.body instanceof ReadableStream) {
              const [a, b] = ctx.body.tee();
              
              ctx.body = a;
              cacheCtx.body = b;
            } else {
              cacheCtx.body = ctx.body;
            }
        
            for (const [key, value] of ctx.headers.entries()) {
              cacheCtx.headers.set(key, value);
            }
          },
        );
      }
    }

    if (this.auth != null) {
      const upstream = next;
      next = async () => {
        const res = await this.auth(req);

        if (Array.isArray(res) &&
            typeof res[0] === 'string' &&
            res.length > 0) {
          authKey = res[0];
          auth = res[1];

          await upstream();
        } else if (this.public) {
          await upstream();
        } else {
  
          // Failed authentication on a private endpoint.
          throw new ProblemDetailsError(404, {
            title: 'Not found',
          });
        }
      };
    }


    try {
      await next();

      if (cacheCtx?.hit) {
        if (performServerTiming) serverTiming('hit');

        if (Array.isArray(cacheHitHeader)) {
          cacheCtx.headers.set(cacheHitHeader[0], cacheHitHeader[1]);
        } else if (typeof cacheHitHeader === 'string') {
          cacheCtx.headers.set(cacheHitHeader, 'HIT');
        } else if (cacheHitHeader) {
          cacheCtx.headers.set('X-Cache', 'HIT');
        }
        
        // set the ctx so the writer has access to the cached values.
        ctx = cacheCtx;
      } else if (cacheCtx?.etag != null) {
        ctx.headers.set('Etag', cacheCtx.etag);
      }
      
      writer.mergeHeaders(headers);
    } catch (err) {
      writer.mergeHeaders(headers);

      throw err;
    }

    writer.writeHead(ctx.status ?? 200, ctx.headers);

    if (ctx.body != null) {
      writer.writeBody(ctx.body);
    }

    return writer.response();
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
