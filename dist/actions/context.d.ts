import type { CacheOperation, HandlerDefinition } from "../mod.ts";
import type { Registry } from "../registry.ts";
import type { ActionPayload, ActionSpec, ContextState, ParsedIRIValues } from "./spec.ts";
import type { AuthState, ImplementedAction } from "./types.ts";
import type { ResponseBody } from "./writer.ts";
export type CacheContextArgs<Auth extends AuthState = AuthState> = {
    req: Request;
    contentType: string;
    public: boolean;
    authKey?: string;
    auth: Auth;
    cacheOperation?: CacheOperation;
    handler: HandlerDefinition;
    params: ParsedIRIValues;
    query: ParsedIRIValues;
    headers: Headers;
};
/**
 * Request context object.
 */
export declare class CacheContext<Auth extends AuthState = AuthState> {
    #private;
    req: Request;
    method: string;
    url: string;
    contentType: string;
    public: boolean;
    authKey?: string;
    auth: Auth;
    cacheOperation?: CacheOperation;
    action: ImplementedAction;
    registry: Registry;
    params: ParsedIRIValues;
    query: ParsedIRIValues;
    headers: Headers;
    constructor(args: CacheContextArgs<Auth>);
    get hit(): boolean;
    set hit(hit: boolean);
    get status(): undefined | number;
    set status(status: number);
    get body(): undefined | ResponseBody;
    set body(body: ResponseBody);
    get etag(): undefined | string;
    set etag(etag: string);
    get [Symbol.toStringTag](): string;
}
export type ContextArgs<State extends ContextState = ContextState, Auth extends AuthState = AuthState, Spec extends ActionSpec = ActionSpec> = {
    req: Request;
    contentType: string;
    public: boolean;
    authKey?: string;
    auth: Auth;
    handler: HandlerDefinition<State, Spec>;
    params: ParsedIRIValues;
    query: ParsedIRIValues;
    payload: ActionPayload<Spec>;
    headers: Headers;
};
/**
 * Request context object.
 */
export declare class Context<State extends ContextState = ContextState, Auth extends AuthState = AuthState, Spec extends ActionSpec = ActionSpec> {
    #private;
    req: Request;
    method: string;
    url: string;
    contentType: string;
    public: boolean;
    authKey?: string;
    auth: Auth;
    state: State;
    action: ImplementedAction<State, Spec>;
    registry: Registry;
    params: ParsedIRIValues;
    query: ParsedIRIValues;
    payload: ActionPayload<Spec>;
    headers: Headers;
    constructor(args: ContextArgs<State, Auth, Spec>);
    get status(): undefined | number;
    set status(status: number);
    get body(): undefined | ResponseBody;
    set body(body: ResponseBody);
    get [Symbol.toStringTag](): string;
}
