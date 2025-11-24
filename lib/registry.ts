import { Accept } from "./accept.ts";
import { ActionAuth } from "./actions/actions.ts";
import { type ActionMatchResult, ActionSet } from "./actions/actionSets.ts";
import { ActionMeta } from "./actions/meta.ts";
import type { Handler, ImplementedAction } from "./actions/types.ts";
import { FetchResponseWriter } from "./actions/writer.ts";
import { Scope } from './scopes.ts';
import { IncomingMessage, type ServerResponse } from "node:http";
import type { Merge } from "./actions/spec.ts";
import type { ContextState, Middleware } from "./actions/spec.ts";
import {ProblemDetailsError} from "./errors";


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
};

export class Registry<
  State extends ContextState = ContextState,
> implements Callable<State> {

  #path: string;
  #rootIRI: string;
  #http: HTTP<State>;
  #scopes: Scope[] = [];
  #children: ActionMeta[] = [];
  #index?: IndexEntry;
  #writer = new FetchResponseWriter();
  #eventTarget = new EventTarget();
  #middleware: Middleware[] = [];

  constructor(args: RegistryArgs) {
    const url = new URL(args.rootIRI);

    this.#rootIRI = args.rootIRI;
    this.#path = url.pathname
    this.#http = new HTTP<State>(this);
  }

  scope(path: string): Scope<State> {
    const scope = new Scope<State>(
      path,
      this,
      this.#writer,
      (meta) => this.#children.push(meta),
    );

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
    const implemented = this.#children
      .filter((meta) => {
        if (meta.action == null) {
          console.warn(`Action ${meta.method}: ${meta.path} not fully implemented before processing`);
        }

        return meta.action != null;
      })
      .map((meta) => meta.action) as Array<ImplementedAction>;

    return implemented.concat(
      this.#scopes.flatMap((scope) => scope.actions)
    );
  }

  get handlers(): Handler[] {
    return this.actions.flatMap((action) => action.handlers);
  }

  get(actionName: string): ImplementedAction | undefined {
    return this.actions.find((action) => action.name === actionName);
  }

  //extensions(extensions: ExtensionMap) {
  //  this.#extensions = new Map(
  //    Object.entries(extensions),
  //  );

  //  return this;
  //}

  /**
   * Creates any HTTP method.
   *
   * @param method The HTTP method.
   * @param name   Name for the action being produced.
   * @param path   Path the action responds to.
   */
  public method(method: string, name: string, path: string): ActionAuth<State> {
    const meta = new ActionMeta(
      this.#rootIRI,
      method.toUpperCase(),
      name,
      path,
      this,
      this.#writer,
    );

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

    this.#index = new IndexEntry(actionSets);
    this.#eventTarget.dispatchEvent(
      new Event('afterfinalize', { bubbles: true, cancelable: false })
    );
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
          url,
          type: 'request',
          contentType: match.contentType,
          req,
          writer: new FetchResponseWriter(),
        });
      } else if (match?.type === 'match' && req instanceof IncomingMessage) {
        return await match.action.handleRequest({
          url,
          type: 'node-http',
          contentType: match.contentType,
          req,
          res: res as ServerResponse,
          writer: new FetchResponseWriter(res),
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
