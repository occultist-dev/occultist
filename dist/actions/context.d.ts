import type { CacheOperation, HandlerDefinition, StaticAsset } from "../mod.ts";
import type { Registry } from "../registry.ts";
import type { ActionPayload, ActionSpec, ContextState, ParsedIRIValues } from "./spec.ts";
import type { AuthState, ImplementedAction } from "./types.ts";
import type { ResponseBody } from "./writer.ts";
export type CacheContextArgs<Auth extends AuthState = AuthState> = {
    req: Request;
    contentType: string;
    languageCode: string | undefined;
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
    contentType?: string;
    languageCode?: string;
    public: boolean;
    authKey: string | null;
    auth: Auth;
    cacheRun: boolean;
    cacheOperation: CacheOperation | null;
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
    languageCode: string | undefined;
    public: boolean;
    authKey?: string;
    auth: Auth;
    cacheOperation: CacheOperation | null;
    handler: HandlerDefinition<State, Auth, Spec>;
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
    languageCode?: string;
    public: boolean;
    authKey?: string;
    auth: Auth;
    cacheRun: boolean;
    cacheOperation: CacheOperation | null;
    state: State;
    action: ImplementedAction<State, Auth, Spec>;
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
    /**
     * Returns the public facing URL of a static asset using its
     * static file alias.
     *
     * @param assetAlias The alias of the static asset.
     * @param cspDirective A directive to add the asset to when generating CSP headers.
     * @returns The public facing URL of the static asset.
     */
    useAsset(assetAlias: string, cspDirective?: string): StaticAsset | undefined;
    get [Symbol.toStringTag](): string;
}
