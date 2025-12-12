import { Accept } from "./accept.js";
import { ActionAuth, HandlerDefinition } from "./actions/actions.js";
import { type ActionMatchResult, ActionSet } from "./actions/actionSets.js";
import { ActionMeta } from "./actions/meta.js";
import type { ImplementedAction } from "./actions/types.js";
import { FetchResponseWriter } from "./actions/writer.js";
import { Scope } from './scopes.js';
import { IncomingMessage, type ServerResponse } from "node:http";
import type { Merge } from "./actions/spec.js";
import type { ContextState, Middleware } from "./actions/spec.js";
import {ProblemDetailsError} from "./errors.js"
import {NodeRequest} from "./request.js";


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

  trace(name: string, path: string): ActionAuth<State> {
    return this.#callable.method('trace', name, path);
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
  rootIRI: string;
  serverTiming?: boolean;
};

export class Registry<
  State extends ContextState = ContextState,
> implements Callable<State> {

  #finalized: boolean = false;
  #path: string;
  #rootIRI: string;
  #serverTiming: boolean;
  #http: HTTP<State>;
  #scopes: Scope[] = [];
  #children: ActionMeta[] = [];
  #index?: IndexEntry;
  #writer = new FetchResponseWriter();
  #eventTarget = new EventTarget();
  #middleware: Middleware[] = [];
  #actions: ImplementedAction[] | null = null;
  #handlers: HandlerDefinition[] | null = null;

  constructor(args: RegistryArgs) {
    const url = new URL(args.rootIRI);

    this.#rootIRI = args.rootIRI;
    this.#path = url.pathname
    this.#serverTiming = args.serverTiming ?? false;
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
    const meta = new ActionMeta<State>(
      this.#rootIRI,
      method.toUpperCase(),
      name,
      path,
      this,
      this.#writer,
    );

    meta.serverTiming = this.#serverTiming;

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

  finalize() {
    if (this.#finalized)
      throw new Error('Registry has already been finalized');
      
    const actionSets: ActionSet[] = [];
    const groupedMeta = new Map<string, Map<string, ActionMeta[]>>();

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

  handleRequest(
    req: Request,
  ): Promise<Response>;
  
  handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<ServerResponse>;

  async handleRequest(
    req: Request | IncomingMessage,
    res?: ServerResponse,
  ): Promise<Response | ServerResponse> {
    const startTime = performance.now();
    const accept = Accept.from(req);
    // hack, until a better way to normalize the url is sorted
    const reqURL = new URL(req.url);
    const url = new URL(this.#rootIRI + reqURL.pathname);
    
    url.search = reqURL.search;

    const match = this.#index?.match(
      req.method ?? 'GET',
      url.toString(),
      accept,
    );

    let err: ProblemDetailsError;

    try {
      if (match?.type === 'match' && req instanceof Request) {
        return await match.action.handleRequest({
          url: req.url,
          contentType: match.contentType,
          req,
          writer: new FetchResponseWriter(),
          startTime,
        });
      } else if (match?.type === 'match' && req instanceof IncomingMessage) {
        const nodeRequest = new NodeRequest(this.#rootIRI, req) as Request;

        return await match.action.handleRequest({
          url: nodeRequest.url,
          contentType: match.contentType,
          req: nodeRequest,
          writer: new FetchResponseWriter(res),
          startTime,
        });
      }
    } catch (err2) {
      if (err2 instanceof ProblemDetailsError) {
        err = err2;
      } else {
        console.error('Unexpected error', err2);
      }
    }

    if (err == null) {
      err = new ProblemDetailsError(500, 'Unexpected error');
    }
      
    if (err instanceof ProblemDetailsError && req instanceof Request) {
      return new Response(err.toContent('application/problem+json'), {
        status: err.status,
        headers: {
          'Content-Type': 'application/problem+json',
        },
      });
    } else if (err instanceof ProblemDetailsError && res != null) {
      res.writeHead(err.status, {
        'Content-Type': 'application/problem+json',
      });
      res.end(err.toContent('application/problem+json'));
      return res;
    }
  }

  addEventListener(type: RegistryEvents, callback: EventListener) {
    this.#eventTarget.addEventListener(type, callback);
  };

  removeEventListener(type: RegistryEvents, callback: EventListener) {
    this.#eventTarget.removeEventListener(type, callback)
  }
}
