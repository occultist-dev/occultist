import type {HandlerDefinition} from "../mod.ts";
import type {Registry} from "../registry.ts";
import type {ActionPayload, ActionSpec, ContextState, ParsedIRIValues} from "./spec.ts";
import type {AuthState, ImplementedAction} from "./types.ts";
import type {ResponseBody} from "./writer.ts";


class EditableContext {
  hit: boolean = false;
  etag?: string;
  status?: number;
  body?: ResponseBody;
};

export type CacheContextArgs<
  Auth extends AuthState = AuthState,
> = {
  req: Request;
  contentType: string;
  public: boolean;
  authKey?: string;
  auth: Auth;
  handler: HandlerDefinition;
  params: ParsedIRIValues;
  query: ParsedIRIValues;
};

/**
 * Request context object.
 */
export class CacheContext<
  Auth extends AuthState = AuthState,
> {
  #editable = new EditableContext();
  req: Request;
  method: string;
  url: string;
  contentType: string;
  public: boolean = false
  authKey?: string;
  auth: Auth;
  action: ImplementedAction;
  registry: Registry;
  params: ParsedIRIValues;
  query: ParsedIRIValues;
  headers: Headers = new Headers();

  constructor(args: CacheContextArgs<Auth>) {
    this.req = args.req;
    this.url = args.req.url;
    this.contentType = args.contentType;
    this.public = args.public;
    this.authKey = args.authKey;
    this.auth = args.auth;
    this.action = args.handler.action;
    this.method = args.handler.action.method;
    this.registry = args.handler.action.registry;
    this.params = args.params;
    this.query = args.query;

    Object.freeze(this);
  }

  get hit(): boolean {
    return this.#editable.hit;
  }

  set hit(hit: boolean) {
    this.#editable.hit = hit;
  }

  get status(): undefined | number {
    return this.#editable.status;
  }

  set status(status: number) {
    this.#editable.status = status;
  }

  get body(): undefined | ResponseBody {
    return this.#editable.body;
  }

  set body(body: ResponseBody) {
    this.#editable.body = body;
  }

  get etag(): undefined | string {
    return this.#editable.etag;
  }

  set etag(etag: string) {
    this.#editable.etag = etag;
  }

  get [Symbol.toStringTag]() {
    return `action=${this.action.name} method=${this.method} contentType=${this.contentType}`;
  }
}


export type ContextArgs<
  State extends ContextState = ContextState,
  Auth extends AuthState = AuthState,
  Spec extends ActionSpec = ActionSpec,
> = {
  req: Request;
  contentType: string;
  public: boolean;
  authKey?: string;
  auth: Auth;
  handler: HandlerDefinition<State, Spec>;
  params: ParsedIRIValues;
  query: ParsedIRIValues;
  payload: ActionPayload<Spec>;
};

/**
 * Request context object.
 */
export class Context<
  State extends ContextState = ContextState,
  Auth extends AuthState = AuthState,
  Spec extends ActionSpec = ActionSpec,
> {
  #editable = new EditableContext();
  req: Request;
  method: string;
  url: string;
  contentType: string;
  public: boolean = false
  authKey?: string;
  auth: Auth;
  state: State = {} as State;
  action: ImplementedAction<State, Spec>;
  registry: Registry;
  params: ParsedIRIValues;
  query: ParsedIRIValues;
  payload: ActionPayload<Spec>;
  headers: Headers = new Headers();

  constructor(args: ContextArgs<State, Auth, Spec>) {
    this.req = args.req;
    this.url = args.req.url;
    this.contentType = args.contentType;
    this.public = args.public;
    this.authKey = args.authKey;
    this.auth = args.auth;
    this.action = args.handler.action;
    this.method = args.handler.action.method;
    this.registry = args.handler.action.registry;
    this.params = args.params;
    this.query = args.query;
    this.payload = args.payload;

    Object.freeze(this);
    Object.freeze(this.auth);
  }

  get status(): undefined | number {
    return this.#editable.status;
  }

  set status(status: number) {
    this.#editable.status = status;
  }

  get body(): undefined | ResponseBody {
    return this.#editable.body;
  }

  set body(body: ResponseBody) {
    this.#editable.body = body;
  }

  get [Symbol.toStringTag]() {
    return `action=${this.action.name} method=${this.method} contentType=${this.contentType}`;
  }
}

