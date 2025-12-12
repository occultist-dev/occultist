import {CacheMiddleware} from '../cache/cache.js';
import {CacheEntryDescriptor, CacheInstanceArgs} from '../cache/types.js';
import {JSONValue} from '../jsonld.js';
import {processAction} from '../processAction.js';
import type {Registry} from '../registry.js';
import type {Scope} from "../scopes.js";
import {joinPaths} from '../utils/joinPaths.js';
import {HandlerDefinition} from './actions.js';
import {CacheContext, Context} from './context.js';
import {Path} from "./path.js";
import type {ActionSpec, ContextState, FileValue, NextFn, TransformerFn} from './spec.js';
import type {HintArgs, ImplementedAction} from './types.js';
import type {HTTPWriter, ResponseTypes} from "./writer.js";


export const BeforeDefinition = 0;
export const AfterDefinition = 1;

const cacheMiddleware = new CacheMiddleware();

export class ActionMeta<
  State extends ContextState = ContextState,
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

  async handleRequest({
    startTime,
    contentType,
    language: _language,
    encoding: _encoding,
    url,
    req,
    writer,
    spec,
    handler,
  }: {
    startTime: number;
    contentType?: string;
    language?: string;
    encoding?: string;
    url: string;
    req: Request;
    writer: HTTPWriter;
    spec?: Spec;
    handler?: HandlerDefinition<State, Spec>,
  }): Promise<ResponseTypes> {
    const state: State = {} as State;
    const headers = new Headers();
    let ctx: CacheContext | Context<State, Spec>;
    let cacheCtx: CacheContext;
    let prevTime = startTime;

    const serverTiming = (name: string) => {
      const nextTime = performance.now();
      const duration = nextTime - prevTime;

      headers.append('Server-Timing', `${name};dur=${duration.toPrecision(2)}`);
      prevTime = nextTime;
    }

    if (this.serverTiming) serverTiming('enter');

    // add auth check
    if (this.hints.length !== 0) {
      await Promise.all(
        this.hints.map((hint) => writer.writeEarlyHints(hint))
      );
    }

    let next: NextFn = async () => {
      if (typeof handler.handler === 'function') {
        await handler.handler(ctx as Context<State, Spec>);
      } else {
        ctx.status = 200;
        ctx.body = handler.handler;
      }

      if (this.serverTiming) serverTiming('handle');
    };

    {
      const upstream: NextFn = next;
      next = async () => {
        const res = await processAction<State, Spec>({
          iri: url,
          req,
          spec: spec ?? {} as Spec,
          state,
          action: this.action,
        });

        ctx = new Context<State, Spec>({
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
          ctx.headers.set('Content-Type', contentType)
        }

        if (this.serverTiming) serverTiming('payload');

        await upstream();
      }
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
      const descriptors: CacheEntryDescriptor[] = this.cache.map(args => {
        return {
          contentType,
          action: this.action as ImplementedAction,
          request: req,
          args,
        };
      });

      const upstream = next;
      next = async () => {
        await cacheMiddleware.use(
          descriptors,
          cacheCtx,
          async () => {
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

    try {
      await next();

      if (cacheCtx?.hit) {
        if (this.serverTiming) serverTiming('hit');
        
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
