import { joinPaths } from "./utils/joinPaths.ts"
import { ActionAuth, HandlerDefinition } from "./actions/actions.ts";
import { ActionCore } from "./actions/core.ts";
import type { ContextState } from "./actions/spec.ts";
import type { AuthMiddleware, ImplementedAction } from "./actions/types.ts";
import type { HTTPWriter } from "./actions/writer.ts";
import { type Callable, HTTP, type Registry } from './registry.ts';
import type {EndpointArgs} from "./types.ts";


export type MetaPropatator = (meta: ActionCore) => void;

export type ScopeArgs = {
  path: string;
  serverTiming?: boolean;
  registry: Registry;
  writer: HTTPWriter;
  propergateMeta: MetaPropatator;
}


export class Scope<
  State extends ContextState = ContextState,
> implements Callable<State> {
  #path: string;
  #recordServerTiming: boolean;
  #registry: Registry;
  #writer: HTTPWriter;
  #http: HTTP<State>;
  #children: Array<ActionCore> = [];
  #public: boolean = true;
  #auth: AuthMiddleware | undefined;
  #propergateMeta: MetaPropatator;
  #autoLanguageTags: boolean;
  #autoFileExtensions: boolean;
  
  constructor(
    path: string,
    registry: Registry,
    writer: HTTPWriter,
    propergateMeta: MetaPropatator,
    recordServerTiming: boolean,
    autoLanguageTags: boolean,
    autoFileExtensions: boolean,
  ) {
    this.#path = path;
    this.#registry = registry;
    this.#writer = writer;
    this.#http = new HTTP<State>(this);
    this.#propergateMeta = propergateMeta;
    this.#recordServerTiming = recordServerTiming;
    this.#autoLanguageTags = autoLanguageTags;
    this.#autoFileExtensions = autoFileExtensions;
  }

  get path(): string {
    return this.#path;
  }

  get registry(): Registry {
    return this.#registry;
  }

  get http(): HTTP<State> {
    return this.#http;
  }

  get actions(): Array<ImplementedAction> {
    return this.#children
      .filter((meta) => {
        if (meta.action == null) {
          console.warn(`Action ${meta.method}: ${meta.route} not fully implemented before processing`);
        }

        return meta.action != null;
      })
      .map((meta) => meta.action) as Array<ImplementedAction>;
  }

  get handlers(): HandlerDefinition[] {
    return this.actions.flatMap((action) => action.handlers);
  }

  public(authMiddleware?: AuthMiddleware): Scope<State> {
    this.#public = true;
    this.#auth = authMiddleware;

    return this;
  }

  private(authMiddleware: AuthMiddleware): Scope<State> {
    this.#public = false;
    this.#auth = authMiddleware;

    return this;
  }

  /**
   * Creates an action for any HTTP method.
   *
   * @param method The HTTP method name.
   * @param name   Name for the action being produced.
   * @param path   Path the action responds to.
   */
  public endpoint(method: string, path: string, args?: EndpointArgs): ActionAuth<State> {
    const meta = new ActionCore<State>(
      this.registry.rootIRI,
      method,
      args?.name,
      path,
      this.#registry,
      this.#writer,
      this,
      args?.autoLanguageTags ?? args?.autoRouteParams ?? this.#autoLanguageTags,
      args?.autoFileExtensions ?? args?.autoRouteParams ?? this.#autoFileExtensions,
      this.#recordServerTiming,
    );

    meta.recordServerTiming = this.#recordServerTiming;

    this.#children.push(meta);
    
    return new ActionAuth<State>(meta);
  }
  
  url(): string {
    return joinPaths(this.#registry.rootIRI, this.#path);
  }

  finalize(): void {
    const partials = {
      '@id': this.url(),
      '@container': '@type',
    };

    for (let index = 0; index < this.#children.length; index++) {
      const meta = this.#children[index];
      const action = meta.action;

      if (action == null || action.type == null) {
        continue;
      }

      const partial = action.jsonldPartial();

      if (partial == null) {
        continue;
      }

      partials[partial['@type']] = partial;
    }

    if (this.#public) {
      this.#registry.http.get(this.#path)
        .public()
        .handle('application/ld+json', (ctx) => {
          ctx.body = JSON.stringify(partials);
        });
    } else {
      this.#registry.http.get(this.#path)
        .public()
        .handle('application/ld+json', (ctx) => {
           ctx.body = JSON.stringify(partials);
        });
    }
    
    for (let index = 0; index < this.#children.length; index++) {
      const action = this.#children[index].action;

      if (action == null || action.type == null) {
        continue;
      }

      if (this.#public) {
        this.#registry.http.get(joinPaths(this.url(), action.name))
          .public(this.#auth)
          .handle('application/ld+json', async (ctx) => {
            ctx.body = JSON.stringify(await action.jsonld());
          });
      } else {
        this.#registry.http.get(joinPaths(this.url(), action.name))
          .private(this.#auth)
          .handle('application/ld+json', async (ctx) => {
            ctx.body = JSON.stringify(await action.jsonld());
          });
      }
    }
  }
}

