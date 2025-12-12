import type {HandlerDefinition} from "../mod.js";
import type {Registry} from "../registry.js";
import type {ActionPayload, ActionSpec, ContextState, ParsedIRIValues} from "./spec.js";
import type {ImplementedAction} from "./types.js";
import type {ResponseBody} from "./writer.js";


class EditableContext {
  hit: boolean = false;
  etag?: string;
  status?: number;
  body?: ResponseBody;
};

export type CacheContextArgs = {
  req: Request;
  url: string;
  contentType: string;
  public: boolean;
  authKey?: string;
  handler: HandlerDefinition;
  params: ParsedIRIValues;
  query: ParsedIRIValues;
};


/**
 * Request context object.
 */
export class CacheContext {
  #editable = new EditableContext();
  req: Request;
  method: string;
  url: string;
  contentType: string;
  public: boolean = false
  authKey?: string;
  action: ImplementedAction;
  registry: Registry;
  params: ParsedIRIValues;
  query: ParsedIRIValues;
  headers: Headers = new Headers();

  constructor(args: CacheContextArgs) {
    this.req = args.req;
    this.url = args.url;
    this.contentType = args.contentType;
    this.public = args.public;
    this.authKey = args.authKey;
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
  Spec extends ActionSpec = ActionSpec,
> = {
  req: Request;
  url: string;
  contentType: string;
  public: boolean;
  authKey?: string;
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
  Spec extends ActionSpec = ActionSpec,
> {
  #editable = new EditableContext();
  req: Request;
  method: string;
  url: string;
  contentType: string;
  public: boolean = false
  authKey?: string;
  state: State = {} as State;
  action: ImplementedAction<State, Spec>;
  registry: Registry;
  params: ParsedIRIValues;
  query: ParsedIRIValues;
  payload: ActionPayload<Spec>;
  headers: Headers = new Headers();

  constructor(args: ContextArgs<State, Spec>) {
    this.req = args.req;
    this.url = args.url;
    this.contentType = args.contentType;
    this.public = args.public;
    this.authKey = args.authKey;
    this.action = args.handler.action;
    this.method = args.handler.action.method;
    this.registry = args.handler.action.registry;
    this.params = args.params;
    this.query = args.query;
    this.payload = args.payload;

    Object.freeze(this);
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

