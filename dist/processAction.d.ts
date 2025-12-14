import type { ImplementedAction } from "./actions/types.js";
import type { ActionPayload, ActionSpec, ContextState, ParsedIRIValues } from "./actions/spec.js";
export type ProcessActionArgs<State extends ContextState = ContextState, Spec extends ActionSpec<ContextState> = ActionSpec<ContextState>> = {
    iri: string;
    req: Request;
    spec: Spec;
    state: State;
    action: ImplementedAction<State, Spec>;
};
export type ProcessActionResult<Spec extends ActionSpec<ContextState> = ActionSpec<ContextState>> = {
    params: ParsedIRIValues;
    query: ParsedIRIValues;
    payload: ActionPayload<Spec>;
};
export declare function processAction<State extends ContextState = ContextState, Spec extends ActionSpec<ContextState> = ActionSpec<ContextState>>({ iri, req, spec, state, action, }: ProcessActionArgs<State, Spec>): Promise<ProcessActionResult<Spec>>;
