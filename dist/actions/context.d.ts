import type { HandlerDefinition } from "../mod.js";
import type { Registry } from "../registry.js";
import type { ActionPayload, ActionSpec, ContextState, ParsedIRIValues } from "./spec.js";
import type { ImplementedAction } from "./types.js";
import type { ResponseBody } from "./writer.js";
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
export declare class CacheContext {
    #private;
    req: Request;
    method: string;
    url: string;
    contentType: string;
    public: boolean;
    authKey?: string;
    action: ImplementedAction;
    registry: Registry;
    params: ParsedIRIValues;
    query: ParsedIRIValues;
    headers: Headers;
    constructor(args: CacheContextArgs);
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
export type ContextArgs<State extends ContextState = ContextState, Spec extends ActionSpec = ActionSpec> = {
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
export declare class Context<State extends ContextState = ContextState, Spec extends ActionSpec = ActionSpec> {
    #private;
    req: Request;
    method: string;
    url: string;
    contentType: string;
    public: boolean;
    authKey?: string;
    state: State;
    action: ImplementedAction<State, Spec>;
    registry: Registry;
    params: ParsedIRIValues;
    query: ParsedIRIValues;
    payload: ActionPayload<Spec>;
    headers: Headers;
    constructor(args: ContextArgs<State, Spec>);
    get status(): undefined | number;
    set status(status: number);
    get body(): undefined | ResponseBody;
    set body(body: ResponseBody);
    get [Symbol.toStringTag](): string;
}
