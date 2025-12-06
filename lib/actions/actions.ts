import type { Handler, HandleRequestArgs, HandlerFn, HandlerMeta, HandlerText, HintArgs, ImplementedAction } from './types.js';
import type { Registry } from '../registry.js';
import type { Scope } from "../scopes.js";
import type { CacheArgs } from '../cache/cache.js';
import type { ContextState, ActionSpec } from "./spec.js";
import type { ActionMeta } from "./meta.js";
import { Context } from './context.js';
import { processAction } from "../processAction.js";
import type { JSONLDContext, JSONObject, TypeDef } from "../jsonld.js";
import { joinPaths } from "../utils/joinPaths.js";
import { getPropertyValueSpecifications } from "../utils/getPropertyValueSpecifications.js";
import { getActionContext } from "../utils/getActionContext.js";
import {IncomingMessage, ServerResponse} from 'node:http';
import {ResponseTypes} from './writer.js';

export type DefineArgs<
  Term extends string = string,
  Spec extends ActionSpec = ActionSpec,
> = {
  typeDef?: TypeDef<Term>
  spec: Spec;
};

export type HandlerArgs<
  State extends ContextState = ContextState,
  Spec extends ActionSpec = ActionSpec,
> = {
  contentType: string | string[];
  handler: HandlerFn<State, Spec> | HandlerText;
  meta?: Record<symbol | string, unknown>;
};

export type Hints =
  | HintArgs
  | ((args: HintArgs) => void)
;

export interface Handleable<
  State extends ContextState = ContextState,
  Spec extends ActionSpec = ActionSpec,
> {
  handle(
    contentType: string | string[],
    handler: HandlerFn<State, Spec> | HandlerText,
  ): FinalizedAction<State, Spec>;

  handle(
    args: HandlerArgs<State, Spec>,
  ): FinalizedAction<State, Spec>;
}

export class FinalizedAction<
  State extends ContextState = ContextState,
  Spec extends ActionSpec = ActionSpec,
