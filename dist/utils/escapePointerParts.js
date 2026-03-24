/**
 * @description
 * Expects a list of json pointer parts and returns a json pointer.
 */
export function escapeJSONPointerParts(...parts) {
    const escaped = parts
        .map((part) => part.replace(/~/g, '~0').replace(/\//g, '~1'))
        .join('/');
    return `${escaped}`;
}
