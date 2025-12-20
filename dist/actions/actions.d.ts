import { CacheInstanceArgs } from '../cache/types.js';
import type { JSONLDContext, JSONObject, TypeDef } from "../jsonld.js";
import type { Registry } from '../registry.js';
import type { Scope } from "../scopes.js";
import { type ActionMeta } from "./meta.js";
import type { ActionSpec, ContextState } from "./spec.js";
import type { HandleRequestArgs, HandlerFn, HandlerMeta, HandlerObj, HandlerValue, HintArgs, ImplementedAction } from './types.js';
import { ResponseTypes } from './writer.js';
export type DefineArgs<Term extends string = string, Spec extends ActionSpec = ActionSpec> = {
    typeDef?: TypeDef<Term>;
    spec?: Spec;
};
/**
 * A handler definition which can be pulled from a registry, scope or action
 * after an action is defined.
 */
export declare class HandlerDefinition<State extends ContextState = ContextState, Spec extends ActionSpec = ActionSpec> {
    name: string;
    contentType: string;
    handler: HandlerFn | HandlerValue;
    meta: HandlerMeta;
    action: ImplementedAction<State, Spec>;
    cache: ReadonlyArray<CacheInstanceArgs>;
    constructor(name: string, contentType: string, handler: HandlerFn | HandlerValue, meta: HandlerMeta, action: ImplementedAction<State, Spec>, actionMeta: ActionMeta);
    get [Symbol.toStringTag](): string;
}
export interface Handleable<State extends ContextState = ContextState, Spec extends ActionSpec = ActionSpec> {
    /**
     * Defines the final handler for this content type.
     *
     * An action can have multiple handlers defined
     * each for a different set of content types.
     */
    handle(contentType: string | string[], handler: HandlerValue | HandlerFn<State, Spec>): FinalizedAction<State, Spec>;
    handle(args: HandlerObj<State, Spec>): FinalizedAction<State, Spec>;
}
export declare class FinalizedAction<State extends ContextState = ContextState, Spec extends ActionSpec = ActionSpec> implements Handleable<State, Spec>, ImplementedAction<State, Spec> {
    #private;
    constructor(typeDef: TypeDef | undefined, spec: Spec, meta: ActionMeta<State, Spec>, handlerArgs: HandlerObj<State, Spec>);
    static fromHandlers<State extends ContextState = ContextState, Spec extends ActionSpec = ActionSpec>(typeDef: TypeDef | undefined, spec: Spec, meta: ActionMeta<State, Spec>, contextType: string | string[], handler: HandlerValue | HandlerFn<State, Spec>): FinalizedAction<State, Spec>;
    static fromHandlers<State extends ContextState = ContextState, Spec extends ActionSpec = ActionSpec>(typeDef: TypeDef | undefined, spec: Spec, meta: ActionMeta<State, Spec>, handlerArgs: HandlerObj<State, Spec>): FinalizedAction<State, Spec>;
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
    get handlers(): HandlerDefinition<State, Spec>[];
    get contentTypes(): string[];
    get context(): JSONObject;
    url(): string;
    /**
     * Retrives the handler configured for the given content type.
     *
     * @param contentType   The content type.
     */
    handlerFor(contentType: string): HandlerDefinition<State, Spec> | undefined;
    jsonld(): Promise<JSONObject | null>;
    jsonldPartial(): {
        '@type': string;
        '@id': string;
    } | null;
    handle(contentType: string | string[], handler: HandlerFn<State, Spec> | HandlerValue): FinalizedAction<State, Spec>;
    handle(args: HandlerObj<State, Spec>): FinalizedAction<State, Spec>;
    handleRequest(args: HandleRequestArgs): Promise<ResponseTypes>;
    perform(req: Request): Promise<Response>;
}
export interface Applicable<ActionType> {
    use(): ActionType;
}
export declare class DefinedAction<State extends ContextState = ContextState, Term extends string = string, Spec extends ActionSpec = ActionSpec> implements Applicable<DefinedAction<State, Term, Spec>>, Handleable<State, Spec>, ImplementedAction<State, Spec> {
    #private;
    constructor(typeDef: TypeDef | undefined, spec: Spec, meta: ActionMeta<State, Spec>);
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
    get handlers(): HandlerDefinition<State, Spec>[];
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
    cache(args: CacheInstanceArgs): DefinedAction<State, string, Spec>;
    meta(): DefinedAction<State, string, Spec>;
    use(): DefinedAction<State, string, Spec>;
    handle(contentType: string | string[], handler: HandlerValue | HandlerFn<State, Spec>): FinalizedAction<State, Spec>;
    handle(args: HandlerObj<State, Spec>): FinalizedAction<State, Spec>;
    handleRequest(args: HandleRequestArgs): Promise<ResponseTypes>;
    perform(req: Request): Promise<Response>;
}
export declare class Action<State extends ContextState = ContextState> implements Applicable<Action>, Handleable<State>, ImplementedAction<State> {
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
    define<Term extends string = string, Spec extends ActionSpec = ActionSpec>(args: DefineArgs<Term, Spec>): DefinedAction<State, Term, Spec>;
    handle(contentType: string | string[], handler: HandlerValue | HandlerFn<State>): FinalizedAction<State>;
    handle(args: HandlerObj<State>): FinalizedAction<State>;
    handleRequest(args: HandleRequestArgs): Promise<ResponseTypes>;
    perform(req: Request): Promise<Response>;
}
export declare class PreAction<State extends ContextState = ContextState> implements Applicable<Action>, Handleable<State> {
    #private;
    constructor(meta: ActionMeta<State>);
    use(): Action<State>;
    define<Term extends string = string, Spec extends ActionSpec = ActionSpec>(args: DefineArgs<Term, Spec>): DefinedAction<State, Term, Spec>;
    handle(contentType: string | string[], handler: HandlerValue | HandlerFn<State>): FinalizedAction<State>;
    handle(args: HandlerObj<State>): FinalizedAction<State>;
}
export declare class Endpoint<State extends ContextState = ContextState> implements Applicable<Action>, Handleable<State> {
    #private;
    constructor(meta: ActionMeta<State>);
    hint(hints: HintArgs): Endpoint<State>;
    compress(): Endpoint<State>;
    cache(args: CacheInstanceArgs): this;
    etag(): this;
    use(): Action<State>;
    define<Term extends string = string, Spec extends ActionSpec = ActionSpec>(args: DefineArgs<Term, Spec>): DefinedAction<State, Term, Spec>;
    handle(contentType: string | string[], handler: HandlerValue | HandlerFn<State>): FinalizedAction<State>;
    handle(args: HandlerObj<State>): FinalizedAction<State>;
}
export declare class ActionAuth<State extends ContextState = ContextState> {
    #private;
    constructor(meta: ActionMeta<State>);
    public(): Endpoint<State>;
    private(): Endpoint<State>;
}
