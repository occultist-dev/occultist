import { CacheInstanceArgs } from '../cache/types.js';
import { JSONValue } from '../jsonld.js';
import type { Registry } from '../registry.js';
import type { Scope } from "../scopes.js";
import { HandlerDefinition } from './actions.js';
import { Path } from "./path.js";
import type { ActionSpec, ContextState, FileValue, TransformerFn } from './spec.js';
import type { HintArgs, ImplementedAction } from './types.js';
import type { HTTPWriter, ResponseTypes } from "./writer.js";
export declare const BeforeDefinition = 0;
export declare const AfterDefinition = 1;
export declare class ActionMeta<State extends ContextState = ContextState, Spec extends ActionSpec = ActionSpec> {
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
    cache: CacheInstanceArgs[];
    serverTiming: boolean;
    constructor(rootIRI: string, method: string, name: string, uriTemplate: string, registry: Registry, writer: HTTPWriter, scope?: Scope);
    /**
     * Called when the API is defined to compute all uncomputed values.
     */
    finalize(): void;
    handleRequest({ startTime, contentType, language: _language, encoding: _encoding, url, req, writer, spec, handler, }: {
        startTime: number;
        contentType?: string;
        language?: string;
        encoding?: string;
        url: string;
        req: Request;
        writer: HTTPWriter;
        spec?: Spec;
        handler?: HandlerDefinition<State, Spec>;
    }): Promise<ResponseTypes>;
    get [Symbol.toStringTag](): string;
}
