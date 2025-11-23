import type { HTTPWriter } from "./writer.ts";
import type { Registry } from '../registry.ts';
import type { Scope } from "../scopes.ts";
import type { ContextState, ActionSpec } from "./spec.ts";
import type { Context } from "./context.ts";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { JSONObject, TypeDef } from "../jsonld.ts";


export type HandlerMeta = Record<symbol | string, unknown>;

export type HandlerFn<
  State extends ContextState = ContextState,
  Spec extends ActionSpec = ActionSpec,
> = (ctx: Context<State, Spec>) => void;

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
};

export type HintArgs = {
  link: HintLink | HintLink[];
  csp?: string;
};

export type HandleFetchRequestArgs = {
  type: 'request';
  contentType?: string;
  language?: string;
  encoding?: string;
  url: URL;
  req: Request;
  writer: HTTPWriter;
};

export type HandleNodeHTTPRequestArgs = {
  type: 'node-http';
  contentType?: string;
  language?: string;
  encoding?: string;
  url: URL;
  req: IncomingMessage;
  res: ServerResponse;
  writer: HTTPWriter;
};

export type HandleRequestArgs =
  | HandleFetchRequestArgs
  | HandleNodeHTTPRequestArgs
;

export interface ImplementedAction<
  State extends ContextState = ContextState,
  Spec extends ActionSpec = ActionSpec,
> {
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

