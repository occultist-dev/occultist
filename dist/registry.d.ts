import { Accept } from "./accept.js";
import { ActionAuth, HandlerDefinition } from "./actions/actions.js";
import { type ActionMatchResult, ActionSet } from "./actions/actionSets.js";
import type { ImplementedAction } from "./actions/types.js";
import { Scope } from './scopes.js';
import { IncomingMessage, type ServerResponse } from "node:http";
import type { Merge } from "./actions/spec.js";
import type { ContextState, Middleware } from "./actions/spec.js";
export interface Callable<State extends ContextState = ContextState> {
    method(method: string, name: string, path: string): ActionAuth<State>;
}
export declare class HTTP<State extends ContextState = ContextState> {
    #private;
    constructor(callable: Callable<State>);
    trace(name: string, path: string): ActionAuth<State>;
    options(name: string, path: string): ActionAuth<State>;
    head(name: string, path: string): ActionAuth<State>;
    get(name: string, path: string): ActionAuth<State>;
    put(name: string, path: string): ActionAuth<State>;
    patch(name: string, path: string): ActionAuth<State>;
    post(name: string, path: string): ActionAuth<State>;
    delete(name: string, path: string): ActionAuth<State>;
}
export type IndexMatchArgs = {
    debug?: boolean;
};
export declare class IndexEntry {
    #private;
    constructor(actionSets: ActionSet[]);
    match(method: string, path: string, accept: Accept): null | ActionMatchResult;
}
export type RegistryEvents = 'beforefinalize' | 'afterfinalize';
export type RegistryArgs = {
    rootIRI: string;
    serverTiming?: boolean;
};
export declare class Registry<State extends ContextState = ContextState> implements Callable<State> {
    #private;
    constructor(args: RegistryArgs);
    scope(path: string): Scope<State>;
    get rootIRI(): string;
    get path(): string;
    get http(): HTTP<State>;
    get actions(): Array<ImplementedAction>;
    /**
     * Returns the first action using the given action name. A content type
     * can be provided to select another action going by the same name
     * and returning a different content type.
     *
     * @param name        - The name of the action.
     * @param contentType - The action's content type.
     */
    get(name: string, contentType?: string): ImplementedAction | undefined;
    /**
     * Returns a list of all action handler definitions.
     */
    get handlers(): HandlerDefinition[];
    /**
     * Queries all handler definitions.
     *
     * @param args.method      The HTTP method the action should handle.
     * @param args.contentType A content type, or list of content types the action
     *                         should handle. If a list is given the action
     *                         will be included if it matches one content type
     *                         in the list.
     * @param args.meta        A meta value, such as a unique symbol, which the action
     *                         should have in its meta object.
     */
    query({ method, contentType, meta, }?: {
        method?: string | string[];
        contentType?: string | string[];
        meta?: string | symbol;
    }): HandlerDefinition[];
    /**
     * Creates an action for any HTTP method.
     *
     * @param method The HTTP method name.
     * @param name   Name for the action being produced.
     * @param path   Path the action responds to.
     */
    method(method: string, name: string, path: string): ActionAuth<State>;
    use<const MiddlewareState extends ContextState = ContextState>(middleware: Middleware<MiddlewareState>): Registry<Merge<State, MiddlewareState>>;
    finalize(): void;
    handleRequest(req: Request): Promise<Response>;
    handleRequest(req: IncomingMessage, res: ServerResponse): Promise<ServerResponse>;
    addEventListener(type: RegistryEvents, callback: EventListener): void;
    removeEventListener(type: RegistryEvents, callback: EventListener): void;
}
