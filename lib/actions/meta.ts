import type { Registry } from '../registry.js';
import type { Handler, HintArgs, ImplementedAction } from './types.js';
import type { ContextState, ActionSpec, TransformerFn, FileValue } from './spec.js';
import type { Scope } from "../scopes.js";
import { Path } from "./path.js";
import type { HTTPWriter, ResponseTypes } from "./writer.js";
import {JSONValue} from '../jsonld.js';
import {joinPaths} from '../utils/joinPaths.js';
import {processAction} from '../processAction.js';
import {Context} from './context.js';
import {write} from 'fs';
import {IncomingMessage, ServerResponse} from 'http';

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
    url: URL;
    req: Request | IncomingMessage;
    writer: HTTPWriter;
    spec?: Spec;
    handler?: Handler<State, Spec>,
  }): Promise<ResponseTypes> {
    const iri = url.toString();
    const state: State = {} as State;

    // add auth check
    if (this.hints.length !== 0) {
      await Promise.all(
        this.hints.map((hint) => writer.writeEarlyHints(hint))
      );
    }

    const res = await processAction<State, Spec>({
      iri,
      req,
      spec,
      state,
      action: this.action,
    });

    const ctx = new Context<State, Spec>({
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
    
    if (typeof handler.handler === 'string') {
      ctx.body = handler.handler
    } else {
      await handler.handler(ctx);
    }

    writer.writeHead(ctx.status ?? 200, ctx.headers);
    writer.writeBody(ctx.body);

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
