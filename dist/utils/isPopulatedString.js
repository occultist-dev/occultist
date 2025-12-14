// deno-lint-ignore no-explicit-any
export function isPopulatedString(value) {
    return typeof value === 'string' && value.length !== 0;
}
