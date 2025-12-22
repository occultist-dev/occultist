import type {ActionSpec, ContextState} from "../actions/spec.ts";
import type { EmptyObject, JSONObject, JSONValue } from "../jsonld.ts";

export function parseSearchParams<
  ActionState extends ContextState = EmptyObject,
>(
  spec: ActionSpec<ActionState>,
  searchParams: URLSearchParams,
): JSONObject {
  const body: Record<string, JSONValue> = {};

  for (const [key, specItem] of Object.entries(spec)) {
    const value = searchParams.get(key);

    if (
      specItem.dataType === "number" &&
      Array.isArray(value) &&
      value !== null
    ) {
      body[key] = value.map(Number);
    } else if (
      specItem.dataType === "number" &&
      value !== null &&
      isNaN(Number(value))
    ) {
      // keeping the number value as a string allows error handling to work with it
      body[key] = value;
    } else if (specItem.dataType === "number" && value !== null) {
      body[key] = Number(value);
    } else if (value !== null) {
      body[key] = value;
    }
  }

  return body;
}
