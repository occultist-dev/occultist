import type { HTTPWriter } from "./writer.js";
import type { Registry } from '../registry.js';
import type { Scope } from "../scopes.js";
import type { ContextState, ActionSpec } from "./spec.js";
import type { Context } from "./context.js";
import type { ServerResponse } from "node:http";
import type { JSONObject, TypeDef } from "../jsonld.js";
import type { HandlerDefinition } from "../mod.js";
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
export type HintArgs = HintLink | HintLink[] | HintObj | HintFn;
/**
 * An object of values that can be used to programically query actions
 * by metadata defined on the action.
 */
export type HandlerMeta = Record<symbol | string, unknown>;
/**
 * A fixed value that an endpoint will always return.
 */
export type HandlerValue = Exclude<BodyInit, ReadableStream>;
/**
 * An action handler function that is passed a context object.
 * Responses should be set on the context object.
 */
export type HandlerFn<State extends ContextState = ContextState, Spec extends ActionSpec = ActionSpec> = (ctx: Context<State, Spec>) => void | Promise<void>;
/**
 * A handler object argument.
 *
 * Occultist extensions can use this handler argument method to provide arguments
 * which are usually defined while defining the action.
 */
export interface HandlerObj<State extends ContextState = ContextState, Spec extends ActionSpec = ActionSpec> {
    contentType: string | string[];
    handler: HandlerFn<State, Spec> | HandlerValue;
    meta?: HandlerMeta;
    hints?: HintArgs;
}
/**
 * Handler arguments for an action.
 */
export type HandlerArgs<State extends ContextState = ContextState, Spec extends ActionSpec = ActionSpec> = HandlerValue | HandlerFn<State, Spec> | HandlerObj<State, Spec>;
export type HandleRequestArgs = {
    startTime: number;
    contentType?: string;
    language?: string;
    encoding?: string;
    url: string;
    req: Request;
    writer: HTTPWriter;
};
export interface ImplementedAction<State extends ContextState = ContextState, Spec extends ActionSpec = ActionSpec> {
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
    readonly handlers: HandlerDefinition<State, Spec>[];
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
    jsonldPartial(): {
        '@type': string;
        '@id': string;
    } | null;
    /**
     * Handles a request which has resolved to this action.
     */
    handleRequest(args: HandleRequestArgs): Promise<Response | ServerResponse>;
}