> implements
  Handleable<State, Spec>,
  ImplementedAction<State, Spec>
{
  #spec: Spec;
  #meta: ActionMeta<State, Spec>;
  #typeDef?: TypeDef;
  #handlers: Map<string, Handler<State, Spec, ImplementedAction<State, Spec>>>;

  constructor(
    typeDef: TypeDef | undefined,
    spec: Spec,
    meta: ActionMeta<State, Spec>,
    handlerArgs: HandlerArgs<State, Spec>,
  ) {
    this.#typeDef = typeDef;
    this.#spec = spec;
    this.#meta = meta;

    this.#meta.action = this as unknown as ImplementedAction<State, Spec>;

    const handlers: Map<string, Handler<State, Spec, ImplementedAction<State, Spec>>> = new Map();

    if (typeof handlerArgs.contentType === 'string') {
      handlers.set(handlerArgs.contentType, {
        contentType: handlerArgs.contentType,
        handler: handlerArgs.handler,
        meta: handlerArgs.meta ?? {},
        name: this.#meta.name,
        action: this as unknown as ImplementedAction<State, Spec>,
        registry: this.#meta.registry,
      });
    } else {
      for (const item of handlerArgs.contentType) {
        handlers.set(item, {
          contentType: item,
          handler: handlerArgs.handler,
          name: this.#meta.name,
          meta: handlerArgs.meta ?? {},
          action: this as unknown as ImplementedAction<State, Spec>,
          registry: this.#meta.registry,
        });
      }
    }

    this.#handlers = handlers;
  }

  static fromHandlers<
    State extends ContextState = ContextState,
    Spec extends ActionSpec = ActionSpec,
  >(
    typeDef: TypeDef | undefined,
    spec: Spec,
    meta: ActionMeta<State, Spec>,
    contextType: string | string[],
    handler: HandlerFn<State, Spec> | HandlerText,
  ): FinalizedAction<State, Spec>;

  static fromHandlers<
    State extends ContextState = ContextState,
    Spec extends ActionSpec = ActionSpec,
  >(
    typeDef: TypeDef | undefined,
    spec: Spec,
    meta: ActionMeta<State, Spec>,
    handlerArgs: HandlerArgs<State, Spec>,
  ): FinalizedAction<State, Spec>;

  static fromHandlers<
    State extends ContextState = ContextState,
    Spec extends ActionSpec = ActionSpec,
  >(
    typeDef: TypeDef | undefined,
    spec: Spec,
    meta: ActionMeta<State, Spec>,
    arg3: string | string[] | HandlerArgs<State, Spec>,
    arg4?: HandlerFn<State, Spec>,
  ): FinalizedAction<State, Spec> {
    if (Array.isArray(arg3) || typeof arg3 === 'string') {
      return new FinalizedAction<State, Spec>(
        typeDef,
        spec,
        meta,
        { contentType: arg3, handler: arg4 as HandlerFn<State, Spec> | HandlerText },
      );
    }

    return new FinalizedAction(typeDef, spec, meta, arg3);
  }

  static async toJSONLD(
    action: ImplementedAction,
    scope: Scope,
  ): Promise<JSONObject | null> {
    if (scope == null || action.typeDef == null) {
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
    return this.#meta.allowsPublicAccess;
  }

  get method(): string {
    return this.#meta.method;
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

  get name(): string {
    return this.#meta.name;
  }

  get template(): string {
    return this.#meta.uriTemplate;
  }

  get pattern(): URLPattern {
    return this.#meta.path.pattern;
  }

  get spec(): Spec {
    return this.#spec;
  }

  get scope(): Scope | undefined {
    return this.#meta.scope
  }

  get registry(): Registry {
    return this.#meta.registry;
  }
  
  get handlers(): Handler<State, Spec>[] {
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
    return joinPaths(this.#meta.registry.rootIRI, this.#meta.path.normalized);
  }

  jsonld(): Promise<JSONObject | null> {
    const scope = this.#meta.scope;

    return FinalizedAction.toJSONLD(
      this as unknown as ImplementedAction,
      scope
    );
  }

  jsonldPartial(): { '@type': string, '@id': string } | null {
    const scope = this.#meta.scope;
    const typeDef = this.#typeDef;

    if (scope == null || typeDef == null) {
      return null;
    }
    
    return {
      '@type': typeDef.type,
      '@id': joinPaths(scope.url(), this.#meta.name),
    };
  }

  handle(
    contentType: string | string[],
    handler: HandlerFn<State, Spec> | HandlerText,
  ): FinalizedAction<State, Spec>;

  handle(
    args: HandlerArgs<State, Spec>,
  ): FinalizedAction<State, Spec>;
  
  handle(
    arg1: string | string[] | HandlerArgs<State, Spec>,
    arg2?: HandlerFn<State, Spec>,
  ): FinalizedAction<State, Spec> {
    let contentType: string | string[];
    let handler: HandlerFn<State, Spec> | HandlerText;
    let meta: HandlerMeta;

    if (Array.isArray(arg1) || typeof arg1 === 'string') {
      contentType = arg1;
      handler = arg2 as HandlerFn<State, Spec> | HandlerText;
      meta = Object.create(null);
    } else {
      contentType = arg1.contentType;
      handler = arg1.handler;
      meta = Object.assign(Object.create(null), arg1.meta);

      if (arg1.meta != null) {
        for (const sym of Object.getOwnPropertySymbols(arg1.meta)) {
          meta[sym] = arg1.meta[sym];
        }
      }
    }

    if (!Array.isArray(contentType)) {
      this.#handlers.set(contentType, {
        contentType,
        name: this.#meta.name,
        meta,
        action: this as unknown as ImplementedAction<State, Spec>,
        registry: this.#meta.registry,
        handler,
      });
    } else {
      for (const item of contentType) {
        this.#handlers.set(item, {
          contentType: item,
          name: this.#meta.name,
          meta,
          action: this as unknown as ImplementedAction<State, Spec>,
          registry: this.#meta.registry,
          handler,
        });
      }
    }

    return this;
  }

  async handleRequest(args: HandleRequestArgs): Promise<ResponseTypes> {
    const handler = this.#handlers.get(args.contentType as string) as Handler<State, Spec>;

    return this.#meta.handleRequest({
      ...args,
      handler,
    });
  }
}

