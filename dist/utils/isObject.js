/**
 * Returns true if the input value is a plain Javascript object.
 */
export function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
