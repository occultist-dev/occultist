import { ActionAuth, HandlerDefinition } from "./actions/actions.js";
import { ActionMeta } from "./actions/meta.js";
import type { ContextState } from "./actions/spec.js";
import type { ImplementedAction } from "./actions/types.js";
import type { HTTPWriter } from "./actions/writer.js";
import { type Callable, HTTP, type Registry } from './registry.js';
export type MetaPropatator = (meta: ActionMeta) => void;
export type ScopeArgs = {
    path: string;
    serverTiming?: boolean;
    registry: Registry;
    writer: HTTPWriter;
    propergateMeta: MetaPropatator;
};
export declare class Scope<State extends ContextState = ContextState> implements Callable<State> {
    #private;
    constructor({ path, serverTiming, registry, writer, propergateMeta, }: ScopeArgs);
    get path(): string;
    get registry(): Registry;
    get http(): HTTP<State>;
    get actions(): Array<ImplementedAction>;
    get handlers(): HandlerDefinition[];
    public(): Scope<State>;
    private(): Scope<State>;
    /**
     * Creates any HTTP method.
     *
     * @param method The HTTP method.
     * @param name   Name for the action being produced.
     * @param path   Path the action responds to.
     */
    method(method: string, name: string, path: string): ActionAuth<State>;
    url(): string;
    finalize(): void;
}