export interface Applicable<ActionType> {
  use(): ActionType;
}

export class DefinedAction<
  State extends ContextState = ContextState,
  Term extends string = string,
  Spec extends ActionSpec = ActionSpec,
> implements
  Applicable<DefinedAction<State, Term, Spec>>,
  Handleable<State, Spec>,
  ImplementedAction<State, Spec>
{
  #spec: Spec;
  #meta: ActionMeta<State, Spec>;
  #typeDef?: TypeDef;

  constructor(
    typeDef: TypeDef | undefined,
    spec: Spec,
    meta: ActionMeta<State, Spec>,
  ) {
    this.#spec = spec;
    this.#meta = meta;
    this.#typeDef = typeDef;

    this.#meta.action = this as unknown as ImplementedAction<State, Spec>;
  }

  get public(): boolean {
    return this.#meta.allowsPublicAccess;
  }

  get method(): string {
    return this.#meta.method;
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

  get name(): string {
    return this.#meta.name;
  }

  get template(): string {
    return this.#meta.uriTemplate;
  }

  get pattern(): URLPattern {
    return this.#meta.path.pattern;
  }

  get path(): string {
    return this.#meta.path.normalized;
  }

  get spec(): Spec {
    return this.#spec;
  }

  get scope(): Scope | undefined {
    return this.#meta.scope;
  }

  get registry(): Registry {
    return this.#meta.registry;
  }

  get handlers(): Handler<State, Spec>[] {
    return [];
  }

  get contentTypes(): string[] {
    return [];
  }
 
  url(): string {
    return '';
  }

  get context(): JSONLDContext {
    return getActionContext({
      spec: this.#spec,
      // vocab: this.#vocab,
      // aliases: this.#aliases,
    });
  }

  jsonld(): Promise<JSONObject | null> {
    const scope = this.#meta.scope;

    return FinalizedAction.toJSONLD(
      this as unknown as ImplementedAction,
      scope
    );
  }

  jsonldPartial(): { '@type': string, '@id': string } | null {
    const scope = this.#meta.scope;
    const typeDef = this.#typeDef;

    if (scope == null || typeDef == null) {
      return null;
    }
    
    return {
      '@type': typeDef.type,
      '@id': joinPaths(scope.url(), this.#meta.name),
    };
  }

  use(): DefinedAction<State, string, Spec> {
    return this;
  }

  handle(
    contentType: string | string[],
    handler: HandlerFn<State, Spec> | HandlerText,
  ): FinalizedAction<State, Spec>;

  handle(
    args: HandlerArgs<State, Spec>,
  ): FinalizedAction<State, Spec>;

  handle(
    arg1: string | string[] | HandlerArgs<State, Spec>,
    arg2?: HandlerFn<State, Spec>,
  ): FinalizedAction<State, Spec> {
    return FinalizedAction.fromHandlers(
      this.#typeDef,
      this.#spec,
      this.#meta,
      arg1 as string,
      arg2 as HandlerFn<State, Spec>,
    );
  }

  async handleRequest(args: HandleRequestArgs): Promise<ResponseTypes> {
    return this.#meta.handleRequest({
      ...args,
    });
  }

}

export class Action<
  State extends ContextState = ContextState,
