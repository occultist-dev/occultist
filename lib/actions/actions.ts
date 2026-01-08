import type {CacheInstanceArgs, CacheOperationResult} from '../cache/types.ts';
import type {JSONLDContext, JSONObject, TypeDef} from "../jsonld.ts";
import type {Registry} from '../registry.ts';
import type {Scope} from "../scopes.ts";
import {getActionContext} from "../utils/getActionContext.ts";
import {getPropertyValueSpecifications} from "../utils/getPropertyValueSpecifications.ts";
import {isPopulatedObject} from '../utils/isPopulatedObject.ts';
import {joinPaths} from "../utils/joinPaths.ts";
import {AfterDefinition, BeforeDefinition, MiddlewareRefs, type ActionCore} from "./core.ts";
import {Route} from './route.ts';
import type {ActionSpec, ContextState} from "./spec.ts";
import type {AuthMiddleware, AuthState, HandlerFn, HandlerMeta, HandlerObj, HandlerValue, HintArgs, ImplementedAction} from './types.ts';
import {type ResponseTypes} from './writer.ts';


export type DefineArgs<
  Term extends string = string,
  Spec extends ActionSpec = ActionSpec,
> = {
  typeDef?: TypeDef<Term>
  spec?: Spec;
};


function isHandlerObj<
  State extends ContextState = ContextState,
  Auth extends AuthState = AuthState,
  Spec extends ActionSpec = ActionSpec
>(handler: unknown): handler is HandlerObj<State, Auth, Spec> {
  return isPopulatedObject(handler);
}

/**
 * A handler definition which can be pulled from a registry, scope or action
 * after an action is defined.
 */
export class HandlerDefinition<
  State extends ContextState = ContextState,
  Auth extends AuthState = AuthState,
  Spec extends ActionSpec = ActionSpec,
> {
  name?: string;
  contentType: string;
  handler: HandlerFn | HandlerValue;
  meta: HandlerMeta;
  action: ImplementedAction<State, Auth, Spec>;
  cache: ReadonlyArray<CacheInstanceArgs>;
  
  constructor(
    name: string | undefined,
    contentType: string,
    handler: HandlerFn | HandlerValue,
    meta: HandlerMeta,
    action: ImplementedAction<State, Auth, Spec>,
    actionMeta: ActionCore,
  ) {
    this.name = name;
    this.contentType = contentType;
    this.handler = handler;
    this.action = action;
    this.meta = Object.freeze({ ...meta ?? {} });
    
    const cache: CacheInstanceArgs[] = [];

    for (let i = 0; i < actionMeta.cache.length; i++) {
      cache.push(Object.freeze({ ...actionMeta.cache[i] }));
    }

    this.cache = Object.freeze(cache);

    Object.freeze(this);
  }

  get [Symbol.toStringTag]() {
    return `name=${this.name ?? 'anon'} contentType=${this.contentType}`;
  }
}

export interface Handleable<
  State extends ContextState = ContextState,
  Auth extends AuthState = AuthState,
  Spec extends ActionSpec = ActionSpec,
> {
  
  /**
   * Defines the final handler for this content type.
   *
   * An action can have multiple handlers defined
   * each for a different set of content types.
   */
  handle(
    contentType: string | string[],
    handler: HandlerValue | HandlerFn<State, Auth, Spec>,
  ): FinalizedAction<State, Auth, Spec>;

  handle(
    args: HandlerObj<State, Auth, Spec>,
  ): FinalizedAction<State, Auth, Spec>;
}

export class FinalizedAction<
  State extends ContextState = ContextState,
  Auth extends AuthState = AuthState,
  Spec extends ActionSpec = ActionSpec,
