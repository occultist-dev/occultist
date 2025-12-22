import type { JSONValue } from "../jsonld.ts";
import type { ContextState, ActionSpec } from "../actions/spec.ts";
import type { ImplementedAction } from "../actions/types.ts";
export type BodyValue = Record<string, JSONValue>;
export type RequestBodyResult = {
    bodyValues: BodyValue;
};
export declare function getRequestBodyValues<State extends ContextState = ContextState, Spec extends ActionSpec<ContextState> = ActionSpec<ContextState>>({ req, action, }: {
    req: Request;
    action: ImplementedAction<State, Spec>;
}): Promise<RequestBodyResult>;
