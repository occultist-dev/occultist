import type { ActionSpec, ContextState } from "../actions/spec.js";
import type { EmptyObject, JSONObject } from "../jsonld.js";
export declare function parseSearchParams<ActionState extends ContextState = EmptyObject>(spec: ActionSpec<ActionState>, searchParams: URLSearchParams): JSONObject;