> implements
  Handleable<State, Auth, Spec>,
  ImplementedAction<State, Auth, Spec>
{
  #spec: Spec;
  #core: ActionCore<State, Auth, Spec>;
  #typeDef?: TypeDef;
  #handlers: Map<string, HandlerDefinition<State, Auth, Spec>>;

  constructor(
    typeDef: TypeDef | undefined,
    spec: Spec,
    core: ActionCore<State, Auth, Spec>,
    handlerArgs: HandlerObj<State, Auth, Spec>,
  ) {
    this.#typeDef = typeDef;
    this.#spec = spec ?? {} as Spec;
    this.#core = core;
    this.#core.action = this as unknown as ImplementedAction<State, Auth, Spec>;

    const handlers: Map<string, HandlerDefinition<State, Auth, Spec>> = new Map();

    if (typeof handlerArgs.contentType === 'string') {
      handlers.set(handlerArgs.contentType, new HandlerDefinition(
        this.name,
        handlerArgs.contentType,
        handlerArgs.handler,
        handlerArgs.meta,
        this as unknown as ImplementedAction<State, Auth, Spec>,
        this.#core,
      ));
    } else if (isPopulatedObject(handlerArgs)) {
      for (let i = 0; i < handlerArgs.contentType.length; i++) {
        handlers.set(handlerArgs.contentType[i], new HandlerDefinition(
          this.name,
          handlerArgs.contentType[i],
          handlerArgs.handler,
          handlerArgs.meta,
          this as unknown as ImplementedAction<State, Auth, Spec>,
          this.#core,
        ));
      }
    }

    this.#handlers = handlers;
  }

  static fromHandlers<
    State extends ContextState = ContextState,
    Auth extends AuthState = AuthState,
    Spec extends ActionSpec = ActionSpec,
  >(
    typeDef: TypeDef | undefined,
    spec: Spec,
    core: ActionCore<State, Auth, Spec>,
    contextType: string | string[],
    handler: HandlerValue | HandlerFn<State, Auth, Spec>,
  ): FinalizedAction<State, Auth, Spec>;

  static fromHandlers<
    State extends ContextState = ContextState,
    Auth extends AuthState = AuthState,
    Spec extends ActionSpec = ActionSpec,
  >(
    typeDef: TypeDef | undefined,
    spec: Spec,
    core: ActionCore<State, Auth, Spec>,
    handlerArgs: HandlerObj<State, Auth, Spec>,
  ): FinalizedAction<State, Auth, Spec>;

  static fromHandlers<
    State extends ContextState = ContextState,
    Auth extends AuthState = AuthState,
    Spec extends ActionSpec = ActionSpec,
  >(
    typeDef: TypeDef | undefined,
    spec: Spec,
    core: ActionCore<State, Auth, Spec>,
    arg3: string | string[] | HandlerObj<State, Auth, Spec>,
    arg4?: HandlerValue | HandlerFn<State, Auth, Spec>,
  ): FinalizedAction<State, Auth, Spec> {
    if (Array.isArray(arg3) || typeof arg3 === 'string') {
      return new FinalizedAction<State, Auth, Spec>(typeDef, spec, core, {
        contentType: arg3,
        handler: arg4,
      });
    }

    return new FinalizedAction(typeDef, spec, core, arg3);
  }

  static async toJSONLD(
    action: ImplementedAction,
    scope: Scope,
  ): Promise<JSONObject | null> {
    if (scope == null || action.typeDef == null || action.name == null) {
      return null;
    }

    const apiSpec = await getPropertyValueSpecifications(action.spec);

    return {
      '@context': action.context,
      '@id': joinPaths(action.registry.rootIRI, scope.path, action.name),
      '@type': action.term,
      target: {
        '@type': 'https://schema.org/EntryPoint',
        httpMethod: action.method,
        urlTemplate: action.template,
        contentType: 'application/ld+json',
      },
      ...apiSpec,
    };
  }

  get public(): boolean {
    return this.#core.public;
  }

  get method(): string {
    return this.#core.method;
  }
  
  get term(): string | undefined {
    return this.#typeDef?.term;
  }

  get type(): string | undefined {
    return this.#typeDef?.type;
  }

  get typeDef(): TypeDef | undefined {
    return this.#typeDef;
  }

  get name(): string | undefined {
    return this.#core.name;
  }

  get template(): string {
    return this.#core.uriTemplate;
  }

  get route(): Route {
    return this.#core.route;
  }

  get spec(): Spec {
    return this.#spec;
  }

  get scope(): Scope | undefined {
    return this.#core.scope
  }

  get registry(): Registry {
    return this.#core.registry;
  }
  
  get handlers(): HandlerDefinition<State, Auth, Spec>[] {
    return Array.from(this.#handlers.values());
  }

  get contentTypes(): string[] {
    return Array.from(this.#handlers.keys());
  }

  get context(): JSONObject {
    return getActionContext({
      spec: this.#spec,
      //vocab: this.#vocab,
      //aliases: this.#aliases,
    });
  }
 
  url(): string {
    return joinPaths(this.#core.registry.rootIRI, this.#core.route.normalized);
  }

  /**
   * Retrives the handler configured for the given content type.
   *
   * @param contentType   The content type.
   */
  handlerFor(contentType: string): HandlerDefinition<State, Auth, Spec> | undefined {
    return this.#handlers.get(contentType);
  }

  jsonld(): Promise<JSONObject | null> {
    const scope = this.#core.scope;

    return FinalizedAction.toJSONLD(
      this as unknown as ImplementedAction,
      scope
    );
  }

  jsonldPartial(): { '@type': string, '@id': string } | null {
    const scope = this.#core.scope;
    const typeDef = this.#typeDef;

    if (scope == null || typeDef == null) {
      return null;
    }
    
    return {
      '@type': typeDef.type,
      '@id': joinPaths(scope.url(), this.#core.name),
    };
  }

  handle(
    contentType: string | string[],
    handler: HandlerFn<State, Auth, Spec> | HandlerValue,
  ): FinalizedAction<State, Auth, Spec>;

  handle(
    args: HandlerObj<State, Auth, Spec>,
  ): FinalizedAction<State, Auth, Spec>;
  
  handle(
    arg1: string | string[] | HandlerObj<State, Auth, Spec>,
    arg2?: HandlerFn<State, Auth, Spec>,
  ): FinalizedAction<State, Auth, Spec> {
    let contentType: string | string[];
    let handler: HandlerFn<State, Auth, Spec> | HandlerValue;
    let meta: HandlerMeta;

    if (isHandlerObj(arg1)) {
      contentType = arg1.contentType;
      handler = arg1.handler;
      meta = Object.assign(Object.create(null), arg1.meta);

      if (arg1.meta != null) {
        for (const sym of Object.getOwnPropertySymbols(arg1.meta)) {
          meta[sym] = arg1.meta[sym];
        }
      }
    } else {
      contentType = arg1;
      handler = arg2;
      meta = Object.create(null);
    }

    if (!Array.isArray(contentType)) {
      this.#handlers.set(contentType, new HandlerDefinition(
        this.#core.name,
        contentType,
        handler,
        meta,
        this as unknown as ImplementedAction<State, Auth, Spec>,
        this.#core,
      ));
    } else {
      for (let i = 0; i < contentType.length; i++) {
        this.#handlers.set(contentType[i], new HandlerDefinition(
          this.#core.name,
          contentType[i],
          handler,
          meta,
          this as unknown as ImplementedAction<State, Auth, Spec>,
          this.#core,
        ));
      }
    }

    return this;
  }

  handleRequest(
    refs: MiddlewareRefs<State, Auth, Spec>,
  ): Promise<ResponseTypes> {
    const handler = this.#handlers.get(refs.contentType as string);

    refs.spec = this.#spec;
    refs.handler = handler;

    return this.#core.handleRequest(refs);
  }

  primeCache(
    refs: MiddlewareRefs<State, Auth, Spec>,
  ): Promise<CacheOperationResult> {
    const handler = this.#handlers.get(refs.contentType as string);

    refs.spec = this.#spec;
    refs.handler = handler;

    return this.#core.primeCache(refs);
  }

  refreshCache(
    refs: MiddlewareRefs<State, Auth, Spec>,
  ): Promise<CacheOperationResult> {
    const handler = this.#handlers.get(refs.contentType as string);

    refs.spec = this.#spec;
    refs.handler = handler;

    return this.#core.refreshCache(refs);
  }

  invalidateCache(
    refs: MiddlewareRefs<State, Auth, Spec>,
  ): Promise<CacheOperationResult> {
    const handler = this.#handlers.get(refs.contentType as string);

    refs.spec = this.#spec;
    refs.handler = handler;

    return this.#core.invalidateCache(refs);
  }

}

