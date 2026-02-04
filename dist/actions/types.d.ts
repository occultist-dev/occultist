import type { ServerResponse } from "node:http";
import type { JSONObject, TypeDef } from "../jsonld.ts";
import type { CacheContext, CacheOperationResult, HandlerDefinition, MiddlewareRefs, Route } from "../mod.ts";
import type { Registry } from '../registry.ts';
import type { Scope } from "../scopes.ts";
import type { Context } from "./context.ts";
import type { ActionSpec, ContextState, NextFn } from "./spec.ts";
import type { HTTPWriter } from "./writer.ts";
export type CacheHitHeader = boolean | string | [header: string, value: string];
export type AuthState = Record<string, unknown>;
/**
 * Middleware that identifies the authenticating agent from the request
 * and confirms they have access to the resource.
 *
 * When successfully authenticated the middleware should return with
 * an array of two values. The first being a key unique to the user, or
 * group, which can access this resource. This key is used for varying
 * private cache so should alway vary on the user if personalized information
 * would be returned in the response.
 *
 * The second response item is optional and should be an object holding identifying
 * information such as permissions or details of the user or group that might be used
 * when forming the response.
 *
 * @param req The request.
 */
export type AuthMiddleware<Auth extends AuthState = AuthState> = (req: Request) => void | Promise<void> | [authKey: string, auth?: Auth] | Promise<[authKey: string, auth?: Auth]>;
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
 * Middleware that is executed before an action's spec defining middleware.
 */
export type PreMiddlewareFn<State extends ContextState = ContextState, Auth extends AuthState = AuthState> = (ctx: CacheContext<State, Auth>, next: NextFn) => void | Promise<void>;
/**
 * Middleware that is executed after an action's spec defining middleware.
 */
export type PostMiddlewareFn<State extends ContextState = ContextState, Auth extends AuthState = AuthState, Spec extends ActionSpec = ActionSpec> = (ctx: Context<State, Auth, Spec>, next: NextFn) => void | Promise<void>;
/**
 * An object of values that can be used to programmatically query actions
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
export type HandlerFn<State extends ContextState = ContextState, Auth extends AuthState = AuthState, Spec extends ActionSpec = ActionSpec> = (ctx: Context<State, Auth, Spec>) => void | Promise<void>;
/**
 * A handler object argument.
 *
 * Occultist extensions can use this handler argument method to provide arguments
 * which are usually defined while defining the action.
 */
export interface HandlerObj<State extends ContextState = ContextState, Auth extends AuthState = AuthState, Spec extends ActionSpec = ActionSpec> {
    contentType: string | string[];
    handler: HandlerFn<State, Auth, Spec> | HandlerValue;
    meta?: HandlerMeta;
    hints?: HintArgs;
}
/**
 * Handler arguments for an action.
 */
export type HandlerArgs<State extends ContextState = ContextState, Auth extends AuthState = AuthState, Spec extends ActionSpec = ActionSpec> = HandlerValue | HandlerFn<State, Auth, Spec> | HandlerObj<State, Auth, Spec>;
export type HandleRequestArgs = {
    contentType?: string;
    language?: string;
    encoding?: string;
    url: string;
    req: Request;
    writer: HTTPWriter;
    startTime?: number;
    cacheHitHeader?: CacheHitHeader;
};
export interface ImplementedAction<State extends ContextState = ContextState, Auth extends AuthState = AuthState, Spec extends ActionSpec = ActionSpec> {
    readonly public: boolean;
    readonly method: string;
    readonly term?: string;
    readonly type?: string;
    readonly typeDef?: TypeDef;
    readonly name?: string;
    readonly route: Route;
    readonly template: string;
    readonly spec: Spec;
    readonly registry: Registry;
    readonly scope?: Scope;
    readonly handlers: HandlerDefinition<State, Auth, Spec>[];
    readonly contentTypes: string[];
    readonly context: JSONObject;
    /**
     * Creates a URL compatible with this action.
     */
    url(): string;
    /**
     * Retrives the handler configured for the given content type.
     *
     * @param contentType   The content type.
     */
    handlerFor(contentType: string): HandlerDefinition<State, Auth, Spec> | undefined;
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
    handleRequest(refs: MiddlewareRefs<State, Auth, Spec>): Promise<Response | ServerResponse>;
    primeCache(refs: MiddlewareRefs<State, Auth, Spec>): Promise<CacheOperationResult>;
    refreshCache(refs: MiddlewareRefs<State, Auth, Spec>): Promise<CacheOperationResult>;
    invalidateCache(refs: MiddlewareRefs<State, Auth, Spec>): Promise<CacheOperationResult>;
}
