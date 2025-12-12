type ObjectValue = Record<string | number | symbol, unknown>;

/**
 * Returns true if the input value is a plain Javascript object.
 */
export function isObject<T extends ObjectValue = ObjectValue>(value: unknown): value is T {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