> implements
  Applicable<Action>,
  Handleable<State>,
  ImplementedAction<State>
{
  #spec: ActionSpec = {};
  #meta: ActionMeta<State>;

  constructor(
    meta: ActionMeta<State>,
  ) {
    this.#meta = meta;
    this.#meta.action = this;
  }

  get public(): boolean {
    return this.#meta.allowsPublicAccess;
  }

  get method(): string {
    return this.#meta.method;
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

  get name(): string {
    return this.#meta.name;
  }

  get template(): string {
    return this.#meta.uriTemplate;
  }

  get pattern(): URLPattern {
    return this.#meta.path.pattern;
  }


  get path(): string {
    return this.#meta.path.normalized;
  }

  get spec(): ActionSpec {
    return this.#spec;
  }

  get scope(): Scope | undefined {
    return this.#meta.scope;
  }

  get registry(): Registry {
    return this.#meta.registry;
  }
  
  get handlers(): Handler[] {
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
    Term extends string = string,
    Spec extends ActionSpec = ActionSpec,
  >(args: DefineArgs<Term, Spec>): DefinedAction<State, Term, Spec> {
    return new DefinedAction<State, Term, Spec>(
      args.typeDef,
      args.spec,
      this.#meta as unknown as ActionMeta<State, Spec>,
    );
  }

  handle(
    arg1: string | string[] | HandlerArgs<State>,
    arg2?: HandlerFn<State>,
  ): FinalizedAction<State> {
    return FinalizedAction.fromHandlers(
      undefined,
      this.#spec,
      this.#meta,
      arg1 as string,
      arg2 as HandlerFn<State>,
    );
  }

  async handleRequest(args: HandleRequestArgs): Promise<ResponseTypes> {
    return this.#meta.handleRequest({
      ...args,
    });
  }

}

export class PreAction<
  State extends ContextState = ContextState,
> implements
  Applicable<Action>,
  Handleable<State>
{
  #meta: ActionMeta<State>;

  constructor(
    meta: ActionMeta<State>,
  ) {
    this.#meta = meta;
  }

  use() {
    return new Action(
      this.#meta,
    );
  }

  define<
    Term extends string = string,
    Spec extends ActionSpec = ActionSpec,
  >(args: DefineArgs<Term, Spec>): DefinedAction<State, Term, Spec> {
    return new DefinedAction<State, Term, Spec>(
      args.typeDef,
      args.spec,
      this.#meta as unknown as ActionMeta<State, Spec>,
    );
  }

  handle(
    arg1: string | string[] | HandlerArgs<State>,
    arg2?: HandlerFn<State>,
  ): FinalizedAction<State> {
    return FinalizedAction.fromHandlers(
      undefined,
      {},
      this.#meta,
      arg1 as string,
      arg2 as HandlerFn<State>,
    );
  }
}

export class Endpoint<
  State extends ContextState = ContextState,
> implements
  Applicable<Action>,
  Handleable<State>
{
  #meta: ActionMeta<State>;

  constructor(
    meta: ActionMeta<State>,
  ) {
    this.#meta = meta;
  }
  
  hint(hints: HintArgs): Endpoint<State> {
    this.#meta.hints.push(hints);

    return this;
  }

  compress(): Endpoint<State> {
    return this;
  }
  
  cache<
    StorageKey extends string = string,
  >(_args: CacheArgs<StorageKey>) {
    return this;
  }

  etag() {
    return this;
  }

  use(): Action<State> {
    return new Action<State>(this.#meta);
  }

  define<
    Term extends string = string,
    Spec extends ActionSpec = ActionSpec,
  >(args: DefineArgs<Term, Spec>): DefinedAction<State, Term, Spec> {
    return new DefinedAction<State, Term, Spec>(
      args.typeDef,
      args.spec,
      this.#meta as ActionMeta<State, Spec>,
    );
  }

  handle(
    arg1: string | string[] | HandlerArgs<State>,
    arg2?: HandlerFn<State>,
  ): FinalizedAction<State> {
    return FinalizedAction.fromHandlers(
      undefined,
      {},
      this.#meta,
      arg1 as string,
      arg2 as HandlerFn<State>,
    );
  }
}

export class ActionAuth<
  State extends ContextState = ContextState,
> {
  #meta: ActionMeta<State>;

  constructor(meta: ActionMeta<State>) {
    this.#meta = meta;
  }

  public(): Endpoint<State> {
    this.#meta.allowsPublicAccess = true;
    
    return new Endpoint(this.#meta);
  }

  private(): Endpoint<State> {
    return new Endpoint(this.#meta);
  }
}

