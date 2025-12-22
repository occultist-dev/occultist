import type { CacheInstanceArgs } from '../cache/types.ts';
import type { JSONValue } from '../jsonld.ts';
import type { Registry } from '../registry.ts';
import type { Scope } from "../scopes.ts";
import { HandlerDefinition } from './actions.ts';
import { Path } from "./path.ts";
import type { ActionSpec, ContextState, FileValue, TransformerFn } from './spec.ts';
import type { AuthMiddleware, AuthState, CacheHitHeader, HintArgs, ImplementedAction } from './types.ts';
import { type HTTPWriter, type ResponseTypes } from "./writer.ts";
export declare const BeforeDefinition = 0;
export declare const AfterDefinition = 1;
export declare class ActionMeta<State extends ContextState = ContextState, Auth extends AuthState = AuthState, Spec extends ActionSpec = ActionSpec> {
    #private;
    rootIRI: string;
    method: string;
    name: string;
    uriTemplate: string;
    public: boolean;
    authKey?: string;
    path: Path;
    hints: HintArgs[];
    transformers: Map<string, TransformerFn<JSONValue | FileValue, State, Spec>>;
    scope?: Scope;
    registry: Registry;
    writer: HTTPWriter;
    action?: ImplementedAction<State, Spec>;
    acceptCache: Set<string>;
    compressBeforeCache: boolean;
    cacheOccurance: 0 | 1;
    auth?: AuthMiddleware<Auth>;
    cache: CacheInstanceArgs[];
    serverTiming: boolean;
    constructor(rootIRI: string, method: string, name: string, uriTemplate: string, registry: Registry, writer: HTTPWriter, scope?: Scope);
    /**
     * Called when the API is defined to compute all uncomputed values.
     */
    finalize(): void;
    perform(req: Request): Promise<Response>;
    /**
     *
     */
    handleRequest({ contentType, url, req, writer, spec, handler, cacheHitHeader, startTime, }: {
        contentType?: string;
        language?: string;
        encoding?: string;
        url: string;
        req: Request;
        writer: HTTPWriter;
        spec?: Spec;
        handler?: HandlerDefinition<State, Spec>;
        cacheHitHeader?: CacheHitHeader;
        startTime?: number;
    }): Promise<ResponseTypes>;
    get [Symbol.toStringTag](): string;
}
