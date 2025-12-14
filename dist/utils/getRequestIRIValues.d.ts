import type { ImplementedAction } from "../actions/types.js";
import type { ActionSpec, ContextState, FileSingleSpec, FileMultiSpec, BooleanSingleSpec, BooleanMultiSpec, NumberSingleSpec, NumberMultiSpec, StringSingleSpec, StringMultiSpec, ParsedIRIValues } from "../actions/spec.js";
export type IRIValue<Spec extends ActionSpec<ContextState> = ActionSpec<ContextState>> = {
    [Term in keyof Spec]: (Spec[Term] extends FileSingleSpec | FileMultiSpec ? never : Spec[Term]['valueName'] extends string ? (Spec[Term] extends BooleanSingleSpec ? boolean : Spec[Term] extends BooleanMultiSpec ? boolean[] : Spec[Term] extends NumberSingleSpec ? number : Spec[Term] extends NumberMultiSpec ? number[] : Spec[Term] extends StringSingleSpec ? string : Spec[Term] extends StringMultiSpec ? string[] : never) : never);
};
export type RequestIRIResult<Spec extends ActionSpec<ContextState> = ActionSpec<ContextState>> = {
    pathValues: ParsedIRIValues;
    queryValues: ParsedIRIValues;
    iriValues: IRIValue<Spec>;
};
export declare function getRequestIRIValues<State extends ContextState = ContextState, Spec extends ActionSpec<ContextState> = ActionSpec<ContextState>>({ iri, action, }: {
    iri: string;
    action: ImplementedAction<State, Spec>;
}): RequestIRIResult<Spec>;
