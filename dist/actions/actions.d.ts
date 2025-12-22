import type { CacheInstanceArgs } from '../cache/types.ts';
import type { JSONLDContext, JSONObject, TypeDef } from "../jsonld.ts";
import type { Registry } from '../registry.ts';
import type { Scope } from "../scopes.ts";
import { type ActionMeta } from "./meta.ts";
import type { ActionSpec, ContextState } from "./spec.ts";
import type { AuthMiddleware, AuthState, HandleRequestArgs, HandlerFn, HandlerMeta, HandlerObj, HandlerValue, HintArgs, ImplementedAction } from './types.ts';
import { type ResponseTypes } from './writer.ts';
export type DefineArgs<Term extends string = string, Spec extends ActionSpec = ActionSpec> = {
    typeDef?: TypeDef<Term>;
    spec?: Spec;
};
/**
 * A handler definition which can be pulled from a registry, scope or action
 * after an action is defined.
 */
export declare class HandlerDefinition<State extends ContextState = ContextState, Auth extends AuthState = AuthState, Spec extends ActionSpec = ActionSpec> {
    name: string;
    contentType: string;
    handler: HandlerFn | HandlerValue;
    meta: HandlerMeta;
    action: ImplementedAction<State, Auth, Spec>;
    cache: ReadonlyArray<CacheInstanceArgs>;
    constructor(name: string, contentType: string, handler: HandlerFn | HandlerValue, meta: HandlerMeta, action: ImplementedAction<State, Auth, Spec>, actionMeta: ActionMeta);
    get [Symbol.toStringTag](): string;
}
export interface Handleable<State extends ContextState = ContextState, Auth extends AuthState = AuthState, Spec extends ActionSpec = ActionSpec> {
    /**
     * Defines the final handler for this content type.
     *
     * An action can have multiple handlers defined
     * each for a different set of content types.
     */
    handle(contentType: string | string[], handler: HandlerValue | HandlerFn<State, Auth, Spec>): FinalizedAction<State, Auth, Spec>;
    handle(args: HandlerObj<State, Auth, Spec>): FinalizedAction<State, Auth, Spec>;
}
export declare class FinalizedAction<State extends ContextState = ContextState, Auth extends AuthState = AuthState, Spec extends ActionSpec = ActionSpec> implements Handleable<State, Auth, Spec>, ImplementedAction<State, Auth, Spec> {
    #private;
    constructor(typeDef: TypeDef | undefined, spec: Spec, meta: ActionMeta<State, Auth, Spec>, handlerArgs: HandlerObj<State, Auth, Spec>);
    static fromHandlers<State extends ContextState = ContextState, Auth extends AuthState = AuthState, Spec extends ActionSpec = ActionSpec>(typeDef: TypeDef | undefined, spec: Spec, meta: ActionMeta<State, Auth, Spec>, contextType: string | string[], handler: HandlerValue | HandlerFn<State, Auth, Spec>): FinalizedAction<State, Auth, Spec>;
    static fromHandlers<State extends ContextState = ContextState, Auth extends AuthState = AuthState, Spec extends ActionSpec = ActionSpec>(typeDef: TypeDef | undefined, spec: Spec, meta: ActionMeta<State, Auth, Spec>, handlerArgs: HandlerObj<State, Auth, Spec>): FinalizedAction<State, Auth, Spec>;
    static toJSONLD(action: ImplementedAction, scope: Scope): Promise<JSONObject | null>;
    get public(): boolean;
    get method(): string;
    get term(): string | undefined;
    get type(): string | undefined;
    get typeDef(): TypeDef | undefined;
    get name(): string;
    get template(): string;
    get pattern(): URLPattern;
    get spec(): Spec;
    get scope(): Scope | undefined;
    get registry(): Registry;
    get handlers(): HandlerDefinition<State, Auth, Spec>[];
    get contentTypes(): string[];
    get context(): JSONObject;
    url(): string;
    /**
     * Retrives the handler configured for the given content type.
     *
     * @param contentType   The content type.
     */
    handlerFor(contentType: string): HandlerDefinition<State, Auth, Spec> | undefined;
    jsonld(): Promise<JSONObject | null>;
    jsonldPartial(): {
        '@type': string;
        '@id': string;
    } | null;
    handle(contentType: string | string[], handler: HandlerFn<State, Auth, Spec> | HandlerValue): FinalizedAction<State, Auth, Spec>;
    handle(args: HandlerObj<State, Auth, Spec>): FinalizedAction<State, Auth, Spec>;
    handleRequest(args: HandleRequestArgs): Promise<ResponseTypes>;
    perform(req: Request): Promise<Response>;
}
export interface Applicable<ActionType> {
    use(): ActionType;
}
export declare class DefinedAction<State extends ContextState = ContextState, Auth extends AuthState = AuthState, Term extends string = string, Spec extends ActionSpec = ActionSpec> implements Applicable<DefinedAction<State, Auth, Term, Spec>>, Handleable<State, Auth, Spec>, ImplementedAction<State, Auth, Spec> {
    #private;
    constructor(typeDef: TypeDef | undefined, spec: Spec, meta: ActionMeta<State, Auth, Spec>);
    get public(): boolean;
    get method(): string;
    get term(): string | undefined;
    get type(): string | undefined;
    get typeDef(): TypeDef | undefined;
    get name(): string;
    get template(): string;
    get pattern(): URLPattern;
    get path(): string;
    get spec(): Spec;
    get scope(): Scope | undefined;
    get registry(): Registry;
    get handlers(): HandlerDefinition<State, Auth, Spec>[];
    get contentTypes(): string[];
    url(): string;
    /**
     * Retrives the handler configured for the given content type.
     *
     * @param contentType   The content type.
     */
    handlerFor(_contentType: string): undefined;
    get context(): JSONLDContext;
    jsonld(): Promise<JSONObject | null>;
    jsonldPartial(): {
        '@type': string;
        '@id': string;
    } | null;
    /**
     * Defines a cache handling rule for this action.
     *
     * Defining caching rules after the `action.define()` method is safer
     * if validating and transforming the action payload might cause
     * auth sensitive checks to be run which might reject the request.
     */
    cache(args: CacheInstanceArgs): DefinedAction<State, Auth, Term, Spec>;
    meta(): DefinedAction<State, Auth, Term, Spec>;
    use(): DefinedAction<State, Auth, Term, Spec>;
    handle(contentType: string | string[], handler: HandlerValue | HandlerFn<State, Auth, Spec>): FinalizedAction<State, Auth, Spec>;
    handle(args: HandlerObj<State, Auth, Spec>): FinalizedAction<State, Auth, Spec>;
    handleRequest(args: HandleRequestArgs): Promise<ResponseTypes>;
    perform(req: Request): Promise<Response>;
}
export declare class Action<State extends ContextState = ContextState, Auth extends AuthState = AuthState> implements Applicable<Action>, Handleable<State>, ImplementedAction<State> {
    #private;
    constructor(meta: ActionMeta<State>);
    get public(): boolean;
    get method(): string;
    get term(): string | undefined;
    get type(): string | undefined;
    get typeDef(): TypeDef | undefined;
    get name(): string;
    get template(): string;
    get pattern(): URLPattern;
    get path(): string;
    get spec(): ActionSpec;
    get scope(): Scope | undefined;
    get registry(): Registry;
    get handlers(): HandlerDefinition[];
    get contentTypes(): string[];
    get context(): JSONObject;
    url(): string;
    /**
     * Retrives the handler configured for the given content type.
     *
     * @param contentType   The content type.
     */
    handlerFor(_contentType: string): undefined;
    jsonld(): Promise<null>;
    jsonldPartial(): {
        '@type': string;
        '@id': string;
    } | null;
    use(): Action<State>;
    define<Auth extends AuthState = AuthState, Term extends string = string, Spec extends ActionSpec = ActionSpec>(args: DefineArgs<Term, Spec>): DefinedAction<State, Auth, Term, Spec>;
    handle(contentType: string | string[], handler: HandlerValue | HandlerFn<State>): FinalizedAction<State>;
    handle(args: HandlerObj<State>): FinalizedAction<State>;
    handleRequest(args: HandleRequestArgs): Promise<ResponseTypes>;
    perform(req: Request): Promise<Response>;
}
export declare class PreAction<State extends ContextState = ContextState, Auth extends AuthState = AuthState> implements Applicable<Action>, Handleable<State, Auth> {
    #private;
    constructor(meta: ActionMeta<State, Auth>);
    use(): Action<State, AuthState>;
    define<Term extends string = string, Spec extends ActionSpec = ActionSpec>(args: DefineArgs<Term, Spec>): DefinedAction<State, Auth, Term, Spec>;
    handle(contentType: string | string[], handler: HandlerValue | HandlerFn<State, Auth>): FinalizedAction<State, Auth>;
    handle(args: HandlerObj<State>): FinalizedAction<State, Auth>;
}
export declare class Endpoint<State extends ContextState = ContextState, Auth extends AuthState = AuthState> implements Applicable<Action>, Handleable<State, Auth> {
    #private;
    constructor(meta: ActionMeta<State, Auth>);
    hint(hints: HintArgs): Endpoint<State, Auth>;
    compress(): Endpoint<State, Auth>;
    cache(args: CacheInstanceArgs): Endpoint<State, Auth>;
    etag(): this;
    use(): Action<State, Auth>;
    define<Term extends string = string, Spec extends ActionSpec = ActionSpec>(args: DefineArgs<Term, Spec>): DefinedAction<State, Auth, Term, Spec>;
    handle(contentType: string | string[], handler: HandlerValue | HandlerFn<State>): FinalizedAction<State, Auth>;
    handle(args: HandlerObj<State, Auth>): FinalizedAction<State, Auth>;
}
export declare class ActionAuth<State extends ContextState = ContextState> {
    #private;
    constructor(meta: ActionMeta<State>);
    public<Auth extends AuthState = AuthState>(authMiddleware?: AuthMiddleware<Auth>): Endpoint<State, Auth>;
    private<Auth extends AuthState = AuthState>(authMiddleware: AuthMiddleware<Auth>): Endpoint<State, Auth>;
}