export interface Applicable<ActionType> {
  use(): ActionType;
}

export class DefinedAction<
  State extends ContextState = ContextState,
  Auth extends AuthState = AuthState,
  Term extends string = string,
  Spec extends ActionSpec = ActionSpec,
> implements
  Applicable<DefinedAction<State, Auth, Term, Spec>>,
  Handleable<State, Auth, Spec>,
  ImplementedAction<State, Auth, Spec>
{
  #spec: Spec;
  #core: ActionCore<State, Auth, Spec>;
  #typeDef?: TypeDef;

  constructor(
    typeDef: TypeDef | undefined,
    spec: Spec,
    core: ActionCore<State, Auth, Spec>,
  ) {
    this.#spec = spec ?? {} as Spec;
    this.#core = core;
    this.#typeDef = typeDef;

    this.#core.action = this as unknown as ImplementedAction<State, Auth, Spec>;
  }

  get public(): boolean {
    return this.#core.public;
  }

  get method(): string {
    return this.#core.method;
  }
  
  get term(): string | undefined {
    return this.#typeDef?.term;
  }

  get type(): string | undefined {
    return this.#typeDef?.type;
  }

  get typeDef(): TypeDef | undefined {
    return this.#typeDef;
  }

  get name(): string | undefined {
    return this.#core.name;
  }

  get template(): string {
    return this.#core.uriTemplate;
  }

  get route(): Route {
    return this.#core.route;
  }

  get path(): string {
    return this.#core.route.normalized;
  }

  get spec(): Spec {
    return this.#spec;
  }

  get scope(): Scope | undefined {
    return this.#core.scope;
  }

  get registry(): Registry {
    return this.#core.registry;
  }

  get handlers(): HandlerDefinition<State, Auth, Spec>[] {
    return [];
  }

  get contentTypes(): string[] {
    return [];
  }
 
  url(): string {
    return '';
  }

  /**
   * Retrives the handler configured for the given content type.
   *
   * @param contentType   The content type.
   */
  handlerFor(_contentType: string): undefined {}

  get context(): JSONLDContext {
    return getActionContext({
      spec: this.#spec,
      // vocab: this.#vocab,
      // aliases: this.#aliases,
    });
  }

  jsonld(): Promise<JSONObject | null> {
    const scope = this.#core.scope;

    return FinalizedAction.toJSONLD(
      this as unknown as ImplementedAction,
      scope
    );
  }

  jsonldPartial(): { '@type': string, '@id': string } | null {
    const scope = this.#core.scope;
    const typeDef = this.#typeDef;

    if (scope == null || typeDef == null) {
      return null;
    }
    
    return {
      '@type': typeDef.type,
      '@id': joinPaths(scope.url(), this.#core.name),
    };
  }

  /**
   * Defines a cache handling rule for this action.
   *
   * Defining caching rules after the `action.define()` method is safer
   * if validating and transforming the action payload might cause
   * auth sensitive checks to be run which might reject the request.
   */
  cache(args: CacheInstanceArgs): DefinedAction<State, Auth, Term, Spec> {
    if (this.#core.cache.length !== 0 &&
        this.#core.cacheOccurance === BeforeDefinition) {
      throw new Error(
        'Action cache may be defined either before or after ' +
        'the definition method is called, but not both.');
    } else if (this.#core.cacheOccurance === BeforeDefinition) {
      this.#core.cacheOccurance = AfterDefinition;
    }

    this.#core.cache.push(args);

    return this;
  }
  
  meta(): DefinedAction<State, Auth, Term, Spec> {
    return this;
  }

  use(): DefinedAction<State, Auth, Term, Spec> {
    return this;
  }
  
  handle(contentType: string | string[], handler: HandlerValue | HandlerFn<State, Auth, Spec>): FinalizedAction<State, Auth, Spec>;
  handle(args: HandlerObj<State, Auth, Spec>): FinalizedAction<State, Auth, Spec>;
  handle(arg1: unknown, arg2?: unknown): FinalizedAction<State, Auth, Spec> {
    return FinalizedAction.fromHandlers(
      this.#typeDef,
      this.#spec,
      this.#core,
      arg1 as string | string[],
      arg2 as HandlerFn<State, Auth, Spec>,
    );
  }

  handleRequest(
    refs: MiddlewareRefs<State, Auth, Spec>,
  ): Promise<ResponseTypes> {
    refs.spec = this.#spec;

    return this.#core.handleRequest(refs);
  }

  primeCache(
    refs: MiddlewareRefs<State, Auth, Spec>,
  ): Promise<CacheOperationResult> {
    refs.spec = this.#spec;

    return this.#core.primeCache(refs);
  }

  refreshCache(
    refs: MiddlewareRefs<State, Auth, Spec>,
  ): Promise<CacheOperationResult> {
    refs.spec = this.#spec;

    return this.#core.refreshCache(refs);
  }

  invalidateCache(
    refs: MiddlewareRefs<State, Auth, Spec>,
  ): Promise<CacheOperationResult> {
    refs.spec = this.#spec;

    return this.#core.invalidateCache(refs);
  }
}

export class Action<
  State extends ContextState = ContextState,
  Auth extends AuthState = AuthState,
> implements
  Applicable<Action>,
  Handleable<State>,
  ImplementedAction<State>
{
  #spec: ActionSpec = {};
  #core: ActionCore<State>;

  constructor(
    core: ActionCore<State>,
  ) {
    this.#core = core;
    this.#core.action = this as ImplementedAction<State, {}>;
  }

  get public(): boolean {
    return this.#core.public;
  }

  get method(): string {
    return this.#core.method;
  }
  
  get term(): string | undefined {
    return undefined;
  }

  get type(): string | undefined {
    return undefined;
  }

  get typeDef(): TypeDef | undefined {
    return undefined;
  }

  get name(): string | undefined {
    return this.#core.name;
  }

  get template(): string {
    return this.#core.uriTemplate;
  }

  get route(): Route {
    return this.#core.route;
  }

  get path(): string {
    return this.#core.route.normalized;
  }

  get spec(): ActionSpec {
    return this.#spec;
  }

  get scope(): Scope | undefined {
    return this.#core.scope;
  }

  get registry(): Registry {
    return this.#core.registry;
  }
  
  get handlers(): HandlerDefinition[] {
    return [];
  }

  get contentTypes(): string[] {
    return [];
  }

  get context(): JSONObject {
    return getActionContext({
      spec: this.#spec,
      //vocab: this.#vocab,
      //aliases: this.#aliases,
    });
  }

  url(): string {
    return '';
  }

  /**
   * Retrives the handler configured for the given content type.
   *
   * @param contentType   The content type.
   */
  handlerFor(_contentType: string): undefined {}

  jsonld(): Promise<null> {
    return Promise.resolve(null);
  }

  jsonldPartial(): { '@type': string, '@id': string } | null {
    return null;
  }

  use(): Action<State> {
    return this;
  }

  define<
    Auth extends AuthState = AuthState,
    Term extends string = string,
    Spec extends ActionSpec = ActionSpec,
  >(args: DefineArgs<Term, Spec>): DefinedAction<State, Auth, Term, Spec> {
    return new DefinedAction<State, Auth, Term, Spec>(
      args.typeDef,
      args.spec ?? {} as Spec,
      this.#core as unknown as ActionCore<State, Auth, Spec>,
    );
  }
  
  handle(contentType: string | string[], handler: HandlerValue | HandlerFn<State>): FinalizedAction<State>;
  handle(args: HandlerObj<State>): FinalizedAction<State>;
  handle(arg1: unknown, arg2?: unknown): FinalizedAction<State> {
    return FinalizedAction.fromHandlers(
      null,
      this.#spec,
      this.#core,
      arg1 as string | string[],
      arg2 as HandlerFn<State>,
    );
  }

  handleRequest(
    refs: MiddlewareRefs<State, Auth, ActionSpec>,
  ): Promise<ResponseTypes> {
    refs.spec = this.#spec;

    return this.#core.handleRequest(refs);
  }

  primeCache(
    refs: MiddlewareRefs<State, Auth, ActionSpec>,
  ): Promise<CacheOperationResult> {
    refs.spec = this.#spec;

    return this.#core.primeCache(refs);
  }

  refreshCache(
    refs: MiddlewareRefs<State, Auth, ActionSpec>,
  ): Promise<CacheOperationResult> {
    refs.spec = this.#spec;

    return this.#core.refreshCache(refs);
  }

  invalidateCache(
    refs: MiddlewareRefs<State, Auth, ActionSpec>,
  ): Promise<CacheOperationResult> {
    refs.spec = this.#spec;

    return this.#core.refreshCache(refs);
  }
}

export class PreAction<
  State extends ContextState = ContextState,
  Auth extends AuthState = AuthState,
> implements
  Applicable<Action>,
  Handleable<State, Auth>
{
  #core: ActionCore<State, Auth>;

  constructor(
    core: ActionCore<State, Auth>,
  ) {
    this.#core = core;
  }

  use() {
    return new Action(
      this.#core,
    );
  }

  define<
    Term extends string = string,
    Spec extends ActionSpec = ActionSpec,
  >(args: DefineArgs<Term, Spec>): DefinedAction<State, Auth, Term, Spec> {
    return new DefinedAction<State, Auth, Term, Spec>(
      args.typeDef,
      args.spec,
      this.#core as unknown as ActionCore<State, Auth, Spec>,
    );
  }
  
  handle(contentType: string | string[], handler: HandlerValue | HandlerFn<State, Auth>): FinalizedAction<State, Auth>;
  handle(args: HandlerObj<State>): FinalizedAction<State, Auth>;
  handle(arg1: unknown, arg2?: unknown): FinalizedAction<State, Auth> {
    return FinalizedAction.fromHandlers<State, Auth>(
      null,
      {},
      this.#core,
      arg1 as string | string[],
      arg2 as HandlerFn<State>,
    );
  }
}

export class Endpoint<
  State extends ContextState = ContextState,
  Auth extends AuthState = AuthState,
> implements
  Applicable<Action>,
  Handleable<State, Auth>
{
  #core: ActionCore<State, Auth>;

  constructor(
    core: ActionCore<State, Auth>,
  ) {
    this.#core = core;
  }
  
  hint(hints: HintArgs): Endpoint<State, Auth> {
    this.#core.hints.push(hints);

    return this;
  }

  compress(): Endpoint<State, Auth> {
    return this;
  }
  
  cache(args: CacheInstanceArgs): Endpoint<State, Auth> {
    this.#core.cache.push(args);

    return this;
  }

  etag() {
    return this;
  }

  use(): Action<State, Auth> {
    return new Action<State, Auth>(this.#core);
  }

  define<
    Term extends string = string,
    Spec extends ActionSpec = ActionSpec,
  >(args: DefineArgs<Term, Spec>): DefinedAction<State, Auth, Term, Spec> {
    return new DefinedAction<State, Auth, Term, Spec>(
      args.typeDef,
      args.spec,
      this.#core as ActionCore<State, Auth, Spec>,
    );
  }

  handle(contentType: string | string[], handler: HandlerValue | HandlerFn<State>): FinalizedAction<State, Auth>;
  handle(args: HandlerObj<State, Auth>): FinalizedAction<State, Auth>;
  handle(arg1: unknown, arg2?: unknown): FinalizedAction<State, Auth> {
    return FinalizedAction.fromHandlers(
      undefined,
      {},
      this.#core,
      arg1 as string | string[],
      arg2 as HandlerFn<State, Auth>,
    );
  }
}

export class ActionAuth<
  State extends ContextState = ContextState,
> {
  #core: ActionCore<State>;

  constructor(core: ActionCore<State>) {
    this.#core = core;
  }

  public<
    Auth extends AuthState = AuthState,
  >(authMiddleware?: AuthMiddleware<Auth>): Endpoint<State, Auth> {
    if (authMiddleware != null && typeof authMiddleware !== 'function')
      throw new Error('Public action given invalid auth middleware');

    this.#core.public = true;
    this.#core.auth = authMiddleware;

    return new Endpoint(this.#core as ActionCore<State, Auth>);
  }

  private<
    Auth extends AuthState = AuthState,
  >(authMiddleware: AuthMiddleware<Auth>): Endpoint<State, Auth> {
    if (typeof authMiddleware !== 'function')
      throw new Error('Private action given invalid auth middleware');

    this.#core.auth = authMiddleware;

    return new Endpoint(this.#core as ActionCore<State, Auth>);
  }
}

