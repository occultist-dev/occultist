import { ActionAuth, HandlerDefinition } from "./actions/actions.ts";
import { ActionCore } from "./actions/core.ts";
import type { ContextState } from "./actions/spec.ts";
import type { AuthMiddleware, ImplementedAction } from "./actions/types.ts";
import type { HTTPWriter } from "./actions/writer.ts";
import { type Callable, HTTP, type Registry } from './registry.ts';
import type { EndpointArgs } from "./types.ts";
export type MetaPropatator = (meta: ActionCore) => void;
export type ScopeArgs = {
    path: string;
    serverTiming?: boolean;
    registry: Registry;
    writer: HTTPWriter;
    propergateMeta: MetaPropatator;
};
export declare class Scope<State extends ContextState = ContextState> implements Callable<State> {
    #private;
    constructor(path: string, registry: Registry, writer: HTTPWriter, propergateMeta: MetaPropatator, recordServerTiming: boolean, autoLanguageTags: boolean, autoFileExtensions: boolean);
    get path(): string;
    get registry(): Registry;
    get http(): HTTP<State>;
    get actions(): Array<ImplementedAction>;
    get handlers(): HandlerDefinition[];
    public(authMiddleware?: AuthMiddleware): Scope<State>;
    private(authMiddleware: AuthMiddleware): Scope<State>;
    /**
     * Creates an action for any HTTP method.
     *
     * @param method The HTTP method name.
     * @param name   Name for the action being produced.
     * @param path   Path the action responds to.
     */
    endpoint(method: string, path: string, args?: EndpointArgs): ActionAuth<State>;
    url(): string;
    finalize(): void;
}
