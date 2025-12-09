import type { HTTPWriter } from "./writer.js";
import type { Registry } from '../registry.js';
import type { Scope } from "../scopes.js";
import type { ContextState, ActionSpec } from "./spec.js";
import type { Context } from "./context.js";
import type { ServerResponse } from "node:http";
import type { JSONObject, TypeDef } from "../jsonld.js";


export type HandlerMeta = Record<symbol | string, unknown>;

export type HandlerFn<
  State extends ContextState = ContextState,
  Spec extends ActionSpec = ActionSpec,
> = (ctx: Context<State, Spec>) => void | Promise<void>;

export type HandlerText = string;

export interface Handler<
  State extends ContextState = ContextState,
  Spec extends ActionSpec = ActionSpec,
  Action extends ImplementedAction<State, Spec> = ImplementedAction<State, Spec>,
> {
  readonly contentType: string;
  readonly name: string;
  readonly meta: HandlerMeta;
  readonly action: Action;
  readonly registry: Registry;
  readonly handler: HandlerFn<State, Spec> | HandlerText;
}

export type HintLink = {
  href: string;
  rel?: string | string[];
  type?: string;
  as?: string;
  preload?: boolean;
  fetchPriority?: 'high' | 'low' | 'auto';
  crossOrigin?: boolean;
  link?: undefined;
  csp?: undefined;
};

export type HintObj = {
  link: HintLink | HintLink[];
  csp?: string;
  href?: undefined;
  rel?: undefined;
  type?: undefined;
  as?: undefined;
  preload?: undefined;
  fetchPriority?: undefined;
  crossOrigin?: undefined;
};

export type HintFn = () => HintObj | HintLink | HintLink[];

export type HintArgs =
  | HintLink
  | HintLink[]
  | HintObj
  | HintFn
;

export type HandleRequestArgs = {
  startTime: number;
  contentType?: string;
  language?: string;
  encoding?: string;
  url: string;
  req: Request;
  writer: HTTPWriter;
};

export interface ImplementedAction<
  State extends ContextState = ContextState,
  Spec extends ActionSpec = ActionSpec,
> {
  readonly public: boolean;
  readonly method: string;
  readonly term?: string;
  readonly type?: string;
  readonly typeDef?: TypeDef;
  readonly name: string;
  readonly pattern: URLPattern;
  readonly template: string;
  readonly spec: Spec;
  readonly registry: Registry;
  readonly scope?: Scope;
  readonly handlers: Handler<State, Spec>[];
  readonly contentTypes: string[];
  readonly context: JSONObject;

  /**
   * @todo
   *
   * Creates a URL compatible with this action.
   */
  url(): string;

  /**
   * @todo
   * 
   * Returns an object which could be serialized to json
   * representing this action.
   */
  jsonld(): Promise<JSONObject | null>;

  /**
   * Creates a partial objecting containing the `@type` and `@id`
   * properties of this action for JSON-ld serialization.
   */
  jsonldPartial(): { '@type': string, '@id': string } | null;

  /**
   * Handles a request which has resolved to this action.
   */
  handleRequest(args: HandleRequestArgs): Promise<Response | ServerResponse>;
}

