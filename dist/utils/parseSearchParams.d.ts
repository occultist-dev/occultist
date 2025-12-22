import type { ActionSpec, ContextState } from "../actions/spec.ts";
import type { EmptyObject, JSONObject } from "../jsonld.ts";
export declare function parseSearchParams<ActionState extends ContextState = EmptyObject>(spec: ActionSpec<ActionState>, searchParams: URLSearchParams): JSONObject;
