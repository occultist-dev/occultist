import type { Registry } from '../registry.js';
import type { Handler, HintArgs, ImplementedAction } from './types.js';
import type { ContextState, ActionSpec, TransformerFn, FileValue, NextFn } from './spec.js';
import type { Scope } from "../scopes.js";
import { Path } from "./path.js";
import type { HTTPWriter, ResponseTypes } from "./writer.js";
import {JSONValue} from '../jsonld.js';
import {joinPaths} from '../utils/joinPaths.js';
import {processAction} from '../processAction.js';
import {Context} from './context.js';
import {CacheContext, CacheEntryDescriptor, CacheInstanceArgs} from '../cache/types.js';
import {CacheMiddleware} from '../cache/cache.js';


const cacheMiddleware = new CacheMiddleware();

export class ActionMeta<
  State extends ContextState = ContextState,
  Spec extends ActionSpec = ActionSpec,
> {
  rootIRI: string;
  method: string;
  name: string;
  uriTemplate: string;
  path: Path;
  hints: HintArgs[] = [];
  transformers: Map<string, TransformerFn<JSONValue | FileValue, State, Spec>> = new Map();
  scope?: Scope;
  registry: Registry;
  writer: HTTPWriter;
  action?: ImplementedAction<State, Spec>;
  acceptCache = new Set<string>();
  allowsPublicAccess = false;
  compressBeforeCache = false;
  cache: CacheInstanceArgs[] = [];

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
    contentType,
    language: _language,
    encoding: _encoding,
    url,
    req,
    writer,
    spec,
    handler,
  }: {
    contentType?: string;
    language?: string;
    encoding?: string;
    url: string;
    req: Request;
    writer: HTTPWriter;
    spec?: Spec;
    handler?: Handler<State, Spec>,
  }): Promise<ResponseTypes> {
    const iri = url.toString();
    const state: State = {} as State;
    let ctx: Context<State, Spec>;

    // add auth check
    if (this.hints.length !== 0) {
      await Promise.all(
        this.hints.map((hint) => writer.writeEarlyHints(hint))
      );
    }

    let next: NextFn = async () => {
      if (typeof handler.handler === 'string') {
        ctx.status = 200;
        ctx.body = handler.handler;
      } else {
        await handler.handler(ctx);
      }
    };

    {
      const upstream: NextFn = next;
      next = async () => {
        const res = await processAction<State, Spec>({
          iri,
          req,
          spec,
          state,
          action: this.action,
        });

        ctx = new Context<State, Spec>({
          url: iri,
          public: this.allowsPublicAccess,
          handler,
          params: res.params,
          query: res.query,
          payload: res.payload,
        });

        if (contentType != null) {
          ctx.headers.set('Content-Type', contentType)
        }
        await upstream();
      }
    }
    console.log('CACHE?', this.cache);

    if (this.cache.length > 0) {
      const cacheCtx: CacheContext = {
        hit: false,
        status: 0,
        headers: new Headers(),
        req,
      };
      const descriptors: CacheEntryDescriptor[] = this.cache.map(args => {
        return {
          action: this.action as ImplementedAction,
          request: req,
          args,
        };
      });

      const upstream = next;
      next = async () => {
        console.log('USING CACHE');
        await cacheMiddleware.use(
          descriptors,
          cacheCtx,
          upstream,
        );

        if (cacheCtx.hit) {
          ctx.status = cacheCtx.status;
          ctx.headers = cacheCtx.headers;
          ctx.body = cacheCtx.bodyStream;
        } else {
          await upstream();
        }
      }
    }

    await next();

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
}
