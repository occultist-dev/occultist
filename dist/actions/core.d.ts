import { CacheDescriptor } from '../cache/cache.ts';
import type { CacheInstanceArgs, CacheOperation, CacheOperationResult } from '../cache/types.ts';
import type { JSONValue } from '../jsonld.ts';
import type { Registry } from '../registry.ts';
import type { Scope } from "../scopes.ts";
import { HandlerDefinition } from './actions.ts';
import { CacheContext, Context } from './context.ts';
import { Route } from "./route.ts";
import type { ActionSpec, ContextState, FileValue, NextFn, TransformerFn } from './spec.ts';
import type { AuthMiddleware, AuthState, CacheHitHeader, HintArgs, ImplementedAction } from './types.ts';
import { type HTTPWriter, type ResponseTypes } from "./writer.ts";
export declare const BeforeDefinition = 0;
export declare const AfterDefinition = 1;
/**
 * Internal accumulator object used to hold values request / response
 * middleware setup needs to access.
 */
export declare class MiddlewareRefs<State extends ContextState, Auth extends AuthState, Spec extends ActionSpec> {
    authKey?: string;
    auth?: Auth;
    state: State;
    spec?: Spec;
    cacheOperation?: CacheOperation;
    cacheCtx?: CacheContext;
    handlerCtx?: Context;
    next: NextFn;
    headers: Headers;
    handler?: HandlerDefinition<State, Auth, Spec>;
    contentType: string | null;
    writer: HTTPWriter;
    req: Request;
    recordServerTiming: boolean;
    prevTime: number | null;
    serverTimes: string[];
    cacheHitHeader: CacheHitHeader;
    constructor(req: Request, writer: HTTPWriter, contentType: string | null, prevTime: number | null);
    recordServerTime(name: string): void;
}
/**
 * Internal object that holds shared information action
 * building classes reference.
 */
export declare class ActionCore<State extends ContextState = ContextState, Auth extends AuthState = AuthState, Spec extends ActionSpec = ActionSpec> {
    #private;
    rootIRI: string;
    method: string;
    isSafe: boolean;
    name?: string;
    uriTemplate: string;
    public: boolean;
    authKey?: string;
    route: Route;
    hints: HintArgs[];
    transformers: Map<string, TransformerFn<JSONValue | FileValue, State, Spec>>;
    scope?: Scope;
    registry: Registry;
    writer: HTTPWriter;
    action?: ImplementedAction<State, Auth, Spec>;
    acceptCache: Set<string>;
    compressBeforeCache: boolean;
    cacheOccurance: 0 | 1;
    auth?: AuthMiddleware<Auth>;
    cache: CacheInstanceArgs[];
    autoLanguageCodes: boolean;
    autoFileExtensions: boolean;
    recordServerTiming: boolean;
    constructor(rootIRI: string, method: string, name: string | undefined, uriTemplate: string, registry: Registry, writer: HTTPWriter, scope: Scope | undefined, autoLanguageCodes: boolean, autoFileExtensions: boolean, recordServerTiming: boolean | undefined);
    /**
     * Called when the API is defined to compute all uncomputed values.
     */
    finalize(): void;
    /**
     * Selects the cache entry descriptor which is best used for this requert.
     *
     * @param contentType The content type of the response.
     * @param req The request instance.
     * @param cacheCtx A cache context instance.
     * @returns A cache descriptor object or null if no cache entry matches.
     */
    getCacheDescriptor(contentType: string, req: Request, cacheCtx: CacheContext): CacheDescriptor | null;
    /**
     * Primes a cache entry.
     */
    primeCache(refs: MiddlewareRefs<State, Auth, Spec>): Promise<CacheOperationResult>;
    /**
     * Refreshes a cache entry.
     */
    refreshCache(refs: MiddlewareRefs<State, Auth, Spec>): Promise<CacheOperationResult>;
    /**
     * Invalidates a cache entry.
     */
    invalidateCache(refs: MiddlewareRefs<State, Auth, Spec>): Promise<CacheOperationResult>;
    /**
     * Handles a request.
     *
     * All actions call this method to do the heavy lifting of handling a request.
     */
    handleRequest(refs: MiddlewareRefs<State, Auth, Spec>): Promise<ResponseTypes>;
    get [Symbol.toStringTag](): string;
}
