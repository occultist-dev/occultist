import { joinPaths } from "./action.ts";
import { ActionAuth } from "./actions/actions.ts";
import { ActionMeta } from "./actions/meta.ts";
import type { Handler, ImplementedAction } from "./actions/types.ts";
import type { HTTPWriter } from "./actions/writer.ts";
import { type Callable, HTTP, type Registry } from './registry.ts';


export class Scope implements Callable {
  #path: string;
  #registry: Registry;
  #writer: HTTPWriter;
  #http: HTTP;
  #children: Array<ActionMeta> = [];
  #public: boolean = true;
  #propergateMeta: (meta: ActionMeta) => void;
  
  constructor(
    path: string,
    registry: Registry,
    writer: HTTPWriter,
    propergateMeta: (meta: ActionMeta) => void,
  ) {
    this.#path = path;
    this.#registry = registry;
    this.#writer = writer;
    this.#http = new HTTP(this);
    this.#propergateMeta = propergateMeta;
  }

  get path(): string {
    return this.#path;
  }

  get registry(): Registry {
    return this.#registry;
  }

  get http(): HTTP {
    return this.#http;
  }

  get actions(): Array<ImplementedAction> {
    return this.#children
      .filter((meta) => {
        if (meta.action == null) {
          console.warn(`Action ${meta.method}: ${meta.path} not fully implemented before processing`);
        }

        return meta.action != null;
      })
      .map((meta) => meta.action) as Array<ImplementedAction>;
  }

  get handlers(): Handler[] {
    return this.actions.flatMap((action) => action.handlers);
  }

  public(): Scope {
    this.#public = true;

    return this;
  }

  private(): Scope {
    this.#public = false;

    return this;
  }

  /**
   * Creates any HTTP method.
   *
   * @param method The HTTP method.
   * @param name   Name for the action being produced.
   * @param path   Path the action responds to.
   */
  method(method: string, name: string, path: string): ActionAuth {
    const meta = new ActionMeta(
      this.#registry.rootIRI,
      method.toUpperCase(),
      name,
      path,
      this.#registry,
      this.#writer,
      this,
    );

    this.#children.push(meta);
    this.#propergateMeta(meta);
    
    return new ActionAuth(meta);
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
      this.#registry.http.get('scope', this.#path)
        .public()
        .handle('application/ld+json', (ctx) => {
          ctx.body = JSON.stringify(partials);
        });
    } else {
      this.#registry.http.get('scope', this.#path)
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
        this.#registry.http.get('scope-action', joinPaths(this.url(), action.name))
          .public()
          .handle('application/ld+json', async (ctx) => {
            console.log('GETTING JSON LD');
            ctx.body = JSON.stringify(await action.jsonld());
          });
      } else {
        this.#registry.http.get('scope-action', joinPaths(this.url(), action.name))
          .private()
          .handle('application/ld+json', async (ctx) => {
            ctx.body = JSON.stringify(await action.jsonld());
          });
      }
    }
  }
}

