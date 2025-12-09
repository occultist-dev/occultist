import type { Handler, ImplementedAction } from "./types.js";
import type { Registry } from "../registry.js";
import type { ActionSpec, ContextState, ActionPayload, ParsedIRIValues } from "./spec.js";
import {ResponseBody} from "./writer.js";


export type ContextArgs<
  State extends ContextState = ContextState,
  Spec extends ActionSpec = ActionSpec,
> = {
  url: string;
  contentType: string;
  public: boolean;
  authKey?: string;
  handler: Handler<State, Spec>;
  params?: ParsedIRIValues;
  query?: ParsedIRIValues;
  payload?: ActionPayload<Spec>;
};

/**
 * Request context object.
 */
export class Context<
  State extends ContextState = ContextState,
  Spec extends ActionSpec = ActionSpec,
> {
  status?: number;
  statusText?: string;
  headers = new Headers();
  body?: ResponseBody;

  #url: string;
  #contentType: string;
  #public: boolean = false
  #authKey?: string;
  #state: State = {} as State;
  #action: ImplementedAction<State, Spec>;
  #registry: Registry;
  #params?: ParsedIRIValues;
  #query?: ParsedIRIValues;
  #payload: ActionPayload<Spec>;

  constructor(args: ContextArgs<State, Spec>) {
    this.#url = args.url;
    this.#contentType = args.contentType;
    this.#public = args.public;
    this.#authKey = args.authKey;
    this.#action = args.handler.action;
    this.#registry = args.handler.registry;
    this.#params = args.params;
    this.#query = args.query;
    this.#payload = args.payload;
  }

  get public(): boolean {
    return this.#public;
  }

  get authKey(): string | undefined {
    return this.#authKey;
  }

  get method(): string {
    return this.#action.method;
  }

  get url(): string {
    return this.#url;
  }

  get contentType(): string | undefined {
    return this.#contentType;
  }

  get state(): State {
    return this.#state;
  }

  get action(): ImplementedAction<State, Spec> {
    return this.#action;
  }

  get registry(): Registry {
    return this.#registry;
  }

  get payload(): ActionPayload<Spec> {
    return this.#payload;
  }

  get params(): ParsedIRIValues {
    return this.#params ?? {};
  }

  get query(): ParsedIRIValues {
    return this.#query ?? {};
  }

}

